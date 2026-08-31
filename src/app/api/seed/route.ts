import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-data";
import { SeedOptionsSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const opts = SeedOptionsSchema.parse(body ?? {});
    const result = await seedDatabase(prisma, opts);
    return NextResponse.json({ ok: true, result, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
