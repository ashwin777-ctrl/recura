import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);
  const events = await prisma.auditEvent.findMany({
    orderBy: { ts: "desc" },
    take: limit,
  });
  return NextResponse.json({ events });
}
