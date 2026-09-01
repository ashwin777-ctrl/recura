import type { DecisionContext, ActionType, FailureReasonCode, CustomerSegment, PaymentMethod } from "./types";
import { POLICY, discountEligible } from "./policy";
import { formatINR } from "./money";
import { REASONS } from "./failure-reasons";

export interface IntelligenceAnalysis {
  score: number; // 0..100
  classification: "HIGH" | "MEDIUM" | "LOW";
  factors: string[];
  recommendedAction: ActionType;
  delayHours: number;
  reasoning: string;
  confidence: number;
  guardrails: string[];
}

/**
 * Recura Recovery Intelligence Engine
 *
 * Deterministic local intelligence engine that analyzes customer behavior,
 * historical gateway telemetry, transaction parameters, and policy constraints
 * to compute a recovery likelihood score (0-100), classify risk, and choose
 * the optimal intervention without any external API calls.
 */
export function analyzeCase(ctx: DecisionContext): IntelligenceAnalysis {
  const guardrails: string[] = [];
  const factors: string[] = [];

  // 1. HARD POLICY GUARDRAILS (Highest Priority)
  if (ctx.customer.cancelled) {
    guardrails.push("Customer subscription explicitly cancelled — stopped to respect opt-out.");
    return {
      score: 0,
      classification: "LOW",
      factors: ["Customer has explicitly cancelled subscription", "Policy prohibits chasing churned accounts"],
      recommendedAction: "stop",
      delayHours: 0,
      reasoning: "Customer subscription is cancelled — stopping recovery immediately to honor customer intent.",
      confidence: 1.0,
      guardrails,
    };
  }

  if (ctx.amountPaise < POLICY.minRecoverableAmountPaise) {
    guardrails.push(`Amount (${formatINR(ctx.amountPaise)}) is below economic recovery threshold (${formatINR(POLICY.minRecoverableAmountPaise)})`);
    return {
      score: 5,
      classification: "LOW",
      factors: [`Charge amount ${formatINR(ctx.amountPaise)} is below recovery threshold ${formatINR(POLICY.minRecoverableAmountPaise)}`, "Gateway processing and messaging costs exceed recoverable value"],
      recommendedAction: "stop",
      delayHours: 0,
      reasoning: `Amount ${formatINR(ctx.amountPaise)} is below minimum threshold ${formatINR(POLICY.minRecoverableAmountPaise)} — stopped as uneconomical.`,
      confidence: 0.95,
      guardrails,
    };
  }

  if (ctx.attemptNumber > ctx.maxAttempts) {
    guardrails.push(`Exceeded maximum retry cap of ${ctx.maxAttempts} attempts`);
    return {
      score: 0,
      classification: "LOW",
      factors: [`Maximum attempt cap of ${ctx.maxAttempts} reached`, "Enforcing anti-harassment stopping rule"],
      recommendedAction: "stop",
      delayHours: 0,
      reasoning: `Attempt count (${ctx.attemptNumber}) exceeded ${ctx.maxAttempts}-attempt ceiling — stopping to prevent over-dunning.`,
      confidence: 1.0,
      guardrails,
    };
  }

  // 2. BASELINE SCORE BY FAILURE REASON
  let score = 50;

  switch (ctx.reason) {
    case "NETWORK_TIMEOUT":
      score = 85;
      factors.push("Transient gateway timeout: 85% baseline retry success rate");
      break;
    case "INSUFFICIENT_FUNDS":
      score = 65;
      factors.push("Insufficient funds: responds strongly to salary/optimal-window scheduling");
      break;
    case "CARD_EXPIRED":
      score = 55;
      factors.push("Card expired: high conversion when customer receives update prompt");
      break;
    case "BANK_DECLINED":
      score = 45;
      factors.push("Bank declined: requires instrument switch or issuer retry window");
      break;
    case "CARD_BLOCKED":
      score = 35;
      factors.push("Card blocked/stolen: instrument invalid, requires fresh payment method");
      break;
  }

  // 3. ENGAGEMENT MODIFIER (-20 to +25)
  const eng = ctx.customer.engagementScore;
  if (eng >= 0.75) {
    score += 20;
    factors.push(`High customer engagement (${(eng * 100).toFixed(0)}%): fast prompt response`);
  } else if (eng >= 0.5) {
    score += 8;
    factors.push(`Moderate engagement (${(eng * 100).toFixed(0)}%)`);
  } else if (eng < 0.25) {
    score -= 15;
    factors.push(`Low customer engagement (${(eng * 100).toFixed(0)}%): higher risk of passive churn`);
  }

  // 4. LTV & SEGMENT MODIFIER (-10 to +15)
  if (ctx.customer.segment === "vip") {
    score += 15;
    factors.push(`VIP segment (LTV ${formatINR(ctx.customer.ltvPaise)}): prioritized for white-glove retention`);
  } else if (ctx.customer.segment === "core") {
    score += 8;
    factors.push(`Core customer with established tenure (${ctx.customer.tenureMonths} months)`);
  } else if (ctx.customer.segment === "at_risk") {
    score -= 10;
    factors.push("At-risk customer segment: lower baseline retention propensity");
  }

  // 5. ATTEMPT NUMBER PENALTY (-12 per previous attempt)
  const attemptPenalty = (ctx.attemptNumber - 1) * 14;
  if (attemptPenalty > 0) {
    score -= attemptPenalty;
    factors.push(`Prior failed attempts (${ctx.attemptNumber - 1}) reduced recovery likelihood by -${attemptPenalty} pts`);
  }

  // 6. PAYMENT METHOD MODIFIER
  if (ctx.method === "upi") {
    score += 5;
    factors.push("UPI AutoPay: instant authorization & zero card-expiry risk");
  } else if (ctx.method === "netbanking") {
    score -= 5;
    factors.push("NetBanking: higher drop-off during manual redirect flows");
  }

  // Clamp score to [5, 98]
  score = Math.max(5, Math.min(98, Math.round(score)));

  // 7. CLASSIFICATION
  const classification: "HIGH" | "MEDIUM" | "LOW" =
    score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

  // 8. OPTIMAL ACTION RECOMMENDATION
  let recommendedAction: ActionType = "delayed_retry_backoff";
  let delayHours = 24;
  let reasoning = "";

  const isFinalAttempt = ctx.attemptNumber === ctx.maxAttempts;
  const isDiscountEligible = discountEligible(ctx) && !ctx.discountUsed;

  if (ctx.reason === "NETWORK_TIMEOUT") {
    if (ctx.attemptNumber === 1) {
      recommendedAction = "immediate_retry";
      delayHours = 0;
      reasoning = `Transient network timeout detected (${score}/100 score). Retrying immediately while customer session/context is active.`;
    } else {
      recommendedAction = "delayed_retry_backoff";
      delayHours = POLICY.transientBackoffHours[ctx.attemptNumber - 1] ?? 12;
      reasoning = `Transient network timeout. Backing off ${delayHours}h to allow upstream gateway recovery.`;
    }
  } else if (ctx.reason === "INSUFFICIENT_FUNDS") {
    if (isFinalAttempt && isDiscountEligible) {
      recommendedAction = "discount_offer";
      delayHours = 24;
      reasoning = `Final attempt for high-value customer (${ctx.customer.name}, LTV ${formatINR(ctx.customer.ltvPaise)}). Applying 20% win-back retention discount to prevent churn.`;
    } else {
      recommendedAction = "delayed_retry_backoff";
      delayHours = POLICY.backoffHours[ctx.attemptNumber - 1] ?? 72;
      reasoning = `Insufficient funds (${score}/100 score). Scheduling retry after ${delayHours}h backoff to align with liquidity/payday cycle.`;
    }
  } else if (ctx.reason === "CARD_EXPIRED" || ctx.reason === "CARD_BLOCKED") {
    recommendedAction = "switch_payment_method";
    delayHours = 12;
    reasoning = `${ctx.reason === "CARD_EXPIRED" ? "Card expired" : "Card blocked"}. Payment instrument cannot be retried — prompting customer to update card or UPI mandate.`;
  } else if (ctx.reason === "BANK_DECLINED") {
    if (ctx.attemptNumber >= 2) {
      recommendedAction = "switch_payment_method";
      delayHours = 24;
      reasoning = `Bank declined card on multiple attempts. Prompting customer for alternate card or UPI payment method.`;
    } else {
      recommendedAction = "delayed_retry_backoff";
      delayHours = 48;
      reasoning = `Issuer bank declined charge. Allowing 48h settlement buffer before second attempt.`;
    }
  }

  const confidence = Number((0.7 + (score / 100) * 0.28).toFixed(2));

  return {
    score,
    classification,
    factors,
    recommendedAction,
    delayHours,
    reasoning,
    confidence,
    guardrails,
  };
}

/**
 * Generate full contextual narrative for a recovery case.
 */
export function explainCaseNarrative(analysis: IntelligenceAnalysis, ctx: DecisionContext): {
  overview: string;
  scoringBreakdown: string;
  recommendation: string;
  riskAssessment: string;
} {
  const segmentLabel = ctx.customer.segment.toUpperCase();
  const amountStr = formatINR(ctx.amountPaise);
  const spec = REASONS[ctx.reason];

  return {
    overview: `Recovery case for **${ctx.customer.name}** (${segmentLabel} segment, LTV ${formatINR(ctx.customer.ltvPaise)}). Charge of **${amountStr}** failed due to **${spec.label}** on attempt ${ctx.attemptNumber}/${ctx.maxAttempts}.`,
    scoringBreakdown: `The intelligence engine assigned a **${analysis.score}/100 recovery score** (${analysis.classification} likelihood). Key signals: ${analysis.factors.join("; ")}.`,
    recommendation: `Recommended intervention: **${analysis.recommendedAction}** with a ${analysis.delayHours}h delay. ${analysis.reasoning}`,
    riskAssessment: analysis.score >= 70
      ? "Low churn risk: customer exhibits high engagement and recoverable failure signals."
      : analysis.score >= 40
      ? "Moderate churn risk: recovery depends on timely customer response to self-serve update prompts."
      : "Elevated churn risk: approaching maximum retry threshold or showing low platform engagement.",
  };
}
