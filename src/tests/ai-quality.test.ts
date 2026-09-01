import { describe, it, expect } from "vitest";
import { decideRecoveryAction } from "@/lib/agent";
import { POLICY, checkAbandon, allowedActions } from "@/lib/policy";
import { analyzeCase, explainCaseNarrative } from "@/lib/intelligence";
import type { DecisionContext } from "@/lib/types";

function mockCtx(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    caseId: "case_ai_test",
    reason: "INSUFFICIENT_FUNDS",
    attemptNumber: 1,
    maxAttempts: POLICY.maxAttempts,
    amountPaise: 49900,
    method: "card",
    cardLast4: "4242",
    customer: {
      id: "cust_test",
      name: "Test Customer",
      segment: "core",
      engagementScore: 0.8,
      ltvPaise: 800000,
      tenureMonths: 14,
      cancelled: false,
    },
    history: [],
    discountUsed: false,
    ...overrides,
  };
}

describe.sequential("Recura Recovery Intelligence Engine & Quality Audits", () => {
  it("1. Computes deterministic recovery score (0-100) and HIGH/MEDIUM/LOW classification", () => {
    // High engagement VIP customer with transient timeout
    const highCtx = mockCtx({
      reason: "NETWORK_TIMEOUT",
      customer: { ...mockCtx().customer, segment: "vip", engagementScore: 0.9, ltvPaise: 2500000 },
    });
    const highAnalysis = analyzeCase(highCtx);
    expect(highAnalysis.score).toBeGreaterThanOrEqual(70);
    expect(highAnalysis.classification).toBe("HIGH");
    expect(highAnalysis.factors.length).toBeGreaterThan(0);

    // Moderate engagement new customer with expired card
    const medCtx = mockCtx({
      reason: "CARD_EXPIRED",
      customer: { ...mockCtx().customer, segment: "new", engagementScore: 0.45 },
    });
    const medAnalysis = analyzeCase(medCtx);
    expect(medAnalysis.score).toBeGreaterThanOrEqual(40);
    expect(medAnalysis.score).toBeLessThan(70);
    expect(medAnalysis.classification).toBe("MEDIUM");

    // Low engagement customer after multiple failed attempts
    const lowCtx = mockCtx({
      reason: "CARD_BLOCKED",
      attemptNumber: 3,
      customer: { ...mockCtx().customer, segment: "at_risk", engagementScore: 0.15 },
    });
    const lowAnalysis = analyzeCase(lowCtx);
    expect(lowAnalysis.score).toBeLessThan(40);
    expect(lowAnalysis.classification).toBe("LOW");
  });

  it("2. Factors influence decision: engagement, LTV, failure reason, and prior attempts", () => {
    const fresh = mockCtx({ attemptNumber: 1 });
    const retried = mockCtx({ attemptNumber: 3 });

    const freshScore = analyzeCase(fresh).score;
    const retriedScore = analyzeCase(retried).score;
    // Each failed retry lowers the score
    expect(freshScore).toBeGreaterThan(retriedScore);

    const analysis = analyzeCase(fresh);
    const factorString = analysis.factors.join(" ");
    expect(factorString).toMatch(/engagement|insufficient|pts|rate/i);
  });

  it("3. Expired/blocked card: Intelligence engine recommends updating payment method", () => {
    const expiredCtx = mockCtx({ reason: "CARD_EXPIRED" });
    const blockedCtx = mockCtx({ reason: "CARD_BLOCKED" });

    const expiredAnalysis = analyzeCase(expiredCtx);
    const blockedAnalysis = analyzeCase(blockedCtx);

    expect(expiredAnalysis.recommendedAction).toBe("switch_payment_method");
    expect(blockedAnalysis.recommendedAction).toBe("switch_payment_method");
  });

  it("4. Hard stopping rules: cancelled subscription produces score 0 and immediate stop", async () => {
    const cancelledCtx = mockCtx({ customer: { ...mockCtx().customer, cancelled: true } });
    const abandon = checkAbandon(cancelledCtx);
    expect(abandon).toMatch(/cancelled/i);

    const analysis = analyzeCase(cancelledCtx);
    expect(analysis.score).toBe(0);
    expect(analysis.recommendedAction).toBe("stop");

    const decision = await decideRecoveryAction(cancelledCtx, { useLlm: true });
    expect(decision.actionType).toBe("stop");
    expect(decision.decidedBy).toBe("rules");
  });

  it("5. Hard stopping rules: sub-threshold amounts produce stop action", async () => {
    const lowAmountCtx = mockCtx({ amountPaise: 4900 }); // Below ₹50
    const abandon = checkAbandon(lowAmountCtx);
    expect(abandon).toMatch(/threshold|economical/i);

    const analysis = analyzeCase(lowAmountCtx);
    expect(analysis.recommendedAction).toBe("stop");

    const decision = await decideRecoveryAction(lowAmountCtx, { useLlm: true });
    expect(decision.actionType).toBe("stop");
  });

  it("6. Win-back discount eligibility: restricted to VIP/high-LTV on final attempt", () => {
    // Ineligible customer (low LTV, new segment)
    const ineligible = mockCtx({
      attemptNumber: 3,
      customer: { ...mockCtx().customer, segment: "new", ltvPaise: 50000 },
    });
    expect(allowedActions(ineligible)).not.toContain("discount_offer");

    // Eligible customer (VIP segment, high LTV, final attempt)
    const eligible = mockCtx({
      attemptNumber: 3,
      customer: { ...mockCtx().customer, segment: "vip", ltvPaise: 2500000 },
    });
    expect(allowedActions(eligible)).toContain("discount_offer");
    const analysis = analyzeCase(eligible);
    expect(analysis.recommendedAction).toBe("discount_offer");
  });

  it("7. Generates comprehensive narrative explanation with zero external API calls", () => {
    const ctx = mockCtx();
    const analysis = analyzeCase(ctx);
    const narrative = explainCaseNarrative(analysis, ctx);

    expect(narrative.overview).toContain(ctx.customer.name);
    expect(narrative.scoringBreakdown).toContain(`${analysis.score}/100`);
    expect(narrative.recommendation).toContain(analysis.recommendedAction);
    expect(narrative.riskAssessment).toBeDefined();
  });
});
