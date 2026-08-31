import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { explainCase, isClaudeAvailable } from "@/lib/claude";
import { actionLabel } from "@/lib/types";
import { formatINR } from "@/lib/money";
import { REASONS } from "@/lib/failure-reasons";
import type { FailureReasonCode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isClaudeAvailable()) {
    return NextResponse.json(
      { ok: false, error: "Set ANTHROPIC_API_KEY in .env to enable live AI narration." },
      { status: 400 },
    );
  }
  const c = await prisma.recoveryCase.findUnique({
    where: { id },
    include: { customer: true, subscription: true, actions: { orderBy: { attemptNumber: "asc" } } },
  });
  if (!c) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });

  const summary = {
    failureReason: REASONS[c.reason as FailureReasonCode].label,
    amountAtRisk: formatINR(c.amountAtRiskPaise),
    amountRecovered: formatINR(c.amountRecoveredPaise),
    status: c.status,
    closeReason: c.closeReason,
    customer: {
      segment: c.customer.segment,
      lifetimeValue: formatINR(c.customer.ltvPaise),
      tenureMonths: c.customer.tenureMonths,
      cancelled: c.customer.cancelled,
    },
    timeline: c.actions.map((a) => ({
      attempt: a.attemptNumber,
      action: actionLabel(a.actionType),
      decidedBy: a.decidedBy,
      outcome: a.outcome,
      detail: a.detail,
    })),
  };

  try {
    const explanation = await explainCase(summary);
    return NextResponse.json({ ok: true, explanation });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
