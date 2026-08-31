"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

export function ExplainButton({ caseId, available }: { caseId: string; available: boolean }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/explain`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Failed to generate explanation");
      setText(data.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        onClick={run}
        disabled={loading || !available}
        title={available ? "Ask Claude to narrate this case" : "Set ANTHROPIC_API_KEY to enable"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-brand" />
        )}
        Explain with AI
      </Button>
      {text ? (
        <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-4 text-sm leading-relaxed text-fg">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Claude’s read on this case
          </div>
          {text}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-bad">{error}</p> : null}
    </div>
  );
}
