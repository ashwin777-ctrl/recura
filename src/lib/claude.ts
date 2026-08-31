import Anthropic from "@anthropic-ai/sdk";
import type { ActionType, Decision, DecisionContext } from "./types";
import { ACTION_META } from "./types";
import { REASONS } from "./failure-reasons";
import { formatINR } from "./money";

export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 1, timeout: 15000 });
  return client;
}

const DECISION_SYSTEM = `You are Recura, a CONTROLLED revenue-recovery agent for a subscription business on Razorpay.
A subscription charge has failed and you must choose the single best next recovery action.

Hard rules you MUST obey:
- Choose ONLY from the "allowedActions" list you are given. Never invent an action.
- Never retry an expired or blocked card — that path is excluded from allowedActions by policy.
- Be frugal and customer-respectful: prefer the cheapest action likely to work; don't propose aggressive discounts when a simple retry will do.
- You are one step in a capped sequence (max attempts enforced outside you). Do not assume unlimited retries.

Return STRICT JSON only, no prose around it:
{"action": "<one value from allowedActions>", "reasoning": "<=240 chars, specific: name the failure reason and why this action + timing is right>"}`;

function extractJson(text: string): { action?: string; reasoning?: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude returned no JSON object");
  return JSON.parse(match[0]);
}

function contextSummary(ctx: DecisionContext) {
  const spec = REASONS[ctx.reason];
  return {
    failureReason: spec.label,
    failureCategory: spec.category,
    attemptNumber: ctx.attemptNumber,
    maxAttempts: ctx.maxAttempts,
    amount: formatINR(ctx.amountPaise),
    paymentMethod: ctx.method,
    cardLast4: ctx.cardLast4 ?? null,
    customer: {
      segment: ctx.customer.segment,
      lifetimeValue: formatINR(ctx.customer.ltvPaise),
      tenureMonths: ctx.customer.tenureMonths,
      engagementScore: Number(ctx.customer.engagementScore.toFixed(2)),
    },
    priorAttempts: ctx.history.map((h) => ({
      attempt: h.attemptNumber,
      action: ACTION_META[h.actionType].label,
      outcome: h.outcome,
    })),
  };
}

/**
 * Ask Claude to choose an action from the allowed set and explain it.
 * The caller (agent.ts) re-validates the choice against policy guardrails — this
 * function is never trusted to enforce stopping rules by itself.
 */
export async function askClaudeForDecision(
  ctx: DecisionContext,
  allowed: ActionType[],
  rulesHint: Decision,
): Promise<{ actionType: ActionType; reasoning: string }> {
  const payload = {
    ...contextSummary(ctx),
    allowedActions: allowed,
    policyRecommendation: rulesHint.actionType,
    policyRationale: rulesHint.reasoning,
  };

  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    system: DECISION_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = extractJson(text);
  const action = String(parsed.action ?? "") as ActionType;
  const reasoning = String(parsed.reasoning ?? "").slice(0, 300);
  return { actionType: action, reasoning };
}

const NARRATE_SYSTEM = `You are Recura, a revenue-recovery agent. Given the full history of a recovery case, explain in 2-3 short sentences, in plain language, what happened and why the decisions were sound (or why stopping was correct). Be concrete and reference the failure reason, the actions taken, and the outcome. No preamble, no markdown headings.`;

/** Live natural-language narration of a whole case — used by the case-detail "Explain" button. */
export async function explainCase(summary: unknown): Promise<string> {
  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: NARRATE_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(summary) }],
  });
  return resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
