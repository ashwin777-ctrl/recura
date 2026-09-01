import { NextResponse } from "next/server";
import { runBatch } from "@/lib/engine";
import { computeMetrics } from "@/lib/metrics";
import { RunOptionsSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const opts = RunOptionsSchema.parse(body ?? {});
    const useAi = opts.useLlm !== undefined ? opts.useLlm : opts.useIntelligence ?? true;
    const limit = opts.limit ?? (useAi ? 4 : 8);

    const summary = await runBatch({ useLlm: useAi, limit });
    const metrics = await computeMetrics();

    return NextResponse.json({
      ok: true,
      summary,
      ...summary,
      metrics,
      aiUsed: useAi,
      llmUsed: useAi,
      engine: "Recura Recovery Intelligence (Local)",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
