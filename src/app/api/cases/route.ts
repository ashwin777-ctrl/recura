import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const reason = searchParams.get("reason") || undefined;

  const cases = await prisma.recoveryCase.findMany({
    where: { status, reason },
    orderBy: [{ amountAtRiskPaise: "desc" }],
    include: {
      customer: { select: { name: true, segment: true } },
      subscription: { select: { planName: true, method: true } },
      _count: { select: { actions: true } },
    },
  });
  return NextResponse.json({ cases });
}
