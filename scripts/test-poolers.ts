import { PrismaClient } from "@prisma/client";

async function testUrl(label: string, url: string) {
  console.log(`\nTesting ${label}: ${url.replace(/:[^:@]+@/, ":****@")}...`);
  const client = new PrismaClient({
    datasources: {
      db: { url },
    },
  });
  try {
    const count = await client.recoveryCase.count();
    console.log(`[PASS] ${label} connected! Cases count: ${count}`);
    return true;
  } catch (err: any) {
    console.log(`[FAIL] ${label}: ${err.message?.split("\n")[0]}`);
    return false;
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const basePassword = "g9sWbvKrkRln4Sry";
  const projectRef = "vfkwuyrkwoxsyffrmzvi";

  // Test 1: Direct 5432
  await testUrl("Direct 5432", `postgresql://postgres:${basePassword}@db.${projectRef}.supabase.co:5432/postgres`);

  // Test 2: Direct 6543
  await testUrl("Direct 6543", `postgresql://postgres:${basePassword}@db.${projectRef}.supabase.co:6543/postgres?pgbouncer=true`);

  // Test 3: Pooler aws-0-ap-south-1
  await testUrl("Pooler aws-0-ap-south-1", `postgresql://postgres.${projectRef}:${basePassword}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`);

  // Test 4: Pooler aws-0-us-east-1
  await testUrl("Pooler aws-0-us-east-1", `postgresql://postgres.${projectRef}:${basePassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`);

  // Test 5: Pooler aws-0-eu-central-1
  await testUrl("Pooler aws-0-eu-central-1", `postgresql://postgres.${projectRef}:${basePassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`);
}

main();
