"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignOutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // after sign out, redirect to signup (replace history so back button doesn't return to protected pages)
      router.replace("/api/auth/signup");
    } catch (err: any) {
      setError(err.message ?? "Sign out failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white/90 p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Sign out</h2>
        <p className="text-sm text-gray-600 mb-4">Click the button to sign out and return to signup.</p>

        {error && <div className="mb-3 text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Signing out..." : "Sign out"}
          </button>

          <button
            onClick={() => router.replace("/")}
            className="px-4 py-2 border rounded text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
