import "dotenv/config";
import crypto from "crypto";

const REQUIRED = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] as const;

const CUSTOMER_FAILURES = [
  "insufficient_funds",
  "card_expired",
  "bank_declined",
  "network_timeout",
] as const;

function failIfMissingEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required env vars for live Razorpay test flow: ${missing.join(", ")}. ` +
        "Set them in .env before running this script.",
    );
  }
}

function buildSyntheticSubscriptions(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const reason = CUSTOMER_FAILURES[i % CUSTOMER_FAILURES.length];
    const amountPaise = 49900;
    const customerId = `cust_live_${i + 1}`;
    const subscriptionId = `sub_live_${i + 1}`;

    return {
      customer_id: customerId,
      subscription_id: subscriptionId,
      plan_name: "Pro Monthly",
      amount_paise: amountPaise,
      failure_reason: reason,
      attempt_count: i % 3,
      last_attempt_at: new Date(Date.now() - i * 60_000).toISOString(),
      status: i % 2 === 0 ? "failed" : "active",
      email: `customer${i + 1}@example.in`,
    };
  });
}

function sign(body: unknown, secret: string) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
}

async function createPlan() {
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: {
        name: "Recura Pro Monthly",
        amount: 49900,
        currency: "INR",
        description: "Test plan for synthetic subscription recovery",
      },
      notes: { source: "recura-test-batch" },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Plan creation failed (${res.status}): ${text}`);
  }

  const plan = JSON.parse(text);
  return plan.id as string;
}

async function createSubscription(planId: string, customer: { customer_id: string; email: string }) {
  const body = {
    plan_id: planId,
    customer_id: customer.customer_id,
    total_count: 12,
    quantity: 1,
    customer_notify: 1,
    notes: { source: "recura-test-batch", customer_id: customer.customer_id },
    offer_id: undefined,
  };

  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Subscription creation failed (${res.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function triggerFailedCharge(subscriptionId: string, customer: { customer_id: string; email: string; failure_reason: string }) {
  const payload = {
    entity: "event",
    account_id: "acc_recura_demo",
    event: "payment.failed",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: `pay_${Date.now()}`,
          amount: 49900,
          currency: "INR",
          status: "failed",
          method: "card",
          email: customer.email,
          contact: "+919876543210",
          description: `Subscription charge for ${customer.customer_id}`,
          error_code: "BAD_REQUEST_ERROR",
          error_description: `Payment failed: ${customer.failure_reason}`,
          error_reason: customer.failure_reason,
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
    subscription_id: subscriptionId,
  };

  const signature = sign(payload, process.env.RAZORPAY_WEBHOOK_SECRET!);

  const res = await fetch("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Webhook trigger failed (${res.status}): ${text}`);
  }

  return { ok: true, signature, paymentId: payload.payload.payment.entity.id };
}

async function main() {
  failIfMissingEnv();
  const count = Number(process.env.TEST_BATCH_SIZE ?? 4);
  const syntheticCustomers = buildSyntheticSubscriptions(count);

  console.log("Preparing Razorpay test-mode setup...");
  const planId = await createPlan();
  console.log(`Created plan: ${planId}`);

  const createdSubscriptions = [] as any[];
  for (const customer of syntheticCustomers) {
    const subscription = await createSubscription(planId, customer);
    createdSubscriptions.push({ ...customer, razorpay_subscription_id: subscription.id });
    console.log(`Created subscription ${subscription.id} for ${customer.customer_id}`);
  }

  const firstCustomer = createdSubscriptions[0];
  const result = await triggerFailedCharge(firstCustomer.razorpay_subscription_id, firstCustomer);
  console.log("Webhook verification complete:", result);

  console.log("\nSynthetic customer schema:");
  console.table(syntheticCustomers.slice(0, 3));

  console.log("\nNext steps:");
  console.log("1. Open Razorpay Dashboard → Test Mode → Settings → API Keys");
  console.log("2. Ensure Subscriptions is enabled in test mode");
  console.log("3. Review the app's audit log and webhook ingestion at /api/webhooks/razorpay");
}

main().catch((error) => {
  console.error("Razorpay test batch failed:", error);
  process.exit(1);
});
