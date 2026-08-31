import type { ActionType, DecisionContext } from "../types";
import type { ExecutionResult, PaymentGateway } from "./index";
import { SimulationGateway } from "./simulation";

/**
 * Real Razorpay TEST-mode adapter.
 *
 * Honest boundary (documented in README → "What's real vs simulated"):
 * completing an interactive card authorization purely server-side is not possible
 * in test mode, so we (1) make a REAL Razorpay API call to create a test-mode order —
 * proving live connectivity with your keys — and (2) resolve the recovery OUTCOME via
 * the deterministic simulator so batch metrics stay reproducible. Flip on by setting
 * RAZORPAY_MODE=live plus RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.
 */
export class RazorpayGateway implements PaymentGateway {
  readonly name = "razorpay" as const;
  private readonly auth =
    "Basic " +
    Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
    ).toString("base64");
  private readonly sim = new SimulationGateway();

  async executeRecovery(
    action: ActionType,
    ctx: DecisionContext,
    seed: string,
  ): Promise<ExecutionResult> {
    let gatewayRef: string | undefined;
    let note = "";
    try {
      const order = await this.createOrder(ctx.amountPaise);
      gatewayRef = order?.id;
    } catch (e) {
      note = ` [live order call failed: ${(e as Error).message}]`;
    }

    const sim = await this.sim.executeRecovery(action, ctx, seed);
    return {
      ...sim,
      gateway: "razorpay",
      gatewayRef: gatewayRef ?? sim.gatewayRef,
      detail: `[Razorpay test${gatewayRef ? ` · order ${gatewayRef}` : ""}] ${sim.detail}${note}`,
    };
  }

  private async createOrder(amountPaise: number): Promise<{ id: string } | null> {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: this.auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        payment_capture: 1,
        notes: { source: "recura-recovery" },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { id: string };
  }
}
