import { prisma } from "../src/lib/prisma";

async function main() {
  const url = process.env.DATABASE_URL || "";
  const host = url.split("@")[1]?.split("/")[0] || "unknown";
  console.log(`[Supabase Test] Connecting to Supabase host: ${host}...`);

  const [customers, cases, attempts, audits] = await Promise.all([
    prisma.customer.count(),
    prisma.recoveryCase.count(),
    prisma.paymentAttempt.count(),
    prisma.auditEvent.count(),
  ]);

  console.log("[Supabase Test] SUCCESS! Verified live connection with Supabase PostgreSQL:");
  console.log(JSON.stringify({
    host,
    projectRef: host.split(".")[0].replace("db.", ""),
    tables: {
      Customer: customers,
      RecoveryCase: cases,
      PaymentAttempt: attempts,
      AuditEvent: audits
    }
  }, null, 2));
}

main()
  .catch((e) => {
    console.error("[Supabase Test] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
