import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetAll } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await resetAll(prisma);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
