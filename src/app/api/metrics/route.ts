import { NextResponse } from "next/server";
import { computeMetrics, getRuntimeInfo } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const [metrics, runtime] = await Promise.all([computeMetrics(), getRuntimeInfo()]);
  return NextResponse.json({ metrics, runtime });
}
