import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seed-data";
import { formatINR } from "../src/lib/money";

const prisma = new PrismaClient();

async function main() {
  const seed = Number(process.env.RECURA_SEED ?? 42);
  const customers = Number(process.env.SEED_CUSTOMERS ?? 80);
  const result = await seedDatabase(prisma, { customers, seed });
  console.log("✓ Seeded Recura:");
  console.log(`  customers/cases : ${result.cases}`);
  console.log(`  at risk         : ${formatINR(result.atRiskPaise)}`);
  console.log(`  seed            : ${result.seed}`);
  console.log(`  reasons         :`, result.reasonCounts);
  console.log("\nNext: `npm run dev`, then click “Run recovery batch” on the dashboard.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
