// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anonKey) {
  console.error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)");
  throw new Error("Missing Supabase env vars");
}

export const supabase = createClient(url, anonKey);

// DEV-only: expose client to window for console debugging (anon client only)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // @ts-ignore
  window.__SUPABASE_CLIENT__ = supabase;
  // @ts-ignore
  window.supabaseDebug = {
    getSession: () => supabase.auth.getSession(),
    getUser: () => supabase.auth.getUser(),
    signOut: () => supabase.auth.signOut(),
  };
  console.log("Supabase debug helpers attached to window.__SUPABASE_CLIENT__ (development only)");
}
