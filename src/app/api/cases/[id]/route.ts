import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: true,
      actions: { orderBy: { attemptNumber: "asc" } },
      attempts: { orderBy: { attemptNumber: "asc" } },
      events: { orderBy: { ts: "asc" } },
    },
  });
  if (!recoveryCase) {
    return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
  }
  return NextResponse.json({ case: recoveryCase });
}
