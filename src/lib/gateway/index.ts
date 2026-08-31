import type { ActionType, DecisionContext } from "../types";
import { SimulationGateway } from "./simulation";
import { RazorpayGateway } from "./razorpay";

export interface ExecutionResult {
  success: boolean;
  /** Amount actually captured (0 on failure; may be discounted on a win-back). */
  chargedAmountPaise: number;
  detail: string;
  gateway: "simulation" | "razorpay";
  gatewayRef?: string;
  methodUpdated?: boolean;
}

export interface PaymentGateway {
  readonly name: "simulation" | "razorpay";
  executeRecovery(
    action: ActionType,
    ctx: DecisionContext,
    seed: string,
  ): Promise<ExecutionResult>;
}

/** True when real Razorpay test-mode keys are configured and live mode is requested. */
export function isLiveMode(): boolean {
  return (
    process.env.RAZORPAY_MODE === "live" &&
    !!process.env.RAZORPAY_KEY_ID &&
    !!process.env.RAZORPAY_KEY_SECRET
  );
}

export function gatewayMode(): "simulation" | "razorpay" {
  return isLiveMode() ? "razorpay" : "simulation";
}

export function getGateway(): PaymentGateway {
  return isLiveMode() ? new RazorpayGateway() : new SimulationGateway();
}
