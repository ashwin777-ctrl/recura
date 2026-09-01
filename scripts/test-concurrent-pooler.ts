import { PrismaClient } from "@prisma/client";

const url = "postgresql://postgres.vfkwuyrkwoxsyffrmzvi:g9sWbvKrkRln4Sry@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=20";

async function main() {
  console.log("Testing 30 concurrent Prisma queries on Transaction Pooler port 6543 with pool_timeout=20 & connection_limit=10...");
  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: ["error"]
  });

  try {
    const promises = Array.from({ length: 30 }, async (_, i) => {
      const cases = await prisma.recoveryCase.findMany({ take: 5 });
      const actions = await prisma.recoveryAction.findMany({ take: 5 });
      const audit = await prisma.auditEvent.findMany({ take: 5 });
      return { i, count: cases.length + actions.length + audit.length };
    });

    const results = await Promise.all(promises);
    console.log(`>>> SUCCESS: completed all ${results.length} parallel batches without errors!`);
  } catch (err: any) {
    console.error("Concurrent query failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
