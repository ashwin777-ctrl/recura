import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook receiver (real live-mode integration seam).
 * Verifies the HMAC-SHA256 signature, then records the event. A full production
 * build would route payment.failed → open a case and subscription.charged → close
 * one; here we log it to the audit trail to prove the ingestion path.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

  if (secret) {
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (
      expectedBuf.length !== signatureBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: { event?: string } = {};
  try {
    event = JSON.parse(raw);
  } catch {
    /* keep raw */
  }

  await prisma.auditEvent.create({
    data: {
      ts: new Date(),
      actor: "webhook",
      event: event.event ?? "razorpay.event",
      message: `Received Razorpay webhook: ${event.event ?? "unknown event"}`,
      payload: raw.slice(0, 4000),
    },
  });

  return NextResponse.json({ ok: true });
}
