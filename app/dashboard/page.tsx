"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "../components/providers/SessionProvider";
import { useRouter } from "next/navigation";

type ResultRow = {
  id: string;
  user_id: string;
  candidate_name?: string | null;
  score: number | null;
  required_skills: string | null;
  feedback: string | null;
  short_summary?: string | null;
  file_url?: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();

  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guard: if session finished loading and no user, redirect to signin
  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/api/auth/signin"); // redirect to signin
    }
  }, [user, sessionLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchResults() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("result")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("fetch results error", error);
        setError(error.message);
        setResults([]);
      } else {
        setResults((data as ResultRow[]) ?? []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // if session is still loading, show loader (prevent flicker)
  if (sessionLoading || !user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-sm text-gray-600">Checking authentication…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Dashboard — Resume Results</h1>

      {loading && <div className="text-sm text-gray-600 mb-4">Loading results…</div>}
      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
      {!loading && results.length === 0 && <div className="text-sm text-gray-600">No results yet. Upload a resume to get started.</div>}

      <div className="space-y-4 mt-4">
        {results.map((r) => {
          const candidate = r.candidate_name ?? "Unknown candidate";
          const preview = r.short_summary ?? (r.feedback ?? "").split("\n")[0] ?? "No summary available";
          const required = r.required_skills ?? "all required skills are there";
          const scoreDisplay = r.score === null || r.score === undefined ? "-" : `${Math.round(r.score)}%`;

          return (
            <article key={r.id} className="border rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold truncate">{candidate}</h3>
                    <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1">{preview}</p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 text-indigo-700 text-xl font-bold">
                    {scoreDisplay}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">Score</div>

                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      aria-expanded={expandedId === r.id}
                      aria-controls={`result-${r.id}`}
                      className="text-sm px-3 py-1 border rounded text-indigo-600 hover:bg-indigo-50"
                    >
                      {expandedId === r.id ? "Collapse" : "View"}
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === r.id && (
                <div id={`result-${r.id}`} className="mt-4 bg-gray-50 p-4 rounded">
                  <h4 className="font-medium mb-2">Required skills</h4>
                  <div className="text-sm mb-3 whitespace-pre-wrap">{required}</div>

                  <h4 className="font-medium mb-2">Feedback</h4>
                  <div className="text-sm whitespace-pre-wrap">{r.feedback}</div>

                  {r.file_url && (
                    <div className="mt-3">
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">
                        Open resume file
                      </a>
                    </div>
                  )}

                  <div className="mt-3 text-sm text-gray-500">Created: {new Date(r.created_at).toLocaleString()}</div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
