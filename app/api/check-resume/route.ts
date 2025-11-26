import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function buildPrompt(extracted: string, jd: string, name?: string) {
  return `
You are an ATS evaluator. Return ONLY valid JSON (no extra text):

{
  "score": 0-100,
  "required_skills": ["skill1","skill2"] OR ["all required skills are there"],
  "feedback": "detailed feedback",
  "short_summary": "1-2 line summary"
}

Resume Text:
${extracted}

Job Description:
${jd}

Candidate: ${name ?? "Unknown"}

Return ONLY JSON.
`;
}

export async function POST(req: Request) {
  try {
    // --- env / supabase admin client
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Missing Supabase server envs (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // --- parse request
    const body = await req.json();
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const { candidateName, extractedText, jobDescription, file_url } = body ?? {};

    if (!token) return NextResponse.json({ error: "Missing Authorization header (Bearer token)" }, { status: 401 });
    if (!extractedText || !jobDescription) return NextResponse.json({ error: "Missing extractedText or jobDescription" }, { status: 400 });

    // --- validate token and get user id
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("Token validation failed:", userErr);
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
    const userId = userData.user.id;

    // --- call Gemini (Google GenAI SDK)
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let modelResp: any;
    try {
      modelResp = await ai.models.generateContent({
        model: "gemini-2.0-flash", // change if you prefer other available model
        contents: buildPrompt(extractedText, jobDescription, candidateName),
      });
    } catch (aiErr: any) {
      console.error("Gemini call failed:", aiErr);
      return NextResponse.json({ error: "AI error: " + (aiErr?.message ?? String(aiErr)) }, { status: 502 });
    }

    // --- robust extract of model text
    let rawText = "";
    try {
      if (modelResp && typeof (modelResp as any).text === "function") {
        // @ts-ignore
        rawText = await (modelResp as any).text();
      } else if (modelResp?.candidates?.[0]?.content?.parts?.[0]?.text) {
        rawText = modelResp.candidates[0].content.parts[0].text;
      } else {
        rawText = JSON.stringify(modelResp ?? "");
      }
    } catch (e) {
      rawText = JSON.stringify(modelResp ?? "");
    }

    console.log("Gemini raw:", rawText);

    // extract JSON object from output
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Model did not return JSON", raw: rawText }, { status: 500 });
    }
    let aiJson: any;
    try {
      aiJson = JSON.parse(match[0]);
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON from model", raw: rawText }, { status: 500 });
    }

    // normalize fields
    const score = Number(aiJson.score ?? null);
    let required_skills = aiJson.required_skills ?? aiJson.missing_skills ?? [];
    if (!Array.isArray(required_skills)) {
      required_skills = typeof required_skills === "string" && required_skills.trim() !== "" ? [required_skills] : ["all required skills are there"];
    }
    const feedback = String(aiJson.feedback ?? aiJson.comments ?? "");
    const short_summary = String(aiJson.short_summary ?? aiJson.summary ?? "").trim();

    const insertPayload = {
      user_id: userId,
      candidate_name: candidateName ?? null,
      score: Number.isFinite(Number(score)) ? Math.round(Number(score)) : null,
      required_skills: Array.isArray(required_skills) ? required_skills.join(", ") : String(required_skills),
      feedback: `${short_summary ? short_summary + "\n\n" : ""}${feedback}`,
      short_summary: short_summary ?? null,
      file_url: file_url ?? null,
    };

    console.log("SERVER INSERT DEBUG ----");
    console.log("insert payload:", insertPayload);

    const { data: inserted, error: dbErr } = await supabaseAdmin.from("result").insert([insertPayload]).select().single();

    if (dbErr) {
      console.error("DB insert failed:", dbErr);
      return NextResponse.json({ error: "Failed to save result", dbErrMessage: (dbErr as any)?.message ?? null, dbErr }, { status: 500 });
    }

    console.log("Insert succeeded id:", inserted?.id);
    return NextResponse.json({ model_response: aiJson, saved: inserted });
  } catch (err: any) {
    console.error("check-resume error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
