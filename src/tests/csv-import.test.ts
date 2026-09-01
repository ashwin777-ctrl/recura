import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  parseCsvText,
  normalizeFailureReason,
  parseAmountToPaise,
  validateCsvRows,
  importValidatedRows,
  generateSampleCsv,
} from "@/lib/csv-import";
import { runBatch, runCase } from "@/lib/engine";

describe("CSV Data Import & Validation Pipeline", () => {
  it("1. Parses raw CSV text into tokenized row objects correctly", () => {
    const raw = `customer_name,customer_email,amount_inr,failure_reason
"Sharma, Aarav",aarav@example.com,2999,INSUFFICIENT_FUNDS
Pooja Patel,pooja@example.com,4999,CARD_EXPIRED`;

    const rows = parseCsvText(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0].customer_name).toBe("Sharma, Aarav");
    expect(rows[0].customer_email).toBe("aarav@example.com");
    expect(rows[0].amount_inr).toBe("2999");
    expect(rows[1].customer_name).toBe("Pooja Patel");
  });

  it("2. Normalizes fuzzy failure reason descriptions to valid FailureReasonCode enums", () => {
    expect(normalizeFailureReason("INSUFFICIENT_FUNDS")).toBe("INSUFFICIENT_FUNDS");
    expect(normalizeFailureReason("Insufficient funds on account")).toBe("INSUFFICIENT_FUNDS");
    expect(normalizeFailureReason("low balance in customer bank")).toBe("INSUFFICIENT_FUNDS");
    expect(normalizeFailureReason("Card expired on 04/24")).toBe("CARD_EXPIRED");
    expect(normalizeFailureReason("Issuer bank declined (do_not_honour)")).toBe("BANK_DECLINED");
    expect(normalizeFailureReason("Gateway network timeout in transit")).toBe("NETWORK_TIMEOUT");
    expect(normalizeFailureReason("Card blocked or reported stolen")).toBe("CARD_BLOCKED");
    expect(normalizeFailureReason("CompletelyUnknownErrorXYZ")).toBeNull();
  });

  it("3. Converts human INR currency inputs to integer Paise accurately", () => {
    expect(parseAmountToPaise("2999")).toBe(299900);
    expect(parseAmountToPaise("₹4,999.00")).toBe(499900);
    expect(parseAmountToPaise("499")).toBe(49900);
    expect(parseAmountToPaise("299900")).toBe(299900);
    expect(parseAmountToPaise("0")).toBeNull();
    expect(parseAmountToPaise("-500")).toBeNull();
    expect(parseAmountToPaise("abc")).toBeNull();
  });

  it("4. Validates rows and records precise error diagnostics for malformed records", () => {
    const rawRows = [
      {
        customer_name: "Valid User",
        customer_email: "valid@user.com",
        amount_inr: "2999",
        failure_reason: "INSUFFICIENT_FUNDS",
      },
      {
        customer_name: "", // missing name
        customer_email: "not-an-email", // invalid email
        amount_inr: "-100", // invalid amount
        failure_reason: "UnknownReasonCode", // invalid reason
      },
    ];

    const result = validateCsvRows(rawRows);
    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.rows[0].valid).toBe(true);
    expect(result.rows[1].valid).toBe(false);
    expect(result.rows[1].errors.length).toBeGreaterThanOrEqual(4);
  });

  it("5. Generates valid built-in sample template CSV", () => {
    const sample = generateSampleCsv();
    const rows = parseCsvText(sample);
    const result = validateCsvRows(rows);

    expect(result.totalRows).toBeGreaterThanOrEqual(5);
    expect(result.validCount).toBe(result.totalRows);
    expect(result.invalidCount).toBe(0);
  });

  it("6. Atomically imports custom CSV records into PostgreSQL database", async () => {
    const customCsv = `customer_name,customer_email,customer_phone,plan_name,amount_inr,failure_reason,payment_method,card_last4,segment
Test Custom User 1,custom1@test.com,+919999988888,Scale Monthly,2999,NETWORK_TIMEOUT,card,9988,vip
Test Custom User 2,custom2@test.com,+919999977777,Pro Monthly,4999,INSUFFICIENT_FUNDS,card,7766,core`;

    const rawRows = parseCsvText(customCsv);
    const validation = validateCsvRows(rawRows);
    expect(validation.validCount).toBe(2);

    const importResult = await importValidatedRows(prisma, validation.rows);
    expect(importResult.importedCount).toBe(2);
    expect(importResult.caseIds).toHaveLength(2);

    // Verify records exist in PostgreSQL
    const case1 = await prisma.recoveryCase.findUnique({
      where: { id: importResult.caseIds[0] },
      include: { customer: true, subscription: true, attempts: true, events: true },
    });

    expect(case1).not.toBeNull();
    expect(case1?.customer.name).toBe("Test Custom User 1");
    expect(case1?.customer.email).toBe("custom1@test.com");
    expect(case1?.amountAtRiskPaise).toBe(299900);
    expect(case1?.status).toBe("open");
    expect(case1?.currentAttempt).toBe(0);
    expect(case1?.attempts).toHaveLength(1);
    expect(case1?.attempts[0].status).toBe("failed");
    expect(case1?.events.some((e) => e.event === "case_opened")).toBe(true);

    // Test that the recovery engine processes these imported cases cleanly
    const outcome1 = await runCase(importResult.caseIds[0], { useLlm: false });
    const outcome2 = await runCase(importResult.caseIds[1], { useLlm: false });
    expect(["recovered", "exhausted", "abandoned"]).toContain(outcome1);
    expect(["recovered", "exhausted", "abandoned"]).toContain(outcome2);

    const updatedCase1 = await prisma.recoveryCase.findUnique({
      where: { id: importResult.caseIds[0] },
    });
    expect(["recovered", "exhausted", "abandoned"]).toContain(updatedCase1?.status);
  });
});
