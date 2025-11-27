// app/api/extract/route.ts
import { NextResponse } from "next/server";
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

async function tryPdfParse(): Promise<((buffer: Buffer) => Promise<any>) | null> {
  try {
    const mod: any = await import("pdf-parse");
    const fn = mod?.default ?? mod;
    if (typeof fn === "function") return fn;
  } catch (err) {
    console.warn("pdf-parse dynamic import failed:", String(err));
  }

  try {
    // require fallback
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParseCjs: any = require("pdf-parse");
    const fn = pdfParseCjs?.default ?? pdfParseCjs;
    if (typeof fn === "function") return fn;
  } catch (err) {
    console.warn("pdf-parse require fallback failed:", String(err));
  }

  return null;
}

/**
 * Use pdfjs-dist at runtime; disable workers so pdf.worker.mjs is not required.
 * We use createRequire(import.meta.url) so bundler doesn't try to resolve at build time.
 */
function requirePdfJsRuntime(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createRequire } = require("module");
  const req = createRequire(import.meta.url);

  const candidates = [
    "pdfjs-dist/legacy/build/pdf.js",
    "pdfjs-dist/legacy/build/pdf",
    "pdfjs-dist/build/pdf.js",
    "pdfjs-dist/build/pdf",
    "pdfjs-dist"
  ];

  const tried: string[] = [];
  for (const name of candidates) {
    try {
      const mod = req(name);
      if (mod) return mod;
    } catch (err: any) {
      tried.push(`${name}: ${String(err?.message ?? err)}`);
    }
  }
  throw new Error("pdfjs-dist not found. Tried: " + tried.join(" | "));
}

async function extractPdfWithPdfJsRuntime(buffer: Buffer): Promise<string> {
  const pdfjsMod = requirePdfJsRuntime();
  const pdfjsAny = (pdfjsMod.default ?? pdfjsMod) as any;

  // disable worker — important to prevent attempts to load pdf.worker.mjs
  try {
    if (!pdfjsAny.GlobalWorkerOptions) pdfjsAny.GlobalWorkerOptions = {};
    // set workerSrc empty and request disableWorker in getDocument options below
    pdfjsAny.GlobalWorkerOptions.workerSrc = "";
  } catch (e) {
    // ignore
  }

  const uint8 = new Uint8Array(buffer);

  // Important: pass disableWorker: true to avoid worker usage
  const loadingTask = (pdfjsAny as any).getDocument({ data: uint8, disableWorker: true });
  const pdf = await loadingTask.promise;
  let outText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => (item.str || "")).join(" ");
    outText += pageText + "\n\n";
  }
  return outText;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const file_url: string | undefined = body?.file_url;
    if (!file_url) return NextResponse.json({ error: "file_url is required" }, { status: 400 });

    const res = await fetch(file_url);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ error: `Failed to fetch file: ${res.status} ${txt}` }, { status: 502 });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = extFromUrl(file_url);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();

    // PDF branch
    if (ext === "pdf" || contentType.includes("pdf")) {
      const pdfParseFn = await tryPdfParse();
      if (pdfParseFn) {
        try {
          const parsed = await pdfParseFn(buffer);
          return NextResponse.json({ text: parsed?.text ?? "" });
        } catch (err: any) {
          console.warn("pdf-parse runtime error; falling back to pdfjs:", String(err?.message ?? err));
        }
      }

      // fallback to pdfjs-dist (pure JS) with disabled worker
      try {
        const text = await extractPdfWithPdfJsRuntime(buffer);
        return NextResponse.json({ text });
      } catch (err: any) {
        console.error("pdfjs runtime error:", err);
        return NextResponse.json({ error: "Failed to parse PDF (pdf-parse and pdfjs both failed)", details: String(err?.message ?? err) }, { status: 500 });
      }
    }

    // DOCX / Word
    if (ext === "docx" || ext === "doc" || contentType.includes("word") || contentType.includes("officedocument")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return NextResponse.json({ text: result.value ?? "" });
      } catch (err: any) {
        console.error("mammoth error:", err);
        return NextResponse.json({ error: "Failed to extract DOCX" }, { status: 500 });
      }
    }

    // fallback: plain text
    try {
      const text = buffer.toString("utf8");
      return NextResponse.json({ text });
    } catch (err: any) {
      console.error("fallback read error:", err);
      return NextResponse.json({ error: "Unsupported file type or failed to read file" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("extract route error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
