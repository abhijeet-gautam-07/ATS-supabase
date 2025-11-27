// app/api/extract/route.ts
import { NextResponse } from "next/server";
import { extractText } from "unpdf";
import mammoth from "mammoth";

export const runtime = "nodejs";

function extFromUrl(url: string | undefined) {
  if (!url) return "";
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split(".");
    return parts.pop()?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function summarizeResult(res: any) {
  if (!res) return null;
  const out: any = {};
  const text = typeof res.text === "string" ? res.text : "";
  out.textLength = text.length;
  if (Array.isArray(res.pages)) out.pages = res.pages.length;
  return out;
}

/** Call OCR.Space as a fallback. Returns parsed text or null on failure. */
async function callOcrSpaceByUrl(fileUrl: string, apiKey: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("apikey", apiKey);
    form.append("url", fileUrl);
    // optional params:
    form.append("language", "eng");
    form.append("isOverlayRequired", "false");
    // timeout and keep response small
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      console.warn("OCR.space responded not ok", res.status);
      return null;
    }
    const json = await res.json().catch(() => null);
    if (!json) return null;
    // parse structure: { ParsedResults: [{ ParsedText: "..." }], OCRExitCode: 1, IsErroredOnProcessing: false }
    if (Array.isArray(json.ParsedResults) && json.ParsedResults.length > 0) {
      const parsed = json.ParsedResults[0];
      const parsedText = parsed?.ParsedText;
      if (typeof parsedText === "string" && parsedText.trim().length > 0) {
        return parsedText;
      }
    }
    return null;
  } catch (err) {
    console.error("callOcrSpaceByUrl error:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const file_url: string | undefined = body?.file_url;

    if (!file_url) {
      return NextResponse.json({ error: "file_url is required" }, { status: 400 });
    }

    // fetch file
    const res = await fetch(file_url);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ error: `Failed to fetch file: ${res.status} ${txt}` }, { status: 502 });
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const arrayBuffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const byteLength = uint8.byteLength;
    const ext = extFromUrl(file_url);

    const meta = { file_url, ext, contentType, bytes: byteLength };
    console.log("extract: starting", meta);

    // ------------- PDF flow (UNPDF -> UNPDF OCR -> OCR.space) -------------
    if (ext === "pdf" || contentType.includes("pdf")) {
      // 1) UNPDF normal
      try {
        const result: any = await extractText(uint8);
        const text = typeof result?.text === "string" ? String(result.text) : "";
        console.log("UNPDF normal keys:", Object.keys(result || {}), "textLen:", text.length);
        if (text.trim().length > 0) {
          return NextResponse.json({ text });
        }

        // 2) UNPDF OCR retry
        try {
          console.log("UNPDF: retry with OCR enabled");
          const ocrResult: any = await extractText(uint8, { pdf: { enableOcr: true } } as any);
          const ocrText = typeof ocrResult?.text === "string" ? String(ocrResult.text) : "";
          console.log("UNPDF OCR keys:", Object.keys(ocrResult || {}), "textLen:", ocrText.length);
          if (ocrText.trim().length > 0) {
            return NextResponse.json({ text: ocrText, usedOcr: true });
          }
        } catch (ocrErr: any) {
          console.warn("UNPDF OCR attempt failed:", String(ocrErr?.message ?? ocrErr));
          // continue to external OCR fallback
        }

        // 3) External OCR fallback: OCR.space
        const OCR_KEY = process.env.OCR_SPACE_API_KEY;
        if (OCR_KEY) {
          console.log("Calling OCR.space fallback for", file_url);
          const ocrText = await callOcrSpaceByUrl(file_url, OCR_KEY);
          if (ocrText && ocrText.trim().length > 0) {
            return NextResponse.json({ text: ocrText, usedExternalOcr: "ocr.space" });
          } else {
            console.warn("OCR.space returned no text for", file_url);
          }
        } else {
          console.warn("No OCR_SPACE_API_KEY present; skipping OCR.space fallback");
        }

        // all attempts failed — return diagnostics
        return NextResponse.json(
          {
            error: "Failed to extract text from PDF",
            meta,
            unpdf: {
              normal: summarizeResult(result),
              // ocr summary may not exist if UNPDF OCR threw; attempt to include if present
            },
            note:
              "Tried UNPDF normal, UNPDF OCR, and OCR.space fallback (if API key provided). This PDF likely contains images/scans; consider an advanced OCR pipeline.",
          },
          { status: 500 }
        );
      } catch (err: any) {
        console.error("UNPDF call failed outright:", err?.message ?? err);
        return NextResponse.json({ error: "UNPDF call failed", detail: String(err?.message ?? err) }, { status: 500 });
      }
    }

    // ------------- DOCX -> mammoth -------------
    if (ext === "docx" || ext === "doc" || contentType.includes("word") || contentType.includes("officedocument")) {
      try {
        const nodeBuffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer: nodeBuffer });
        const txt = result?.value ?? "";
        return NextResponse.json({ text: txt });
      } catch (err: any) {
        console.error("Mammoth error:", err?.message ?? err);
        return NextResponse.json({ error: "Failed to extract DOCX", details: String(err?.message ?? err) }, { status: 500 });
      }
    }

    // ------------- TXT fallback -------------
    try {
      const text = new TextDecoder("utf-8").decode(uint8);
      return NextResponse.json({ text });
    } catch (err: any) {
      console.error("fallback read error:", err?.message ?? err);
      return NextResponse.json({ error: "Unsupported file type or failed to read file" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("extract route error:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
