export type RazorpayEnv = Partial<Record<string, string | undefined>>;

export function isRazorpayLiveReady(env: RazorpayEnv = process.env): boolean {
  return (
    (env.RAZORPAY_MODE ?? "simulation") === "live" &&
    !!env.RAZORPAY_KEY_ID &&
    !!env.RAZORPAY_KEY_SECRET &&
    !!env.RAZORPAY_WEBHOOK_SECRET
  );
}

export function describeRazorpayLiveConfig(env: RazorpayEnv = process.env): string {
  const mode = env.RAZORPAY_MODE ?? "simulation";
  const keyId = env.RAZORPAY_KEY_ID ? "configured" : "missing";
  const secret = env.RAZORPAY_KEY_SECRET ? "configured" : "missing";
  const webhook = env.RAZORPAY_WEBHOOK_SECRET ? "configured" : "missing";

  return `Razorpay mode=${mode}; RAZORPAY_KEY_ID=${keyId}; RAZORPAY_KEY_SECRET=${secret}; RAZORPAY_WEBHOOK_SECRET=${webhook}; ${isRazorpayLiveReady(env) ? "ready" : "not ready"}`;
}
