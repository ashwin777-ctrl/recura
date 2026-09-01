import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRuntimeInfo } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();

  try {
    const [info, caseCount, auditCount] = await Promise.all([
      getRuntimeInfo(),
      prisma.recoveryCase.count(),
      prisma.auditEvent.count(),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      latency: `${dbLatencyMs}ms`,
      database: {
        status: "connected",
        provider: "PostgreSQL (Supabase)",
        records: {
          cases: caseCount,
          auditEvents: auditCount,
        },
      },
      engine: {
        mode: info.gatewayMode,
        seed: info.seed,
        decisionLayers: ["deterministic_policy", "recura_intelligence"],
        maxRetryCap: 3,
      },
      security: {
        hmacVerification: "enabled",
        algorithm: "sha256",
        safeBufferTiming: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: err.message || "Health check query failed",
      },
      { status: 500 },
    );
  }
}
