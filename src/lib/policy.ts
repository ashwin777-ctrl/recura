import type { ActionType, Decision, DecisionContext } from "./types";
import { REASONS, successProbability } from "./failure-reasons";
import { formatINR, formatPct } from "./money";

/**
 * The recovery policy — the "controlled" part of a controlled financial agent.
 * These stopping rules are enforced deterministically and can NEVER be overridden
 * by the LLM layer. They are what stop the agent from over-dunning a customer.
 */
export const POLICY = {
  maxAttempts: 3,
  /** Below this, a retry costs more in goodwill/fees than it can recover. */
  minRecoverableAmountPaise: 5000, // ₹50
  /** Backoff (hours) before the Nth attempt for funds/method waits. */
  backoffHours: [0, 72, 120],
  /** Shorter waits for clearly transient failures (network/timeouts). */
  transientBackoffHours: [0, 12, 24],
  coolOffHours: 24,
  discount: {
    eligibleMinLtvPaise: 500000, // ₹5,000 lifetime value
    percent: 20,
    eligibleSegments: ["core", "vip"] as string[],
  },
} as const;

export function discountEligible(ctx: DecisionContext): boolean {
  return (
    ctx.customer.ltvPaise >= POLICY.discount.eligibleMinLtvPaise &&
    POLICY.discount.eligibleSegments.includes(ctx.customer.segment)
  );
}

const canRetrySameInstrument = (reason: DecisionContext["reason"]) =>
  reason !== "CARD_EXPIRED" && reason !== "CARD_BLOCKED";

/**
 * Pre-execution hard stops that ABANDON a case cleanly (distinct from exhausting
 * all attempts). Returns a human reason string, or null to proceed.
 */
export function checkAbandon(ctx: DecisionContext): string | null {
  if (ctx.customer.cancelled) {
    return "Customer has cancelled the subscription — halting recovery (no dunning after cancellation).";
  }
  if (ctx.amountPaise < POLICY.minRecoverableAmountPaise) {
    return `Amount ${formatINR(ctx.amountPaise)} is below the ${formatINR(
      POLICY.minRecoverableAmountPaise,
    )} recovery threshold — not economical to retry.`;
  }
  return null;
}

/** The set of actions the agent is ALLOWED to take at this state (excludes stop). */
export function allowedActions(ctx: DecisionContext): ActionType[] {
  const actions: ActionType[] = [];
  if (canRetrySameInstrument(ctx.reason)) {
    actions.push("immediate_retry", "delayed_retry_backoff");
  }
  actions.push("switch_payment_method");
  if (discountEligible(ctx) && !ctx.discountUsed) {
    actions.push("discount_offer");
  }
  return actions;
}

export function delayFor(ctx: DecisionContext, action: ActionType): number {
  const spec = REASONS[ctx.reason];
  if (action !== "delayed_retry_backoff") return 0;
  const table = spec.category === "transient" ? POLICY.transientBackoffHours : POLICY.backoffHours;
  return table[Math.min(ctx.attemptNumber - 1, table.length - 1)];
}

export function confidenceFor(ctx: DecisionContext, action: ActionType): number {
  return successProbability(REASONS[ctx.reason], action, {
    attemptIndex: ctx.attemptNumber - 1,
    engagement: ctx.customer.engagementScore,
    ltvPaise: ctx.customer.ltvPaise,
  });
}

function reasoningFor(ctx: DecisionContext, action: ActionType, delayHours: number): string {
  const spec = REASONS[ctx.reason];
  const pct = formatPct(confidenceFor(ctx, action), 0);
  const n = ctx.attemptNumber;
  const last4 = ctx.cardLast4 ?? "----";
  switch (action) {
    case "immediate_retry":
      if (ctx.reason === "NETWORK_TIMEOUT") {
        return `Network timeout on attempt ${n} — this is almost always transient. Retrying immediately on card ••••${last4}; ~${pct} of timeouts clear on the next try.`;
      }
      return `Issuer declined (do_not_honour). A first decline is often transient noise, so one immediate retry on ••••${last4} before switching rails. ~${pct} expected.`;
    case "delayed_retry_backoff":
      return `${spec.label} on attempt ${n}. Instead of re-charging now, waiting ${delayHours}h for the balance to recover (payday cycle) before retrying. Model expects ~${pct}.`;
    case "switch_payment_method":
      return `${spec.label} — the instrument on file (••••${last4}) cannot clear this charge. Prompting the customer to update their payment method rather than wasting a retry. ~${pct} once updated.`;
    case "discount_offer":
      return `High-value customer (LTV ${formatINR(ctx.customer.ltvPaise)}, ${ctx.customer.tenureMonths}mo tenure) after ${n - 1} failed attempts. Extending a one-time ${POLICY.discount.percent}% win-back to save the subscription before it churns. ~${pct} acceptance.`;
    case "stop":
      return "Stopping recovery.";
  }
}

/**
 * The deterministic policy engine. Given a case's state, choose the next recovery
 * action per a reason-specific playbook. This always runs; the optional LLM layer
 * (see agent.ts) can only re-pick within allowedActions() on top of this.
 */
export function proposeAction(ctx: DecisionContext): Decision {
  // Hard abandons first — these are non-negotiable.
  const abandon = checkAbandon(ctx);
  if (abandon) {
    return {
      actionType: "stop",
      delayHours: 0,
      reasoning: abandon,
      confidence: 0,
      decidedBy: "rules",
    };
  }

  let action: ActionType;
  switch (ctx.reason) {
    case "NETWORK_TIMEOUT":
      // Transient: retry, with a short backoff on later attempts.
      action = ctx.attemptNumber === 1 ? "immediate_retry" : "delayed_retry_backoff";
      break;

    case "INSUFFICIENT_FUNDS":
      if (ctx.attemptNumber >= 3 && discountEligible(ctx) && !ctx.discountUsed) {
        action = "discount_offer";
      } else {
        action = "delayed_retry_backoff";
      }
      break;

    case "BANK_DECLINED":
      if (ctx.attemptNumber === 1) action = "immediate_retry";
      else if (ctx.attemptNumber >= 3 && discountEligible(ctx) && !ctx.discountUsed)
        action = "discount_offer";
      else action = "switch_payment_method";
      break;

    case "CARD_EXPIRED":
    case "CARD_BLOCKED":
      // Never retry a dead instrument. Prompt a new method; escalate to a win-back
      // on the final attempt for eligible high-value customers.
      if (ctx.attemptNumber >= 3 && discountEligible(ctx) && !ctx.discountUsed) {
        action = "discount_offer";
      } else {
        action = "switch_payment_method";
      }
      break;
  }

  const delayHours = delayFor(ctx, action);
  return {
    actionType: action,
    delayHours,
    reasoning: reasoningFor(ctx, action, delayHours),
    confidence: confidenceFor(ctx, action),
    decidedBy: "rules",
  };
}
