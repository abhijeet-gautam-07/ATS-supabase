"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    if (!name.trim()) return setMessage({ type: "error", text: "Please enter your full name." });
    if (!email.trim()) return setMessage({ type: "error", text: "Please enter your email." });
    if (password.length < 8) return setMessage({ type: "error", text: "Password must be at least 8 characters." });
    if (password !== confirm) return setMessage({ type: "error", text: "Passwords do not match." });

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        // If immediate session: redirect to upload; otherwise tell user to confirm email.
        if ((data as any)?.user) {
          setMessage({ type: "success", text: "Account created. Redirecting..." });
          router.push("/upload");
        } else {
          setMessage({ type: "success", text: "Signup successful — check your email to confirm." });
        }
      }
      setName("");
      setEmail("");
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message ?? "Unexpected error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100 px-4">
      <div className="w-full max-w-md p-8 bg-white/80 backdrop-blur rounded-xl shadow-xl">
        <h2 className="text-3xl font-semibold text-gray-900 mb-2">Create an account</h2>
        <p className="text-gray-500 text-sm mb-6">Enter your details to register.</p>

        {message && (
          <div className={`mb-4 px-4 py-2 rounded-md text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Full Name</span>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2" placeholder="John Doe" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2" placeholder="you@example.com" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Password</span>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2" placeholder="At least 8 characters" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Confirm Password</span>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2" placeholder="Repeat your password" />
          </label>

          <div className="flex items-center justify-between gap-3">
            <button type="submit" disabled={loading} className="w-full py-2 bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700 transition disabled:opacity-60">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </div>

          <p className="text-sm text-gray-500 pt-1 text-center">
            Already have an account? <Link href="/api/auth/signin" className="text-indigo-600 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
