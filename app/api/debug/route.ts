// app/api/_debug-env/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Only return booleans so we don't leak secrets
  const present = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GEMINI_API_ENDPOINT: !!process.env.GEMINI_API_ENDPOINT,
  };

  console.log("DEBUG ENV CHECK:", present); // server log for convenience
  return NextResponse.json({ present });
}
