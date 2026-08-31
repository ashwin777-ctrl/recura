import type { Decision, DecisionContext } from "./types";
import { ACTION_META } from "./types";
import { REASONS, successProbability } from "./failure-reasons";
import { allowedActions, confidenceFor, delayFor, proposeAction } from "./policy";
import { askClaudeForDecision, isClaudeAvailable } from "./claude";

/**
 * Decide the next recovery action for a case.
 *
 * Design: the deterministic policy engine ALWAYS produces a candidate. When the LLM
 * layer is enabled and available, Claude may re-pick — but ONLY from the policy's
 * allowedActions set, and it can NEVER override a hard stop. The policy has final
 * say on anything that touches a stopping rule. This is what makes it a *controlled*
 * financial agent rather than a bot that can talk itself into infinite retries.
 */
export async function decideRecoveryAction(
  ctx: DecisionContext,
  opts: { useLlm: boolean },
): Promise<Decision> {
  const rules = proposeAction(ctx);

  // A hard stop (cancelled customer / below threshold) is non-negotiable.
  if (rules.actionType === "stop") return rules;
  if (!opts.useLlm || !isClaudeAvailable()) return rules;

  const allowed = allowedActions(ctx);
  try {
    const llm = await askClaudeForDecision(ctx, allowed, rules);

    // GUARDRAIL: the LLM may only pick an allowed action. Anything else is rejected
    // and we fall back to the policy's choice, recording that we did so.
    const permitted = allowed.includes(llm.actionType);
    const chosen = permitted ? llm.actionType : rules.actionType;
    const spec = REASONS[ctx.reason];

    return {
      actionType: chosen,
      delayHours: delayFor(ctx, chosen),
      reasoning: permitted ? llm.reasoning || rules.reasoning : rules.reasoning,
      confidence: confidenceFor(ctx, chosen),
      decidedBy: permitted ? "claude" : "rules",
      guardrails: permitted
        ? undefined
        : `LLM proposed "${ACTION_META[llm.actionType]?.label ?? llm.actionType}", which policy disallows at attempt ${ctx.attemptNumber}. Fell back to "${ACTION_META[chosen].label}".`,
    };
  } catch {
    // Any LLM failure (no key, timeout, bad JSON) degrades gracefully to the policy.
    return {
      ...rules,
      reasoning: `${rules.reasoning} (AI reasoning layer unavailable — used the policy engine.)`,
    };
  }
}

// Re-export for callers that only need the deterministic path.
export { proposeAction, successProbability };
