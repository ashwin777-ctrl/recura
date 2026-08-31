"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Sparkles, RotateCcw, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { RuntimeInfo } from "@/lib/types";

type Busy = null | "seed" | "run" | "run-llm" | "reset";

export function Controls({ info }: { info: RuntimeInfo }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function call(kind: Busy, url: string, body?: unknown) {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      setMsg(summarize(kind, data));
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button
        variant="primary"
        onClick={() => call("run", "/api/engine/run", { useLlm: false })}
        disabled={disabled}
      >
        {busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run recovery batch
      </Button>

      <Button
        variant="secondary"
        onClick={() => call("run-llm", "/api/engine/run", { useLlm: true, limit: 12 })}
        disabled={disabled || !info.llmAvailable}
        title={
          info.llmAvailable
            ? "Run up to 12 cases with Claude reasoning in the loop"
            : "Set ANTHROPIC_API_KEY to enable the Claude agent"
        }
      >
        {busy === "run-llm" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-brand" />
        )}
        Run with AI
      </Button>

      <div className="mx-1 h-6 w-px bg-border" />

      <Button
        variant="ghost"
        onClick={() => call("seed", "/api/seed")}
        disabled={disabled}
        title="Regenerate the synthetic failed-payment batch (same seed → same data)"
      >
        {busy === "seed" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        Re-seed
      </Button>

      <Button variant="ghost" onClick={() => call("reset", "/api/reset")} disabled={disabled}>
        {busy === "reset" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Reset
      </Button>

      {msg ? <span className="ml-1 text-xs text-muted">{msg}</span> : null}
    </div>
  );
}

function summarize(kind: Busy, data: Record<string, unknown>): string {
  if (kind === "seed") return `Seeded ${data.customers ?? "?"} customers.`;
  if (kind === "reset") return "Database reset.";
  if (kind === "run" || kind === "run-llm") {
    const p = data.processed ?? 0;
    const r = data.recovered ?? 0;
    const mode = data.useLlm ? "with Claude" : "rules-only";
    return `Processed ${p} cases ${mode} — ${r} recovered.`;
  }
  return "Done.";
}
