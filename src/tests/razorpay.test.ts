import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { POST as webhookHandler } from "@/app/api/webhooks/razorpay/route";
import { prisma } from "@/lib/prisma";
import { RazorpayGateway } from "@/lib/gateway/razorpay";
import { isLiveMode, gatewayMode } from "@/lib/gateway";

describe.sequential("Razorpay Integration & Webhook Security", () => {
  it("1. Verifies HMAC-SHA256 signature check rejects forged webhook requests", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key";

    const payload = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_123" } } } });
    const forgedSignature = "invalid_forged_hmac_signature";

    const req = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: { "x-razorpay-signature": forgedSignature },
      body: payload,
    });

    const res = await webhookHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Invalid signature");
  });

  it("2. Verifies valid HMAC-SHA256 signature accepts webhook and records AuditEvent", async () => {
    const secret = "test_webhook_secret_key";
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;

    const payload = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_valid_999" } } } });
    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const req = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: payload,
    });

    const res = await webhookHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const event = await prisma.auditEvent.findFirst({
      where: { actor: "webhook", message: { contains: "payment.failed" } },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
  });

  it("3. Verifies RazorpayGateway is resilient to network or credential failures", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_invalid_mock_key";
    process.env.RAZORPAY_KEY_SECRET = "invalid_secret";

    const gw = new RazorpayGateway();
    expect(gw.name).toBe("razorpay");

    const ctx = {
      caseId: "case_test_rzp",
      reason: "INSUFFICIENT_FUNDS" as const,
      attemptNumber: 1,
      maxAttempts: 3,
      amountPaise: 299900,
      method: "card" as const,
      cardLast4: "4242",
      customer: {
        id: "cust_1",
        name: "Test User",
        segment: "core" as const,
        engagementScore: 0.8,
        ltvPaise: 500000,
        tenureMonths: 6,
        cancelled: false,
      },
      history: [],
      discountUsed: false,
    };

    const res = await gw.executeRecovery("delayed_retry_backoff", ctx, "42");
    expect(res.gateway).toBe("razorpay");
    expect(res.detail).toContain("[Razorpay test");
  });
});
