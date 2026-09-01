import type { Decision, DecisionContext } from "./types";
import { ACTION_META } from "./types";
import { REASONS, successProbability } from "./failure-reasons";
import { allowedActions, confidenceFor, delayFor, proposeAction } from "./policy";
import { analyzeCase } from "./intelligence";

/**
 * Decide the next recovery action for a case.
 *
 * Architecture:
 * 1. The deterministic policy engine produces baseline action proposals.
 * 2. When AI / intelligence mode is requested, the local Recura Recovery Intelligence Engine
 *    analyzes all customer features, LTV, engagement, and retry history to compute a
 *    score (0-100), classification, and optimal action.
 * 3. HARD GUARDRAILS: The intelligence engine's action MUST be within the policy's allowedActions
 *    set and can NEVER override a hard stop (max attempts, cancellations, minimum amount).
 */
export async function decideRecoveryAction(
  ctx: DecisionContext,
  opts: { useLlm?: boolean; useIntelligence?: boolean } = {},
): Promise<Decision> {
  const rules = proposeAction(ctx);

  // A hard stop (cancelled customer / below threshold) is non-negotiable.
  if (rules.actionType === "stop") return rules;

  const useAi = opts.useLlm || opts.useIntelligence;
  if (!useAi) return rules;

  const allowed = allowedActions(ctx);
  const analysis = analyzeCase(ctx);

  // GUARDRAIL: the AI engine may only pick an allowed action.
  const permitted = allowed.includes(analysis.recommendedAction);
  const chosen = permitted ? analysis.recommendedAction : rules.actionType;

  return {
    actionType: chosen,
    delayHours: analysis.delayHours ?? delayFor(ctx, chosen),
    reasoning: permitted ? analysis.reasoning : rules.reasoning,
    confidence: analysis.confidence ?? confidenceFor(ctx, chosen),
    decidedBy: permitted ? "ai" : "rules",
    score: analysis.score,
    classification: analysis.classification,
    factors: analysis.factors,
    guardrails: permitted
      ? undefined
      : `AI proposed "${ACTION_META[analysis.recommendedAction]?.label ?? analysis.recommendedAction}", which policy disallows at attempt ${ctx.attemptNumber}. Fell back to "${ACTION_META[chosen].label}".`,
  };
}

// Re-export for callers that need the deterministic path.
export { proposeAction, successProbability };
