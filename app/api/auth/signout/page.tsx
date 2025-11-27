// app/api/auth/signout/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignOutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // close on Escape
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.replace("/"); // or router.back()
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // click outside the card -> close
  function onOverlayClick(e: React.MouseEvent) {
    if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
      router.replace("/"); // close overlay and go home (or signin)
    }
  }

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message ?? "Sign out failed");
        setLoading(false);
        return;
      }
      // replace history so back won't return to protected pages
      router.replace("/api/auth/signup");
    } catch (err: any) {
      setError(err?.message ?? "Sign out failed");
      setLoading(false);
    }
  };

  return (
    // full-screen overlay so sidebar is visually covered
    <div
      ref={overlayRef}
      onClick={onOverlayClick}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-8 bg-black/40 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      {/* card - centered and rectangular on larger screens */}
      <div
        ref={cardRef}
        className="w-full max-w-2xl mx-auto mt-12 sm:mt-0 bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden transform transition-all"
        role="document"
        onClick={(e) => e.stopPropagation()} // prevent overlay click when interacting inside
      >
        <div className="px-8 py-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg
                className="h-10 w-10 text-indigo-600"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M16 13v-2H7V8l-5 4 5 4v-3z" opacity="0.9" />
                <path d="M20 3H10a2 2 0 00-2 2v4h2V5h10v14H10v-4H8v4a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Sign out</h2>
              <p className="mt-1 text-sm text-gray-500">
                You are about to sign out. After signing out you will be redirected to the signup page.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="px-4 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Signing out...
                </>
              ) : (
                "Sign out"
              )}
            </button>
          </div>
        </div>

        <div className="px-8 py-3 bg-gray-50 text-xs text-gray-500">
          If you signed out by mistake, sign back in from the sign-in page.
        </div>
      </div>
    </div>
  );
}
