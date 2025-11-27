// app/upload/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "../components/providers/SessionProvider";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [checking, setChecking] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/api/auth/signin");
    }
  }, [user, sessionLoading, router]);

  if (sessionLoading || !user) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="text-sm text-gray-600">Checking authentication…</div>
      </div>
    );
  }

  async function handleUploadAndExtract(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be signed in to upload.");
      return;
    }
    if (!file) {
      setError("Please select a file (PDF/DOCX/TXT).");
      return;
    }

    setExtracting(true);
    try {
      const filePath = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Failed to obtain file URL after upload.");

      setUploadedFileUrl(publicUrl);

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: publicUrl }),
      });

      const json = await res.json();
      if (json?.text) {
        setExtractedText(json.text);
      } else {
        setError(json?.error ?? "Extraction failed");
      }
    } catch (err: any) {
      console.error("upload/extract error:", err);
      setError(String(err?.message ?? err));
    } finally {
      setExtracting(false);
    }
  }

  async function handleCheckResume() {
    setError(null);
    if (!user) {
      setError("Sign in first.");
      return;
    }
    if (!extractedText) {
      setError("Please extract or paste resume text before checking.");
      return;
    }
    setChecking(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError("Authentication token not available. Please sign in again.");
        setChecking(false);
        return;
      }

      const res = await fetch("/api/check-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          candidateName: candidateName || "Unknown",
          extractedText,
          jobDescription,
          file_url: uploadedFileUrl ?? null,
        }),
      });

      const json = await res.json().catch(() => ({ error: "Non-JSON response", status: res.status }));
      if (json?.error) {
        setError(json.error || JSON.stringify(json));
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload Resume / Paste Text</h1>

      <form onSubmit={handleUploadAndExtract} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Candidate name (optional)</span>
          <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="John Doe" />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Resume file (PDF, DOCX, TXT)</span>
          <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1" />
        </label>

        <div>
          <button type="submit" disabled={extracting} className="px-4 py-2 bg-indigo-600 text-white rounded">
            {extracting ? "Extracting..." : "Upload & Extract"}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <label className="block text-sm font-medium">Extracted text (editable)</label>
        <textarea value={extractedText} onChange={(e) => setExtractedText(e.target.value)} rows={10} className="mt-1 w-full rounded border px-3 py-2" />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium">Job description (paste)</label>
        <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={6} className="mt-1 w-full rounded border px-3 py-2" />
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={handleCheckResume} disabled={checking} className="px-4 py-2 bg-green-600 text-white rounded">
          {checking ? "Checking..." : "Check Resume"}
        </button>

        {uploadedFileUrl && (
          <a className="px-4 py-2 border rounded text-sm" href={uploadedFileUrl} target="_blank" rel="noopener noreferrer">
            Open uploaded file
          </a>
        )}
      </div>

      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
}
