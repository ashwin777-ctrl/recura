import { describe, it, expect } from "vitest";
import {
  POLICY,
  proposeAction,
  allowedActions,
  checkAbandon,
  discountEligible,
  delayFor,
} from "@/lib/policy";
import { decideRecoveryAction } from "@/lib/agent";
import { successProbability } from "@/lib/failure-reasons";
import { REASONS } from "@/lib/failure-reasons";
import type { DecisionContext, FailureReasonCode } from "@/lib/types";

function ctx(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    caseId: "case_test",
    reason: "INSUFFICIENT_FUNDS",
    attemptNumber: 1,
    maxAttempts: POLICY.maxAttempts,
    amountPaise: 49900,
    method: "card",
    cardLast4: "4242",
    customer: {
      id: "cust_test",
      name: "Test User",
      segment: "core",
      engagementScore: 0.6,
      ltvPaise: 800000,
      tenureMonths: 12,
      cancelled: false,
    },
    history: [],
    discountUsed: false,
    ...overrides,
  };
}

describe("stopping rules (hard guardrails)", () => {
  it("caps attempts at 3", () => {
    expect(POLICY.maxAttempts).toBe(3);
  });

  it("abandons a cancelled customer before any attempt", () => {
    const reason = checkAbandon(ctx({ customer: { ...ctx().customer, cancelled: true } }));
    expect(reason).toMatch(/cancelled/i);
    const decision = proposeAction(ctx({ customer: { ...ctx().customer, cancelled: true } }));
    expect(decision.actionType).toBe("stop");
  });

  it("abandons amounts below the minimum recoverable threshold", () => {
    const small = ctx({ amountPaise: POLICY.minRecoverableAmountPaise - 1 });
    expect(checkAbandon(small)).toMatch(/threshold|economical/i);
    expect(proposeAction(small).actionType).toBe("stop");
  });

  it("proceeds when the customer is active and the amount is worth recovering", () => {
    expect(checkAbandon(ctx())).toBeNull();
  });
});

describe("allowed actions per failure reason", () => {
  it("never allows retrying a dead instrument (expired/blocked card)", () => {
    for (const reason of ["CARD_EXPIRED", "CARD_BLOCKED"] as FailureReasonCode[]) {
      const allowed = allowedActions(ctx({ reason }));
      expect(allowed).not.toContain("immediate_retry");
      expect(allowed).not.toContain("delayed_retry_backoff");
      expect(allowed).toContain("switch_payment_method");
    }
  });

  it("allows same-instrument retries for funds/transient failures", () => {
    const allowed = allowedActions(ctx({ reason: "INSUFFICIENT_FUNDS" }));
    expect(allowed).toContain("immediate_retry");
    expect(allowed).toContain("delayed_retry_backoff");
  });

  it("offers a discount only to eligible customers who haven't used one", () => {
    expect(allowedActions(ctx()).includes("discount_offer")).toBe(true);
    // already used
    expect(allowedActions(ctx({ discountUsed: true }))).not.toContain("discount_offer");
    // ineligible: low LTV
    expect(
      allowedActions(ctx({ customer: { ...ctx().customer, ltvPaise: 10000 } })),
    ).not.toContain("discount_offer");
    // ineligible: new segment
    expect(
      allowedActions(ctx({ customer: { ...ctx().customer, segment: "new" } })),
    ).not.toContain("discount_offer");
  });
});

describe("reason-specific playbook", () => {
  it("expired card → prompt a new method, never a retry", () => {
    expect(proposeAction(ctx({ reason: "CARD_EXPIRED" })).actionType).toBe("switch_payment_method");
  });

  it("network timeout → immediate retry on the first attempt", () => {
    expect(proposeAction(ctx({ reason: "NETWORK_TIMEOUT", attemptNumber: 1 })).actionType).toBe(
      "immediate_retry",
    );
  });

  it("insufficient funds → waits (delayed retry) rather than hammering the card", () => {
    expect(proposeAction(ctx({ reason: "INSUFFICIENT_FUNDS", attemptNumber: 1 })).actionType).toBe(
      "delayed_retry_backoff",
    );
  });

  it("escalates eligible high-value customers to a win-back on the final attempt", () => {
    const d = proposeAction(ctx({ reason: "INSUFFICIENT_FUNDS", attemptNumber: 3 }));
    expect(d.actionType).toBe("discount_offer");
  });
});

describe("backoff schedule", () => {
  it("applies the standard backoff for funds failures and 0h for immediate actions", () => {
    expect(delayFor(ctx({ attemptNumber: 2 }), "delayed_retry_backoff")).toBe(
      POLICY.backoffHours[1],
    );
    expect(delayFor(ctx(), "immediate_retry")).toBe(0);
  });

  it("uses shorter transient backoff for network timeouts", () => {
    expect(delayFor(ctx({ reason: "NETWORK_TIMEOUT", attemptNumber: 2 }), "delayed_retry_backoff")).toBe(
      POLICY.transientBackoffHours[1],
    );
  });
});

describe("confidence is honest (same model the simulator draws from)", () => {
  it("derives retry confidence from the reason's per-attempt probability", () => {
    const spec = REASONS.INSUFFICIENT_FUNDS;
    const p = successProbability(spec, "delayed_retry_backoff", {
      attemptIndex: 1,
      engagement: 0.6,
      ltvPaise: 800000,
    });
    expect(p).toBeCloseTo(spec.retryProb[1], 5);
  });
});

describe("agent guardrail (LLM can never override policy)", () => {
  it("returns the deterministic decision when the LLM layer is off", async () => {
    const d = await decideRecoveryAction(ctx(), { useLlm: false });
    expect(d.decidedBy).toBe("rules");
    expect(d.actionType).toBe(proposeAction(ctx()).actionType);
  });

  it("never proceeds past a hard stop even with the LLM requested", async () => {
    const cancelled = ctx({ customer: { ...ctx().customer, cancelled: true } });
    const d = await decideRecoveryAction(cancelled, { useLlm: true });
    expect(d.actionType).toBe("stop");
    expect(d.decidedBy).toBe("rules");
  });
});
