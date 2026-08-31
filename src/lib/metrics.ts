import { prisma } from "./prisma";
import { REASONS } from "./failure-reasons";
import { POLICY } from "./policy";
import { ACTION_META } from "./types";
import type { ActionType, FailureReasonCode, RuntimeInfo } from "./types";
import { gatewayMode } from "./gateway";
import { isClaudeAvailable } from "./claude";

export interface Metrics {
  totals: {
    cases: number;
    closed: number;
    atRiskPaise: number;
    recoveredCases: number;
    recoveredPaise: number;
    recoveryRateCount: number;
    recoveryRateValue: number;
  };
  funnel: { stage: string; cases: number; amountPaise: number }[];
  statusBreakdown: Record<string, number>;
  byReason: {
    reason: FailureReasonCode;
    label: string;
    cases: number;
    recovered: number;
    atRiskPaise: number;
    recoveredPaise: number;
    rate: number;
  }[];
  byAction: { action: ActionType; label: string; executed: number; succeeded: number; rate: number }[];
  recoveryByAttempt: { attempt: number; recovered: number }[];
  stopping: {
    exhausted: number;
    abandoned: number;
    stoppedCleanly: number;
    avgAttemptsToRecover: number;
    maxAttempts: number;
  };
  discount: { casesRecoveredViaDiscount: number; discountGivenUpPaise: number };
  llm: { casesUsingLlm: number; decisionsByClaude: number; decisionsByRules: number };
}

export async function computeMetrics(): Promise<Metrics> {
  const [cases, actions] = await Promise.all([
    prisma.recoveryCase.findMany({
      select: {
        reason: true,
        status: true,
        amountAtRiskPaise: true,
        amountRecoveredPaise: true,
        recoveredViaDiscount: true,
        currentAttempt: true,
        usedLlm: true,
      },
    }),
    prisma.recoveryAction.findMany({ select: { actionType: true, decidedBy: true, outcome: true } }),
  ]);

  const total = cases.length;
  const atRiskPaise = cases.reduce((s, c) => s + c.amountAtRiskPaise, 0);
  const recoveredCases = cases.filter((c) => c.status === "recovered");
  const recoveredPaise = recoveredCases.reduce((s, c) => s + c.amountRecoveredPaise, 0);
  const attempted = cases.filter((c) => c.currentAttempt >= 1).length;
  const closed = cases.filter((c) =>
    ["recovered", "exhausted", "abandoned"].includes(c.status),
  ).length;

  const statusBreakdown: Record<string, number> = {};
  for (const c of cases) statusBreakdown[c.status] = (statusBreakdown[c.status] ?? 0) + 1;

  // By reason
  const reasonKeys = Object.keys(REASONS) as FailureReasonCode[];
  const byReason = reasonKeys
    .map((reason) => {
      const group = cases.filter((c) => c.reason === reason);
      const rec = group.filter((c) => c.status === "recovered");
      const recValue = rec.reduce((s, c) => s + c.amountRecoveredPaise, 0);
      const atRisk = group.reduce((s, c) => s + c.amountAtRiskPaise, 0);
      return {
        reason,
        label: REASONS[reason].label,
        cases: group.length,
        recovered: rec.length,
        atRiskPaise: atRisk,
        recoveredPaise: recValue,
        rate: group.length ? rec.length / group.length : 0,
      };
    })
    .filter((r) => r.cases > 0);

  // By action (the four real recovery levers)
  const actionKeys: ActionType[] = [
    "immediate_retry",
    "delayed_retry_backoff",
    "switch_payment_method",
    "discount_offer",
  ];
  const byActionReal = actionKeys.map((action) => {
    const executed = actions.filter(
      (a) => a.actionType === action && (a.outcome === "success" || a.outcome === "failed"),
    );
    const succeeded = executed.filter((a) => a.outcome === "success").length;
    return {
      action,
      label: ACTION_META[action].label,
      executed: executed.length,
      succeeded,
      rate: executed.length ? succeeded / executed.length : 0,
    };
  });

  // Recovery by attempt number
  const recoveryByAttempt = [1, 2, 3].map((attempt) => ({
    attempt,
    recovered: recoveredCases.filter((c) => c.currentAttempt === attempt).length,
  }));

  const exhausted = statusBreakdown["exhausted"] ?? 0;
  const abandoned = statusBreakdown["abandoned"] ?? 0;
  const avgAttemptsToRecover = recoveredCases.length
    ? recoveredCases.reduce((s, c) => s + c.currentAttempt, 0) / recoveredCases.length
    : 0;

  const discountCases = recoveredCases.filter((c) => c.recoveredViaDiscount);
  const discountGivenUpPaise = discountCases.reduce(
    (s, c) => s + (c.amountAtRiskPaise - c.amountRecoveredPaise),
    0,
  );

  return {
    totals: {
      cases: total,
      closed,
      atRiskPaise,
      recoveredCases: recoveredCases.length,
      recoveredPaise,
      recoveryRateCount: total ? recoveredCases.length / total : 0,
      recoveryRateValue: atRiskPaise ? recoveredPaise / atRiskPaise : 0,
    },
    funnel: [
      { stage: "Failed payments", cases: total, amountPaise: atRiskPaise },
      { stage: "Recovery attempted", cases: attempted, amountPaise: 0 },
      { stage: "Recovered", cases: recoveredCases.length, amountPaise: recoveredPaise },
    ],
    statusBreakdown,
    byReason,
    byAction: byActionReal,
    recoveryByAttempt,
    stopping: {
      exhausted,
      abandoned,
      stoppedCleanly: exhausted + abandoned,
      avgAttemptsToRecover,
      maxAttempts: POLICY.maxAttempts,
    },
    discount: {
      casesRecoveredViaDiscount: discountCases.length,
      discountGivenUpPaise,
    },
    llm: {
      casesUsingLlm: cases.filter((c) => c.usedLlm).length,
      decisionsByClaude: actions.filter((a) => a.decidedBy === "claude").length,
      decisionsByRules: actions.filter((a) => a.decidedBy === "rules").length,
    },
  };
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  const seedMeta = await prisma.meta.findUnique({ where: { key: "seed" } });
  return {
    gatewayMode: gatewayMode(),
    llmAvailable: isClaudeAvailable(),
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
    seed: seedMeta?.value ?? process.env.RECURA_SEED ?? "42",
  };
}
