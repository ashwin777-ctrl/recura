import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventType = body.eventType || body.event || "payment.failed";
    const { customerName, email, failureReason, caseId } = body;
    const amount = body.amountPaise || (body.amountInr ? Number(body.amountInr) * 100 : 99900);

    const paymentId = `pay_sim_${Math.random().toString(36).slice(2, 10)}`;
    const subscriptionId = `sub_sim_${Math.random().toString(36).slice(2, 10)}`;
    const now = Math.floor(Date.now() / 1000);

    let payload: Record<string, any> = {};

    if (eventType === "payment.failed") {
      payload = {
        entity: "event",
        account_id: "acc_recura_demo",
        event: "payment.failed",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: paymentId,
              amount: amount,
              currency: "INR",
              status: "failed",
              order_id: `order_${Math.random().toString(36).slice(2, 8)}`,
              invoice_id: `inv_${Math.random().toString(36).slice(2, 8)}`,
              international: false,
              method: "card",
              amount_refunded: 0,
              refund_status: null,
              captured: false,
              description: `Subscription charge for ${customerName || "Test Customer"}`,
              card_id: `card_${Math.random().toString(36).slice(2, 8)}`,
              card: {
                id: `card_${Math.random().toString(36).slice(2, 8)}`,
                entity: "card",
                name: customerName || "Test Customer",
                last4: "4242",
                network: "Visa",
                type: "credit",
                issuer: "HDFC",
                international: false,
                emi: false,
                sub_type: "consumer",
              },
              bank: null,
              wallet: null,
              vpa: null,
              email: email || "customer@example.com",
              contact: "+919876543210",
              error_code: "BAD_REQUEST_ERROR",
              error_description: `Payment failed: ${failureReason || "INSUFFICIENT_FUNDS"}`,
              error_source: "issuer",
              error_step: "payment_authorization",
              error_reason: failureReason || "INSUFFICIENT_FUNDS",
              created_at: now,
            },
          },
        },
        created_at: now,
      };
    } else if (eventType === "payment.authorized" || eventType === "payment.captured") {
      payload = {
        entity: "event",
        account_id: "acc_recura_demo",
        event: eventType,
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: paymentId,
              amount: amount,
              currency: "INR",
              status: "captured",
              method: "upi",
              captured: true,
              email: email || "customer@example.com",
              contact: "+919876543210",
              created_at: now,
            },
          },
        },
        created_at: now,
      };
    } else if (eventType === "subscription.cancelled") {
      payload = {
        entity: "event",
        account_id: "acc_recura_demo",
        event: "subscription.cancelled",
        contains: ["subscription"],
        payload: {
          subscription: {
            entity: {
              id: subscriptionId,
              plan_id: "plan_pro_monthly",
              customer_id: `cust_${Math.random().toString(36).slice(2, 8)}`,
              status: "cancelled",
              current_start: now - 86400 * 30,
              current_end: now,
              ended_at: now,
              quantity: 1,
              notes: {
                reason: "Customer requested cancellation via portal",
              },
              charge_at: null,
              start_at: now - 86400 * 30,
              end_at: now,
              auth_attempts: 0,
              total_count: 12,
              paid_count: 3,
              customer_notify: true,
              created_at: now - 86400 * 30,
              expire_by: null,
              short_url: null,
              has_scheduled_changes: false,
              change_scheduled_at: null,
              source: "api",
            },
          },
        },
        created_at: now,
      };
    } else {
      payload = {
        entity: "event",
        event: eventType || "custom.event",
        account_id: "acc_recura_demo",
        payload: { test: true, timestamp: now },
        created_at: now,
      };
    }

    const payloadRaw = JSON.stringify(payload, null, 2);
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "sim_secret_recura_dev";
    const signature = crypto.createHmac("sha256", secret).update(payloadRaw).digest("hex");

    // Record the webhook event to audit trail
    const auditRecord = await prisma.auditEvent.create({
      data: {
        ts: new Date(),
        actor: "webhook",
        event: `razorpay.${eventType}`,
        caseId: caseId || undefined,
        message: `[Sandbox Simulator] Dispatched ${eventType} event (Payment: ${paymentId}, Amount: ₹${(amount / 100).toFixed(2)})`,
        payload: payloadRaw.slice(0, 4000),
      },
    });

    return NextResponse.json({
      ok: true,
      event: eventType,
      signature,
      secretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      payload,
      auditId: auditRecord.id,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to simulate webhook event" },
      { status: 500 }
    );
  }
}
