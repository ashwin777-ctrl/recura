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
  return prisma.recoveryCase.findUniqueOrThrow({
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
  status: Extract<CaseStatus, "recovered" | "exhausted" | "abandoned">,
  closeReason: string,
  at: Date,
  extra?: { amountRecoveredPaise?: number; recoveredViaDiscount?: boolean },
): Promise<void> {
  const c = await prisma.recoveryCase.update({
    where: { id: caseId },
    data: {
      status,
      closeReason,
      closedAt: at,
      amountRecoveredPaise: extra?.amountRecoveredPaise ?? undefined,
      recoveredViaDiscount: extra?.recoveredViaDiscount ?? undefined,
    },
  });

  const subStatus =
    status === "recovered"
      ? "recovered"
      : status === "abandoned"
        ? "cancelled"
        : "halted";
  await prisma.subscription.update({
    where: { id: c.subscriptionId },
    data: { status: subStatus },
  });

  const event =
    status === "recovered" ? "case_recovered" : status === "exhausted" ? "case_exhausted" : "case_abandoned";
  await audit(caseId, at, "system", event, closeReason);
}

/**
 * Run a single case to a terminal state. Uses a *simulated clock* so scheduled
 * backoffs (e.g. "retry in 3 days") produce realistic timestamps in the audit trail
 * while the batch still completes instantly.
 */
async function runCase(
  caseId: string,
  ctx: { useLlm: boolean; seed: string; gateway: PaymentGateway },
): Promise<CaseStatus> {
  const c = await loadCase(caseId);
  if (["recovered", "exhausted", "abandoned"].includes(c.status)) {
    return c.status as CaseStatus;
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

  await prisma.recoveryCase.update({
    where: { id: caseId },
    data: { status: "recovering", usedLlm: c.usedLlm || ctx.useLlm },
  });

  // Safety bound well above maxAttempts to guarantee termination.
  for (let guard = 0; guard < c.maxAttempts + 2; guard++) {
    attempt += 1;

    if (attempt > c.maxAttempts) {
      await closeCase(
        caseId,
        "exhausted",
        `Reached the ${c.maxAttempts}-attempt cap without recovery — stopped to avoid over-dunning.`,
        new Date(simClock),
      );
      return "exhausted";
    }

    const decisionCtx = buildContext(c, attempt, history, discountUsed);
    const decision = await decideRecoveryAction(decisionCtx, { useLlm: ctx.useLlm });
    const scheduledFor = new Date(simClock + decision.delayHours * HOUR_MS);

    const action = await prisma.recoveryAction.create({
      data: {
        caseId,
        attemptNumber: attempt,
        actionType: decision.actionType,
        decidedBy: decision.decidedBy,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        guardrails: decision.guardrails ?? null,
        scheduledFor,
        outcome: "pending",
      },
    });
    await audit(
      caseId,
      scheduledFor,
      `agent:${decision.decidedBy}`,
      "decision",
      `Attempt ${attempt}: ${actionLabel(decision.actionType)} — ${decision.reasoning}`,
      { confidence: decision.confidence, guardrails: decision.guardrails ?? null },
    );

    // Hard stop → abandon cleanly (cancelled customer / below threshold).
    if (decision.actionType === "stop") {
      await prisma.recoveryAction.update({
        where: { id: action.id },
        data: { outcome: "stopped", executedAt: scheduledFor, detail: decision.reasoning },
      });
      await closeCase(caseId, "abandoned", decision.reasoning, scheduledFor);
      return "abandoned";
    }

    // Advance the simulated clock to the scheduled execution time, then execute.
    simClock = scheduledFor.getTime();
    const result = await ctx.gateway.executeRecovery(decision.actionType, decisionCtx, ctx.seed);

    await prisma.paymentAttempt.create({
      data: {
        subscriptionId: c.subscriptionId,
        caseId,
        attemptNumber: attempt,
        amountPaise: result.chargedAmountPaise || c.amountAtRiskPaise,
        status: result.success ? "success" : "failed",
        failureReason: result.success ? null : c.reason,
        failureCode: result.success ? null : REASONS[c.reason as FailureReasonCode].razorpayCode,
        gateway: result.gateway,
        gatewayRef: result.gatewayRef,
        detail: result.detail,
      },
    });
    await prisma.recoveryAction.update({
      where: { id: action.id },
      data: {
        executedAt: scheduledFor,
        outcome: result.success ? "success" : "failed",
        amountPaise: result.success ? result.chargedAmountPaise : null,
        detail: result.detail,
      },
    });
    await audit(
      caseId,
      scheduledFor,
      "gateway",
      result.success ? "charge_success" : "charge_failed",
      result.detail,
      { attempt, gateway: result.gateway, ref: result.gatewayRef },
    );

    history.push({
      attemptNumber: attempt,
      actionType: decision.actionType,
      outcome: result.success ? "success" : "failed",
    });
    if (decision.actionType === "discount_offer") discountUsed = true;

    await prisma.recoveryCase.update({
      where: { id: caseId },
      data: { currentAttempt: attempt },
    });

    if (result.success) {
      await closeCase(
        caseId,
        "recovered",
        `Recovered ${formatINR(result.chargedAmountPaise)} on attempt ${attempt} via ${actionLabel(decision.actionType)}.`,
        scheduledFor,
        {
          amountRecoveredPaise: result.chargedAmountPaise,
          recoveredViaDiscount: decision.actionType === "discount_offer",
        },
      );
      return "recovered";
    }
    // else: loop to the next attempt (backoff applied on scheduling)
  }

  // Unreachable given the guard, but keeps the type checker happy.
  await closeCase(caseId, "exhausted", "Recovery loop terminated by safety guard.", new Date(simClock));
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
  for (const { id } of cases) {
    const outcome = await runCase(id, { useLlm: opts.useLlm, seed, gateway });
    tally.processed++;
    if (outcome === "recovered") tally.recovered++;
    else if (outcome === "exhausted") tally.exhausted++;
    else if (outcome === "abandoned") tally.abandoned++;
  }
  return tally;
}
