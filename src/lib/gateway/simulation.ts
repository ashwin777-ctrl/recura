import type { ActionType, DecisionContext } from "../types";
import type { ExecutionResult, PaymentGateway } from "./index";
import { rand01, randInt } from "../rng";
import { REASONS, successProbability } from "../failure-reasons";
import { POLICY } from "../policy";
import { formatINR } from "../money";

/**
 * Deterministic payment simulator. The outcome for a given (seed, case, attempt,
 * action) is fixed, so an entire batch replays identically — the basis for honest,
 * reproducible recovery metrics. Success probabilities come from the SAME model the
 * agent uses to report confidence (see failure-reasons.ts), so we never quote a
 * number we don't actually draw against.
 */
export class SimulationGateway implements PaymentGateway {
  readonly name = "simulation" as const;

  async executeRecovery(
    action: ActionType,
    ctx: DecisionContext,
    seed: string,
  ): Promise<ExecutionResult> {
    const spec = REASONS[ctx.reason];
    const key = `${seed}:${ctx.caseId}:${ctx.attemptNumber}:${action}`;
    const roll = rand01(key);
    const p = successProbability(spec, action, {
      attemptIndex: ctx.attemptNumber - 1,
      engagement: ctx.customer.engagementScore,
      ltvPaise: ctx.customer.ltvPaise,
    });
    const success = roll < p;

    const last4 = ctx.cardLast4 ?? "----";
    const gatewayRef = `sim_pay_${randInt(key + ":ref", 100000, 999999)}`;
    const full = ctx.amountPaise;
    const discounted = Math.round(full * (1 - POLICY.discount.percent / 100));

    let detail = "No-op.";
    let chargedAmountPaise = 0;
    let methodUpdated = false;

    switch (action) {
      case "immediate_retry":
      case "delayed_retry_backoff":
        if (success) {
          chargedAmountPaise = full;
          detail = `Re-charged ${formatINR(full)} on card ••••${last4} — authorised.`;
        } else {
          detail = `Retry on ••••${last4} declined again (${spec.label.toLowerCase()}).`;
        }
        break;

      case "switch_payment_method":
        if (success) {
          chargedAmountPaise = full;
          methodUpdated = true;
          const newLast4 = String(randInt(key + ":new", 1000, 9999));
          detail = `Customer updated payment method (now card ••••${newLast4}); ${formatINR(full)} captured.`;
        } else {
          detail = `"Update payment method" prompt delivered; customer hasn't updated yet — no capture.`;
        }
        break;

      case "discount_offer":
        if (success) {
          chargedAmountPaise = discounted;
          detail = `Customer accepted the ${POLICY.discount.percent}% win-back; ${formatINR(discounted)} captured (subscription saved).`;
        } else {
          detail = `Win-back offer delivered; customer declined — no capture.`;
        }
        break;
    }

    return { success, chargedAmountPaise, detail, gateway: "simulation", gatewayRef, methodUpdated };
  }
}
