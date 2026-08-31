import { NextResponse } from "next/server";
import { runBatch } from "@/lib/engine";
import { computeMetrics } from "@/lib/metrics";
import { RunOptionsSchema } from "@/lib/types";
import { isClaudeAvailable } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const opts = RunOptionsSchema.parse(body ?? {});
    const useLlm = !!opts.useLlm && isClaudeAvailable();
    // The LLM path makes a network call per decision, so cap the batch to stay snappy.
    const limit = opts.limit ?? (useLlm ? 12 : undefined);

    const summary = await runBatch({ useLlm, limit });
    const metrics = await computeMetrics();
    return NextResponse.json({
      ok: true,
      summary,
      ...summary,
      metrics,
      llmRequested: !!opts.useLlm,
      llmUsed: useLlm,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
