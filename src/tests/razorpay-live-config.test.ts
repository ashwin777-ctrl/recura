import { describe, expect, it } from "vitest";
import { describeRazorpayLiveConfig, isRazorpayLiveReady } from "@/lib/razorpay-config";

describe("Razorpay live config", () => {
  it("returns false when a live-mode key is missing", () => {
    const env = {
      RAZORPAY_MODE: "live",
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
      RAZORPAY_WEBHOOK_SECRET: "whsec_demo",
    };

    expect(isRazorpayLiveReady(env)).toBe(false);
    expect(describeRazorpayLiveConfig(env)).toContain("RAZORPAY_KEY_ID");
  });

  it("returns true only when all live-mode values are configured", () => {
    const env = {
      RAZORPAY_MODE: "live",
      RAZORPAY_KEY_ID: "rzp_test_demo",
      RAZORPAY_KEY_SECRET: "demo_secret",
      RAZORPAY_WEBHOOK_SECRET: "whsec_demo",
    };

    expect(isRazorpayLiveReady(env)).toBe(true);
    expect(describeRazorpayLiveConfig(env)).toContain("ready");
  });
});
