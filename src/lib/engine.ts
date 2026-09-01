import { prisma } from "./prisma";
import { decideRecoveryAction } from "./agent";
import { getGateway, type PaymentGateway } from "./gateway";
import { REASONS } from "./failure-reasons";
import { ACTION_META, actionLabel } from "./types";
import type {
  ActionType,
  CaseStatus,
  CustomerSegment,
  DecisionContext,
  FailureReasonCode,
  Outcome,
  PaymentMethod,
} from "./types";
import { formatINR } from "./money";

const HOUR_MS = 3_600_000;

export async function getSeed(): Promise<string> {
  const m = await prisma.meta.findUnique({ where: { key: "seed" } });
  return m?.value ?? process.env.RECURA_SEED ?? "42";
}

async function audit(
  caseId: string | null,
  ts: Date,
  actor: string,
  event: string,
  message: string,
  payload?: unknown,
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      caseId: caseId ?? undefined,
      ts,
      actor,
      event,
      message,
      payload: payload ? JSON.stringify(payload) : null,
    },
  });
}

type LoadedCase = Awaited<ReturnType<typeof loadCase>>;

function loadCase(id: string) {
  return prisma.recoveryCase.findUnique({
    where: { id },
    include: { customer: true, subscription: true, actions: true },
  });
}

function buildContext(
  c: NonNullable<LoadedCase>,
  attemptNumber: number,
  history: DecisionContext["history"],
  discountUsed: boolean,
): DecisionContext {
  return {
    caseId: c.id,
    reason: c.reason as FailureReasonCode,
    attemptNumber,
    maxAttempts: c.maxAttempts,
    amountPaise: c.amountAtRiskPaise,
    method: c.subscription.method as PaymentMethod,
    cardLast4: c.subscription.cardLast4,
    customer: {
      id: c.customer.id,
      name: c.customer.name,
      segment: c.customer.segment as CustomerSegment,
      engagementScore: c.customer.engagementScore,
      ltvPaise: c.customer.ltvPaise,
      tenureMonths: c.customer.tenureMonths,
      cancelled: c.customer.cancelled,
    },
    history,
    discountUsed,
  };
}

async function closeCase(
  caseId: string,
  status: CaseStatus,
  closeReason: string,
  at: Date,
  extra: { amountRecoveredPaise?: number; recoveredViaDiscount?: boolean } = {},
  subscriptionId?: string,
): Promise<void> {
  const subId = subscriptionId ?? (await loadCase(caseId))?.subscriptionId;
  if (!subId) return;

  const subStatus =
    status === "recovered"
      ? "recovered"
      : status === "abandoned"
        ? "cancelled"
        : "halted";

  const event =
    status === "recovered" ? "case_recovered" : status === "exhausted" ? "case_exhausted" : "case_abandoned";

  await prisma.$transaction([
    prisma.recoveryCase.update({
      where: { id: caseId },
      data: {
        status,
        closedAt: at,
        closeReason,
        amountRecoveredPaise: extra.amountRecoveredPaise ?? 0,
        recoveredViaDiscount: extra.recoveredViaDiscount ?? false,
      },
    }),
    prisma.subscription.update({
      where: { id: subId },
      data: { status: subStatus },
    }),
    prisma.auditEvent.create({
      data: {
        caseId,
        ts: at,
        actor: "system",
        event,
        message: closeReason,
      },
    }),
  ]);
}

/**
 * Run a single case to a terminal state. Uses a *simulated clock* so scheduled
 * backoffs (e.g. "retry in 3 days") produce realistic timestamps in the audit trail
 * while the batch still completes instantly.
 */
export async function runCase(
  caseId: string,
  opts?: { useLlm?: boolean; seed?: string; gateway?: PaymentGateway },
): Promise<CaseStatus> {
  const seed = opts?.seed ?? (await getSeed());
  const gateway = opts?.gateway ?? getGateway();
  const useLlm = opts?.useLlm ?? false;
  const ctx = { useLlm, seed, gateway };

  const c = await loadCase(caseId);
  if (!c || ["recovered", "exhausted", "abandoned"].includes(c.status)) {
    return (c?.status as CaseStatus) ?? "abandoned";
  }

  let simClock = c.openedAt.getTime();
  let attempt = c.currentAttempt;
  let discountUsed = c.actions.some((a) => a.actionType === "discount_offer");
  const history: DecisionContext["history"] = c.actions
    .filter((a) => a.executedAt)
    .map((a) => ({
      attemptNumber: a.attemptNumber,
      actionType: a.actionType as ActionType,
      outcome: a.outcome as Outcome,
    }));

  // Safety bound well above maxAttempts to guarantee termination.
  for (let guard = 0; guard < c.maxAttempts + 2; guard++) {
    attempt += 1;

    if (attempt > c.maxAttempts) {
      await closeCase(
        caseId,
        "exhausted",
        `Reached the ${c.maxAttempts}-attempt cap without recovery — stopped to avoid over-dunning.`,
        new Date(simClock),
        {},
        c.subscriptionId,
      );
      return "exhausted";
    }

    const decisionCtx = buildContext(c, attempt, history, discountUsed);
    const decision = await decideRecoveryAction(decisionCtx, { useLlm: ctx.useLlm });
    const scheduledFor = new Date(simClock + decision.delayHours * HOUR_MS);

    // Hard stop → abandon cleanly (cancelled customer / below threshold).
    if (decision.actionType === "stop") {
      await prisma.$transaction([
        prisma.recoveryCase.update({
          where: { id: caseId },
          data: {
            status: "abandoned",
            closedAt: scheduledFor,
            closeReason: decision.reasoning,
          },
        }),
        prisma.subscription.update({
          where: { id: c.subscriptionId },
          data: { status: "cancelled" },
        }),
        prisma.recoveryAction.create({
          data: {
            caseId,
            attemptNumber: attempt,
            actionType: "stop",
            decidedBy: decision.decidedBy,
            reasoning: decision.reasoning,
            confidence: decision.confidence,
            guardrails: decision.guardrails ?? null,
            scheduledFor,
            executedAt: scheduledFor,
            outcome: "stopped",
            detail: decision.reasoning,
          },
        }),
        prisma.auditEvent.create({
          data: {
            caseId,
            ts: scheduledFor,
            actor: `agent:${decision.decidedBy}`,
            event: "decision",
            message: `Attempt ${attempt}: ${actionLabel(decision.actionType)} — ${decision.reasoning}`,
            payload: JSON.stringify({
              confidence: decision.confidence,
              score: decision.score,
              classification: decision.classification,
              factors: decision.factors,
              guardrails: decision.guardrails ?? null,
            }),
          },
        }),
        prisma.auditEvent.create({
          data: {
            caseId,
            ts: scheduledFor,
            actor: "system",
            event: "case_abandoned",
            message: decision.reasoning,
          },
        }),
      ]);
      return "abandoned";
    }

    // Advance the simulated clock to the scheduled execution time, then execute.
    simClock = scheduledFor.getTime();
    const result = await ctx.gateway.executeRecovery(decision.actionType, decisionCtx, ctx.seed);

    history.push({
      attemptNumber: attempt,
      actionType: decision.actionType,
      outcome: result.success ? "success" : "failed",
    });
    if (decision.actionType === "discount_offer") discountUsed = true;

    if (result.success) {
      const closeReason = `Recovered ${formatINR(result.chargedAmountPaise)} on attempt ${attempt} via ${actionLabel(decision.actionType)}.`;
      await prisma.$transaction([
        prisma.recoveryCase.update({
          where: { id: caseId },
          data: {
            currentAttempt: attempt,
            status: "recovered",
            closedAt: scheduledFor,
            closeReason,
            amountRecoveredPaise: result.chargedAmountPaise,
            recoveredViaDiscount: decision.actionType === "discount_offer",
          },
        }),
        prisma.subscription.update({
          where: { id: c.subscriptionId },
          data: { status: "recovered" },
        }),
        prisma.recoveryAction.create({
          data: {
            caseId,
            attemptNumber: attempt,
            actionType: decision.actionType,
            decidedBy: decision.decidedBy,
            reasoning: decision.reasoning,
            confidence: decision.confidence,
            guardrails: decision.guardrails ?? null,
            scheduledFor,
            executedAt: scheduledFor,
            outcome: "success",
            amountPaise: result.chargedAmountPaise,
            detail: result.detail,
          },
        }),
        prisma.paymentAttempt.create({
          data: {
            subscriptionId: c.subscriptionId,
            caseId,
            attemptNumber: attempt,
            amountPaise: result.chargedAmountPaise || c.amountAtRiskPaise,
            status: "success",
            failureReason: null,
            failureCode: null,
            gateway: result.gateway,
            gatewayRef: result.gatewayRef,
            detail: result.detail,
          },
        }),
        prisma.auditEvent.create({
          data: {
            caseId,
            ts: scheduledFor,
            actor: `agent:${decision.decidedBy}`,
            event: "decision",
            message: `Attempt ${attempt}: ${actionLabel(decision.actionType)} — ${decision.reasoning}`,
            payload: JSON.stringify({
              confidence: decision.confidence,
              score: decision.score,
              classification: decision.classification,
              factors: decision.factors,
              guardrails: decision.guardrails ?? null,
            }),
          },
        }),
        prisma.auditEvent.create({
          data: {
            caseId,
            ts: scheduledFor,
            actor: "gateway",
            event: "charge_success",
            message: result.detail,
            payload: JSON.stringify({ attempt, gateway: result.gateway, ref: result.gatewayRef }),
          },
        }),
        prisma.auditEvent.create({
          data: {
            caseId,
            ts: scheduledFor,
            actor: "system",
            event: "case_recovered",
            message: closeReason,
          },
        }),
      ]);
      return "recovered";
    } else {
      await prisma.$transaction([
        prisma.recoveryCase.update({
          where: { id: caseId },
          data: { currentAttempt: attempt },
        }),
        prisma.recoveryAction.create({
          data: {
            caseId,
            attemptNumber: attempt,
            actionType: decision.actionType,
            decidedBy: decision.decidedBy,
            reasoning: decision.reasoning,
            confidence: decision.confidence,
            guardrails: decision.guardrails ?? null,
            scheduledFor,
            executedAt: scheduledFor,
            outcome: "failed",
            amountPaise: null,
            detail: result.detail,
          },
        }),
        prisma.paymentAttempt.create({
          data: {
            subscriptionId: c.subscriptionId,
            caseId,
            attemptNumber: attempt,
            amountPaise: result.chargedAmountPaise || c.amountAtRiskPaise,
            status: "failed",
            failureReason: c.reason,
            failureCode: REASONS[c.reason as FailureReasonCode].razorpayCode,
            gateway: result.gateway,
            gatewayRef: result.gatewayRef,
            detail: result.detail,
          },
        }),
        prisma.auditEvent.create({
          data: {
            caseId,
            ts: scheduledFor,
            actor: `agent:${decision.decidedBy}`,
            event: "decision",
            message: `Attempt ${attempt}: ${actionLabel(decision.actionType)} — ${decision.reasoning}`,
            payload: JSON.stringify({
              confidence: decision.confidence,
              score: decision.score,
              classification: decision.classification,
              factors: decision.factors,
              guardrails: decision.guardrails ?? null,
            }),
          },
        }),
        prisma.auditEvent.create({
          data: {
            caseId,
            ts: scheduledFor,
            actor: "gateway",
            event: "charge_failed",
            message: result.detail,
            payload: JSON.stringify({ attempt, gateway: result.gateway, ref: result.gatewayRef }),
          },
        }),
      ]);
    }
  }

  // Unreachable given the guard, but keeps the type checker happy.
  await closeCase(caseId, "exhausted", "Recovery loop terminated by safety guard.", new Date(simClock), {}, c.subscriptionId);
  return "exhausted";
}

/** Process every open case to a terminal state. Returns a run summary. */
export async function runBatch(opts: { useLlm: boolean; limit?: number }): Promise<{
  processed: number;
  recovered: number;
  exhausted: number;
  abandoned: number;
  useLlm: boolean;
}> {
  const seed = await getSeed();
  const gateway = getGateway();
  const cases = await prisma.recoveryCase.findMany({
    where: { status: { in: ["open", "recovering"] } },
    orderBy: { openedAt: "asc" },
    take: opts.limit,
    select: { id: true },
  });

  const tally = { processed: 0, recovered: 0, exhausted: 0, abandoned: 0, useLlm: opts.useLlm };
  const CHUNK_SIZE = 20;
  for (let i = 0; i < cases.length; i += CHUNK_SIZE) {
    const chunk = cases.slice(i, i + CHUNK_SIZE);
    const outcomes = await Promise.all(
      chunk.map(({ id }) => runCase(id, { useLlm: opts.useLlm, seed, gateway })),
    );
    for (const outcome of outcomes) {
      tally.processed++;
      if (outcome === "recovered") tally.recovered++;
      else if (outcome === "exhausted") tally.exhausted++;
      else if (outcome === "abandoned") tally.abandoned++;
    }
  }
  return tally;
}
