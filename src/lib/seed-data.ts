import type { PrismaClient } from "@prisma/client";
import { rand01, randInt, weightedPick } from "./rng";
import { REASON_LIST, REASONS } from "./failure-reasons";
import { POLICY } from "./policy";
import { formatINR } from "./money";
import type { CustomerSegment, FailureReasonCode, PaymentMethod } from "./types";

const FIRST_NAMES = [
  "Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Isha", "Kabir", "Meera",
  "Rohan", "Saanvi", "Aditya", "Priya", "Rahul", "Nisha", "Karan", "Tara",
  "Vivaan", "Aisha", "Dev", "Riya", "Yash", "Sara", "Ishaan", "Kavya",
  "Neel", "Anika", "Om", "Zara", "Reyansh", "Myra",
];
const LAST_NAMES = [
  "Sharma", "Iyer", "Patel", "Nair", "Reddy", "Gupta", "Menon", "Rao",
  "Kapoor", "Bose", "Chopra", "Das", "Verma", "Shah", "Kulkarni", "Pillai",
  "Bhat", "Sethi", "Ghosh", "Malhotra",
];

const PLANS = [
  { name: "Basic Monthly", amountPaise: 19900, weight: 30 },
  { name: "Pro Monthly", amountPaise: 49900, weight: 30 },
  { name: "Team Monthly", amountPaise: 99900, weight: 20 },
  { name: "Business Monthly", amountPaise: 299900, weight: 12 },
  // Deliberately below the ₹50 recovery threshold — demonstrates the "not economical
  // to retry" clean-stop path in the audit trail.
  { name: "Micro Add-on", amountPaise: 4900, weight: 8 },
];

const METHODS: { value: PaymentMethod; weight: number }[] = [
  { value: "card", weight: 68 },
  { value: "upi", weight: 22 },
  { value: "netbanking", weight: 10 },
];

function pick<T>(key: string, arr: T[]): T {
  return arr[randInt(key, 0, arr.length - 1)];
}

function segmentFor(ltvPaise: number, tenureMonths: number): CustomerSegment {
  if (ltvPaise >= 2_000_000) return "vip";
  if (ltvPaise >= 500_000) return "core";
  if (tenureMonths <= 3) return "new";
  return "at_risk";
}

/** Wipe all domain data (used by /api/reset and before re-seeding). */
export async function resetAll(prisma: PrismaClient): Promise<void> {
  await prisma.auditEvent.deleteMany();
  await prisma.recoveryAction.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.recoveryCase.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.customer.deleteMany();
}

export interface SeedResult {
  customers: number;
  cases: number;
  atRiskPaise: number;
  seed: number;
  reasonCounts: Record<string, number>;
}

/**
 * Generate a fully deterministic batch of failed subscription charges and open a
 * recovery case for each. Same seed → identical batch → reproducible metrics.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  opts: { customers?: number; seed?: number } = {},
): Promise<SeedResult> {
  const count = opts.customers ?? 80;
  const seed = opts.seed ?? Number(process.env.RECURA_SEED ?? 42);

  await resetAll(prisma);
  await prisma.meta.upsert({
    where: { key: "seed" },
    create: { key: "seed", value: String(seed) },
    update: { value: String(seed) },
  });

  const now = Date.now();
  const reasonWeights = REASON_LIST.map((r) => ({ value: r.code, weight: r.batchWeight }));
  const reasonCounts: Record<string, number> = {};
  let atRiskPaise = 0;

  for (let i = 0; i < count; i++) {
    const k = `${seed}:cust:${i}`;
    const first = pick(`${k}:first`, FIRST_NAMES);
    const last = pick(`${k}:last`, LAST_NAMES);
    const name = `${first} ${last}`;
    const email = `${first}.${last}${i}`.toLowerCase() + "@example.in";
    const phone = `+9198${randInt(`${k}:ph`, 10000000, 99999999)}`;

    const engagementScore = Number((0.1 + rand01(`${k}:eng`) * 0.85).toFixed(2));
    const ltvPaise = randInt(`${k}:ltv`, 50_000, 4_000_000);
    const tenureMonths = randInt(`${k}:ten`, 1, 48);
    const segment = segmentFor(ltvPaise, tenureMonths);
    const cancelled = rand01(`${k}:cancel`) < 0.07;

    const plan = weightedPick(`${k}:plan`, PLANS.map((p) => ({ value: p, weight: p.weight })));
    const method = weightedPick(`${k}:method`, METHODS);
    const cardLast4 = method === "card" ? String(randInt(`${k}:last4`, 1000, 9999)) : null;
    const reason = weightedPick(`${k}:reason`, reasonWeights) as FailureReasonCode;
    const spec = REASONS[reason];

    // Stagger the "failed at" times over the last few days for a realistic feed.
    const failedAt = new Date(now - randInt(`${k}:when`, 0, 72) * 3_600_000);

    const customer = await prisma.customer.create({
      data: { name, email, phone, engagementScore, ltvPaise, tenureMonths, segment, cancelled, createdAt: failedAt },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planName: plan.name,
        amountPaise: plan.amountPaise,
        interval: "monthly",
        status: "active",
        method,
        cardLast4,
        razorpaySubId: `sub_sim_${randInt(`${k}:sub`, 100000, 999999)}`,
        createdAt: failedAt,
      },
    });

    const recoveryCase = await prisma.recoveryCase.create({
      data: {
        subscriptionId: subscription.id,
        customerId: customer.id,
        reason,
        amountAtRiskPaise: plan.amountPaise,
        status: "open",
        currentAttempt: 0,
        maxAttempts: POLICY.maxAttempts,
        openedAt: failedAt,
      },
    });

    await prisma.paymentAttempt.create({
      data: {
        subscriptionId: subscription.id,
        caseId: recoveryCase.id,
        attemptNumber: 0,
        amountPaise: plan.amountPaise,
        status: "failed",
        failureReason: reason,
        failureCode: spec.razorpayCode,
        gateway: "simulation",
        detail: `Scheduled subscription charge of ${formatINR(plan.amountPaise)} failed — ${spec.label}.`,
        createdAt: failedAt,
      },
    });

    await prisma.auditEvent.create({
      data: {
        caseId: recoveryCase.id,
        ts: failedAt,
        actor: "system",
        event: "case_opened",
        message: `Failed ${plan.name} charge (${formatINR(plan.amountPaise)}) for ${name} — ${spec.label}. Recovery case opened.`,
        payload: JSON.stringify({ reason, segment, method }),
      },
    });

    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    atRiskPaise += plan.amountPaise;
  }

  return { customers: count, cases: count, atRiskPaise, seed, reasonCounts };
}
