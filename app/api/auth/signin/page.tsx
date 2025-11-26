"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    if (!email || !password) {
      setMessage({ type: "error", text: "Please enter email and password." });
      return;
    }
    setLoading(true);
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Signed in successfully!" });
        // redirect to upload
        router.push("/upload");
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message ?? "Unexpected error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100 px-4">
      <div className="w-full max-w-md p-8 bg-white/80 backdrop-blur rounded-xl shadow-xl">
        <h2 className="text-3xl font-semibold text-gray-900 mb-2">Welcome Back</h2>
        <p className="text-gray-500 text-sm mb-6">Sign in to continue.</p>

        {message && (
          <div className={`mb-4 px-4 py-2 rounded-md text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Password</span>
            <input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </label>

          <button type="submit" disabled={loading} className="w-full py-2 rounded-md bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 transition disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Don’t have an account?{" "}
          <Link href="/api/auth/signup" className="text-indigo-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
