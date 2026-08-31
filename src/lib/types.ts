import { z } from "zod";

// ---- Enum-like unions (stored as strings in SQLite, validated here) ----

export type FailureReasonCode =
  | "INSUFFICIENT_FUNDS"
  | "CARD_EXPIRED"
  | "BANK_DECLINED"
  | "NETWORK_TIMEOUT"
  | "CARD_BLOCKED";

export type ActionType =
  | "immediate_retry"
  | "delayed_retry_backoff"
  | "switch_payment_method"
  | "discount_offer"
  | "stop";

export type CaseStatus =
  | "open"
  | "recovering"
  | "recovered"
  | "exhausted"
  | "abandoned";

export type Outcome = "pending" | "success" | "failed" | "stopped";
export type DecidedBy = "rules" | "claude";
export type CustomerSegment = "new" | "core" | "vip" | "at_risk";
export type PaymentMethod = "card" | "upi" | "netbanking";

// ---- Human labels for actions ----

export const ACTION_META: Record<ActionType, { label: string; short: string }> = {
  immediate_retry: { label: "Immediate retry", short: "Retry now" },
  delayed_retry_backoff: { label: "Delayed retry (backoff)", short: "Delayed retry" },
  switch_payment_method: { label: "Update payment method", short: "Update method" },
  discount_offer: { label: "Win-back discount", short: "Win-back" },
  stop: { label: "Stop recovery", short: "Stop" },
};

export function actionLabel(a: string): string {
  return (ACTION_META as Record<string, { label: string }>)[a]?.label ?? a;
}

export const CASE_STATUS_META: Record<
  CaseStatus,
  { label: string; tone: "good" | "warn" | "bad" | "info" | "neutral" }
> = {
  open: { label: "Open", tone: "info" },
  recovering: { label: "Recovering", tone: "warn" },
  recovered: { label: "Recovered", tone: "good" },
  exhausted: { label: "Exhausted", tone: "bad" },
  abandoned: { label: "Stopped early", tone: "neutral" },
};

// ---- The context the agent reasons over for a single decision ----

export interface DecisionContext {
  caseId: string;
  reason: FailureReasonCode;
  /** The 1-based recovery attempt we are about to decide. */
  attemptNumber: number;
  maxAttempts: number;
  amountPaise: number;
  method: PaymentMethod;
  cardLast4?: string | null;
  customer: {
    id: string;
    name: string;
    segment: CustomerSegment;
    engagementScore: number;
    ltvPaise: number;
    tenureMonths: number;
    cancelled: boolean;
  };
  history: { attemptNumber: number; actionType: ActionType; outcome: Outcome }[];
  discountUsed: boolean;
}

export interface Decision {
  actionType: ActionType;
  /** Hours to wait before executing (drives the simulated backoff schedule). */
  delayHours: number;
  reasoning: string;
  /** Expected recovery probability at decision time (0..1) — same model the gateway draws from. */
  confidence: number;
  decidedBy: DecidedBy;
  /** Present when the policy engine overrode or constrained a raw decision. */
  guardrails?: string;
}

// ---- API request validation ----

export const SeedOptionsSchema = z
  .object({
    customers: z.number().int().min(5).max(300).optional(),
    seed: z.number().int().min(0).optional(),
  })
  .default({});

export const RunOptionsSchema = z
  .object({
    useLlm: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .default({});

export type SeedOptions = z.infer<typeof SeedOptionsSchema>;
export type RunOptions = z.infer<typeof RunOptionsSchema>;

// ---- Runtime/config info surfaced in the UI (kept here so client components can
// import the type without pulling in server-only modules). ----

export interface RuntimeInfo {
  gatewayMode: "simulation" | "razorpay";
  llmAvailable: boolean;
  model: string;
  seed: string;
}
