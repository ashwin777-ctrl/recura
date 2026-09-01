import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-data";
import { runBatch } from "@/lib/engine";
import { computeMetrics } from "@/lib/metrics";
import { POLICY } from "@/lib/policy";
import { isLiveMode, gatewayMode } from "@/lib/gateway";

describe.sequential("End-to-End Track 3 Revenue Recovery Workflow", () => {
  beforeAll(async () => {
    await seedDatabase(prisma, { customers: 10, seed: 42 });
  });

  it("1. Seeds deterministic synthetic dataset and opens recovery cases", async () => {
    const cases = await prisma.recoveryCase.findMany({ include: { customer: true, subscription: true } });
    expect(cases.length).toBe(10);
    for (const c of cases) {
      expect(c.status).toBe("open");
      expect(c.currentAttempt).toBe(0);
      expect(c.maxAttempts).toBe(POLICY.maxAttempts);
      expect(c.amountAtRiskPaise).toBeGreaterThan(0);
    }
  });

  it("2. Runs recovery batch and transitions cases to terminal states", async () => {
    const summary = await runBatch({ useLlm: false });
    expect(summary.processed).toBe(10);
    expect(summary.recovered + summary.exhausted + summary.abandoned).toBe(10);

    const cases = await prisma.recoveryCase.findMany();
    for (const c of cases) {
      expect(["recovered", "exhausted", "abandoned"]).toContain(c.status);
      expect(c.closedAt).not.toBeNull();
      expect(c.closeReason).toBeTruthy();
      if (c.status === "recovered") {
        expect(c.amountRecoveredPaise).toBeGreaterThan(0);
      }
    }
  });

  it("3. Enforces hard stopping rules: max attempts cap of 3", async () => {
    const exhaustedCases = await prisma.recoveryCase.findMany({
      where: { status: "exhausted" },
      include: { actions: true },
    });
    for (const ec of exhaustedCases) {
      expect(ec.currentAttempt).toBeLessThanOrEqual(POLICY.maxAttempts);
      const executed = ec.actions.filter((a) => a.executedAt);
      expect(executed.length).toBeLessThanOrEqual(POLICY.maxAttempts);
      expect(ec.closeReason).toMatch(/cap|stopped/i);
    }
  });

  it("4. Enforces clean abandonment for cancelled customers or below threshold amounts", async () => {
    const abandonedCases = await prisma.recoveryCase.findMany({
      where: { status: "abandoned" },
      include: { customer: true, actions: true },
    });
    for (const ac of abandonedCases) {
      const isCancelled = ac.customer.cancelled;
      const isBelowMin = ac.amountAtRiskPaise < POLICY.minRecoverableAmountPaise;
      expect(isCancelled || isBelowMin).toBe(true);
      expect(ac.currentAttempt).toBe(0); // Never attempted a charge
    }
  });

  it("5. Verifies audit trail records every decision, gateway call, and outcome", async () => {
    const events = await prisma.auditEvent.findMany({ orderBy: { ts: "asc" } });
    expect(events.length).toBeGreaterThan(20);

    const actors = new Set(events.map((e) => e.actor));
    expect(actors.has("system")).toBe(true);
    expect(actors.has("agent:rules")).toBe(true);
    expect(actors.has("gateway")).toBe(true);

    const caseOpenedEvents = events.filter((e) => e.event === "case_opened");
    expect(caseOpenedEvents.length).toBe(10);
  });

  it("6. Verifies computeMetrics matches the underlying database records exactly", async () => {
    const metrics = await computeMetrics();
    const allCases = await prisma.recoveryCase.findMany();

    const recovered = allCases.filter((c) => c.status === "recovered");
    const exhausted = allCases.filter((c) => c.status === "exhausted");
    const abandoned = allCases.filter((c) => c.status === "abandoned");

    expect(metrics.totals.cases).toBe(allCases.length);
    expect(metrics.totals.recoveredCases).toBe(recovered.length);
    expect(metrics.stopping.exhausted).toBe(exhausted.length);
    expect(metrics.stopping.abandoned).toBe(abandoned.length);
    expect(metrics.stopping.stoppedCleanly).toBe(exhausted.length + abandoned.length);

    const expectedRecoveredPaise = recovered.reduce((sum, c) => sum + c.amountRecoveredPaise, 0);
    expect(metrics.totals.recoveredPaise).toBe(expectedRecoveredPaise);
  });

  it("7. Verifies deterministic reproducibility across repeated runs with identical seed", async () => {
    // Run 1
    await seedDatabase(prisma, { customers: 4, seed: 12345 });
    const s1 = await runBatch({ useLlm: false });
    const m1 = await computeMetrics();

    // Run 2 (Re-seed with same seed)
    await seedDatabase(prisma, { customers: 4, seed: 12345 });
    const s2 = await runBatch({ useLlm: false });
    const m2 = await computeMetrics();

    expect(s1.recovered).toBe(s2.recovered);
    expect(s1.exhausted).toBe(s2.exhausted);
    expect(s1.abandoned).toBe(s2.abandoned);
    expect(m1.totals.recoveredPaise).toBe(m2.totals.recoveredPaise);
  });

  it("8. Verifies real vs simulation gateway boundary definition", () => {
    expect(["simulation", "razorpay"]).toContain(gatewayMode());
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_MODE !== "live") {
      expect(isLiveMode()).toBe(false);
      expect(gatewayMode()).toBe("simulation");
    }
  });
});
