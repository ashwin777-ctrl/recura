import { describe, it, expect, vi } from "vitest";
import { decideRecoveryAction } from "@/lib/agent";
import { POLICY, checkAbandon, allowedActions, proposeAction } from "@/lib/policy";
import * as claudeModule from "@/lib/claude";
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

describe.sequential("AI / Agent Quality & Guardrail Audits", () => {
  it("1. Recoverable insufficient-funds case: allows retry backoff and AI picks allowed action", async () => {
    const ctx = mockCtx({ reason: "INSUFFICIENT_FUNDS", attemptNumber: 1 });
    const allowed = allowedActions(ctx);
    expect(allowed).toContain("delayed_retry_backoff");

    vi.spyOn(claudeModule, "isClaudeAvailable").mockReturnValue(true);
    vi.spyOn(claudeModule, "askClaudeForDecision").mockResolvedValue({
      actionType: "delayed_retry_backoff",
      reasoning: "High engagement core customer; balance should recover by payday.",
    });

    const decision = await decideRecoveryAction(ctx, { useLlm: true });
    expect(decision.decidedBy).toBe("claude");
    expect(decision.actionType).toBe("delayed_retry_backoff");
    expect(decision.reasoning).toContain("payday");
    vi.restoreAllMocks();
  });

  it("2. Expired/dead payment instrument: AI CANNOT choose retry, only payment method update or win-back", async () => {
    const ctx = mockCtx({ reason: "CARD_EXPIRED", attemptNumber: 1 });
    const allowed = allowedActions(ctx);
    expect(allowed).not.toContain("immediate_retry");
    expect(allowed).not.toContain("delayed_retry_backoff");
    expect(allowed).toContain("switch_payment_method");

    // Simulate AI attempting an unsafe/disallowed action (immediate_retry on dead card)
    vi.spyOn(claudeModule, "isClaudeAvailable").mockReturnValue(true);
    vi.spyOn(claudeModule, "askClaudeForDecision").mockResolvedValue({
      actionType: "immediate_retry",
      reasoning: "Let's retry anyway.",
    });

    const decision = await decideRecoveryAction(ctx, { useLlm: true });
    // Safety engine must reject the unsafe AI recommendation and fall back to policy
    expect(decision.actionType).toBe("switch_payment_method");
    expect(decision.decidedBy).toBe("rules");
    expect(decision.guardrails).toMatch(/disallows/i);
    vi.restoreAllMocks();
  });

  it("3. Cancelled subscription: hard stop before any AI invocation", async () => {
    const ctx = mockCtx({ customer: { ...mockCtx().customer, cancelled: true } });
    const abandon = checkAbandon(ctx);
    expect(abandon).toMatch(/cancelled/i);

    const spy = vi.spyOn(claudeModule, "askClaudeForDecision");
    const decision = await decideRecoveryAction(ctx, { useLlm: true });
    expect(decision.actionType).toBe("stop");
    expect(decision.decidedBy).toBe("rules");
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("4. Low-value ₹49 case: hard stop before any AI invocation", async () => {
    const ctx = mockCtx({ amountPaise: 4900 }); // Below ₹50 threshold
    const abandon = checkAbandon(ctx);
    expect(abandon).toMatch(/threshold|economical/i);

    const spy = vi.spyOn(claudeModule, "askClaudeForDecision");
    const decision = await decideRecoveryAction(ctx, { useLlm: true });
    expect(decision.actionType).toBe("stop");
    expect(decision.decidedBy).toBe("rules");
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("5. Win-back discount eligibility: restricted to eligible segments on final attempt", async () => {
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
  });

  it("6. Malformed/unsafe AI recommendations: graceful degradation to rules", async () => {
    const ctx = mockCtx();

    // AI throws error (network error or timeout)
    vi.spyOn(claudeModule, "isClaudeAvailable").mockReturnValue(true);
    vi.spyOn(claudeModule, "askClaudeForDecision").mockRejectedValue(new Error("API timeout"));

    const decision = await decideRecoveryAction(ctx, { useLlm: true });
    expect(decision.decidedBy).toBe("rules");
    expect(decision.actionType).toBe("delayed_retry_backoff");
    expect(decision.reasoning).toMatch(/policy engine/i);
    vi.restoreAllMocks();
  });

  it("7. Hallucinated action: rejected and reverted to policy recommendation", async () => {
    const ctx = mockCtx();

    // AI returns hallucinated action not in ActionType
    vi.spyOn(claudeModule, "isClaudeAvailable").mockReturnValue(true);
    vi.spyOn(claudeModule, "askClaudeForDecision").mockResolvedValue({
      actionType: "send_whatsapp_message" as any,
      reasoning: "Let's message the customer.",
    });

    const decision = await decideRecoveryAction(ctx, { useLlm: true });
    expect(decision.actionType).toBe("delayed_retry_backoff");
    expect(decision.decidedBy).toBe("rules");
    expect(decision.guardrails).toMatch(/disallows/i);
    vi.restoreAllMocks();
  });
});
