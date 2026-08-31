import type { ActionType, FailureReasonCode } from "./types";

// The catalog of failure reasons we recover from. Each spec carries BOTH the
// business metadata and the probability model the simulator draws from — so the
// agent's stated "confidence" and the actual outcome come from one source of truth.

export interface ReasonSpec {
  code: FailureReasonCode;
  label: string;
  description: string;
  /** Representative Razorpay-style error code. */
  razorpayCode: string;
  category: "funds" | "method" | "transient";
  /** P(a retry on the SAME instrument clears), indexed by 0-based recovery attempt. */
  retryProb: number[];
  /** P(the new instrument clears once an engaged customer updates their method). */
  onNewMethodProb: number;
  /** Base P(customer accepts a win-back discount), modulated by LTV/engagement. */
  discountAcceptBase: number;
  /** Relative weight when generating the failed-payment batch. */
  batchWeight: number;
}

export const REASONS: Record<FailureReasonCode, ReasonSpec> = {
  INSUFFICIENT_FUNDS: {
    code: "INSUFFICIENT_FUNDS",
    label: "Insufficient funds",
    description:
      "The account lacked balance at charge time. Shortfalls usually clear around payday, so waiting beats hammering the card.",
    razorpayCode: "BAD_REQUEST_ERROR",
    category: "funds",
    retryProb: [0.12, 0.42, 0.55],
    onNewMethodProb: 0.7,
    discountAcceptBase: 0.45,
    batchWeight: 34,
  },
  CARD_EXPIRED: {
    code: "CARD_EXPIRED",
    label: "Card expired",
    description:
      "The card on file has expired. Retrying the same card can never succeed — the only path is a fresh instrument.",
    razorpayCode: "GATEWAY_ERROR",
    category: "method",
    retryProb: [0.0, 0.0, 0.0],
    onNewMethodProb: 0.9,
    discountAcceptBase: 0.3,
    batchWeight: 22,
  },
  BANK_DECLINED: {
    code: "BANK_DECLINED",
    label: "Bank declined (do_not_honour)",
    description:
      "The issuer declined the charge. Sometimes transient issuer noise, but repeated declines usually need a different rail.",
    razorpayCode: "BAD_REQUEST_ERROR",
    category: "method",
    retryProb: [0.3, 0.22, 0.15],
    onNewMethodProb: 0.62,
    discountAcceptBase: 0.35,
    batchWeight: 24,
  },
  NETWORK_TIMEOUT: {
    code: "NETWORK_TIMEOUT",
    label: "Network timeout",
    description:
      "The charge timed out in transit. Almost always transient — an immediate retry usually clears it.",
    razorpayCode: "GATEWAY_ERROR",
    category: "transient",
    retryProb: [0.8, 0.85, 0.88],
    onNewMethodProb: 0.7,
    discountAcceptBase: 0.3,
    batchWeight: 12,
  },
  CARD_BLOCKED: {
    code: "CARD_BLOCKED",
    label: "Card blocked / lost",
    description:
      "The card was blocked by the issuer (security / lost card). The same card won't clear — a new method is required.",
    razorpayCode: "BAD_REQUEST_ERROR",
    category: "method",
    retryProb: [0.05, 0.05, 0.05],
    onNewMethodProb: 0.85,
    discountAcceptBase: 0.3,
    batchWeight: 8,
  },
};

export const REASON_LIST = Object.values(REASONS);

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

/** P(an engaged customer actually updates their payment method when prompted). */
export function pCustomerUpdatesMethod(engagement: number): number {
  return clamp(0.35 + engagement * 0.5, 0, 0.92);
}

/** P(customer accepts a win-back discount), lifted by high LTV and engagement. */
export function pDiscountAccept(
  spec: ReasonSpec,
  ctx: { engagement: number; ltvPaise: number },
): number {
  let p = spec.discountAcceptBase;
  if (ctx.ltvPaise >= 500000) p += 0.15;
  p += ctx.engagement * 0.2;
  return clamp(p, 0, 0.9);
}

/**
 * The single source of truth for "how likely is this action to recover the payment".
 * Used by the policy engine to report confidence AND by the simulator to draw the
 * actual outcome — so confidence is honest, not decorative.
 */
export function successProbability(
  spec: ReasonSpec,
  action: ActionType,
  ctx: { attemptIndex: number; engagement: number; ltvPaise: number },
): number {
  switch (action) {
    case "immediate_retry":
    case "delayed_retry_backoff": {
      const i = Math.min(Math.max(ctx.attemptIndex, 0), spec.retryProb.length - 1);
      return spec.retryProb[i] ?? 0;
    }
    case "switch_payment_method":
      return pCustomerUpdatesMethod(ctx.engagement) * spec.onNewMethodProb;
    case "discount_offer":
      return pDiscountAccept(spec, ctx);
    case "stop":
      return 0;
  }
}
