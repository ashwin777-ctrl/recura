import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeCase, explainCaseNarrative } from "@/lib/intelligence";
import { REASONS } from "@/lib/failure-reasons";
import type { FailureReasonCode, DecisionContext, ActionType, Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.recoveryCase.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: true,
      actions: { orderBy: { attemptNumber: "asc" } },
    },
  });

  if (!c) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });

  const history: DecisionContext["history"] = c.actions
    .filter((a) => a.executedAt)
    .map((a) => ({
      attemptNumber: a.attemptNumber,
      actionType: a.actionType as ActionType,
      outcome: a.outcome as Outcome,
    }));

  const discountUsed = c.actions.some((a) => a.actionType === "discount_offer" && a.outcome === "success");

  const ctx: DecisionContext = {
    caseId: c.id,
    reason: c.reason as FailureReasonCode,
    attemptNumber: Math.max(1, c.currentAttempt),
    maxAttempts: c.maxAttempts,
    amountPaise: c.amountAtRiskPaise,
    method: c.subscription.method as any,
    cardLast4: c.subscription.cardLast4,
    customer: {
      id: c.customer.id,
      name: c.customer.name,
      segment: c.customer.segment as any,
      engagementScore: c.customer.engagementScore,
      ltvPaise: c.customer.ltvPaise,
      tenureMonths: c.customer.tenureMonths,
      cancelled: c.customer.cancelled,
    },
    history,
    discountUsed,
  };

  const analysis = analyzeCase(ctx);
  const narrative = explainCaseNarrative(analysis, ctx);

  const fullExplanation = `${narrative.overview}\n\n${narrative.scoringBreakdown}\n\n${narrative.recommendation}\n\n**Assessment**: ${narrative.riskAssessment}`;

  return NextResponse.json({
    ok: true,
    explanation: fullExplanation,
    analysis,
    narrative,
  });
}
