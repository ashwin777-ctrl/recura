import type { PrismaClient } from "@prisma/client";
import { REASONS, type ReasonSpec } from "./failure-reasons";
import type { FailureReasonCode } from "./types";
import { POLICY } from "./policy";
import { formatINR } from "./money";

export interface RawCsvRow {
  [key: string]: string;
}

export interface ParsedCaseData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  planName: string;
  amountPaise: number;
  failureReason: FailureReasonCode;
  paymentMethod: "card" | "upi" | "netbanking";
  cardLast4?: string;
  engagementScore: number;
  ltvPaise: number;
  tenureMonths: number;
  segment: "new" | "core" | "vip" | "at_risk";
  cancelled: boolean;
}

export interface ValidatedRow {
  rowNumber: number;
  raw: RawCsvRow;
  parsed?: ParsedCaseData;
  valid: boolean;
  errors: string[];
}

export interface CsvParseResult {
  headers: string[];
  rows: ValidatedRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  totalAmountPaise: number;
}

/**
 * Normalizes header string to clean lowercase alphanumeric key.
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Smart failure reason resolver.
 * Maps enum codes, Razorpay error descriptions, or human readable text to standard FailureReasonCode.
 */
export function normalizeFailureReason(raw: string | undefined): FailureReasonCode | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");

  // Direct enum match
  if (clean in REASONS) {
    return clean as FailureReasonCode;
  }

  const lower = raw.toLowerCase();
  if (lower.includes("insufficient") || lower.includes("funds") || lower.includes("balance") || lower.includes("low_bal")) {
    return "INSUFFICIENT_FUNDS";
  }
  if (lower.includes("expire") || lower.includes("expired") || lower.includes("validity")) {
    return "CARD_EXPIRED";
  }
  if (lower.includes("timeout") || lower.includes("timed_out") || lower.includes("network") || lower.includes("gateway")) {
    return "NETWORK_TIMEOUT";
  }
  if (lower.includes("block") || lower.includes("lost") || lower.includes("stolen") || lower.includes("fraud") || lower.includes("restrict")) {
    return "CARD_BLOCKED";
  }
  if (lower.includes("decline") || lower.includes("declined") || lower.includes("bank") || lower.includes("honour") || lower.includes("honor") || lower.includes("reject")) {
    return "BANK_DECLINED";
  }

  return null;
}

/**
 * Parses raw amount (INR or Paise) into integer Paise.
 */
export function parseAmountToPaise(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹$,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;

  // If user entered already in paise (e.g. 299900 for ₹2,999)
  // or standard rupee amount (e.g. 2999 or 2999.50)
  if (cleaned.includes(".") || num < 50000) {
    return Math.round(num * 100);
  }
  return Math.round(num);
}

/**
 * RFC 4180-compliant CSV string tokenizer supporting quotes, escaped quotes, commas, and multiline values.
 */
export function parseCsvText(csvText: string): RawCsvRow[] {
  const lines: string[] = [];
  let currentLine = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
        currentLine += '"';
      }
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      if (currentLine.trim().length > 0) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim().length > 0) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  // Parse individual line into columns
  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        cols.push(cur.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
        cur = "";
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
    return cols;
  };

  const rawHeaders = parseLine(lines[0]);
  const rows: RawCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => v === "")) continue; // skip blank rows
    const row: RawCsvRow = {};
    rawHeaders.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Validates and normalizes parsed CSV rows.
 */
export function validateCsvRows(rawRows: RawCsvRow[]): CsvParseResult {
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const rows: ValidatedRow[] = [];
  let totalAmountPaise = 0;

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const errors: string[] = [];

    // Header alias lookups
    const getVal = (...aliases: string[]): string => {
      for (const alias of aliases) {
        for (const [k, v] of Object.entries(raw)) {
          if (normalizeHeader(k) === normalizeHeader(alias)) {
            return v.trim();
          }
        }
      }
      return "";
    };

    const customerName = getVal("name", "customer_name", "customer", "full_name", "client_name");
    const customerEmail = getVal("email", "customer_email", "mail", "contact_email");
    const customerPhone = getVal("phone", "customer_phone", "mobile", "contact_phone") || "+919876543210";
    const planName = getVal("plan", "plan_name", "subscription_plan", "product", "tier") || "Pro Monthly";
    const rawAmount = getVal("amount", "amount_inr", "amount_paise", "charge_amount", "value", "price");
    const rawReason = getVal("reason", "failure_reason", "error_code", "decline_reason", "error");
    const rawMethod = getVal("method", "payment_method", "instrument", "type").toLowerCase();
    const rawLast4 = getVal("card_last4", "last4", "card_digits");
    const rawEngagement = getVal("engagement", "engagement_score", "score");
    const rawLtv = getVal("ltv", "ltv_inr", "lifetime_value");
    const rawTenure = getVal("tenure", "tenure_months", "months");
    const rawSegment = getVal("segment", "customer_segment").toLowerCase();
    const rawCancelled = getVal("cancelled", "is_cancelled", "churned").toLowerCase();

    // Validations
    if (!customerName) {
      errors.push("Customer name is required.");
    }

    if (!customerEmail) {
      errors.push("Customer email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.push(`Invalid email format: "${customerEmail}".`);
    }

    const amountPaise = parseAmountToPaise(rawAmount);
    if (!amountPaise || amountPaise <= 0) {
      errors.push(`Invalid amount: "${rawAmount || "missing"}". Must be greater than ₹0.`);
    }

    const failureReason = normalizeFailureReason(rawReason);
    if (!failureReason) {
      errors.push(
        `Unknown failure reason: "${rawReason || "missing"}". Expected: INSUFFICIENT_FUNDS, CARD_EXPIRED, BANK_DECLINED, NETWORK_TIMEOUT, or CARD_BLOCKED.`,
      );
    }

    let paymentMethod: "card" | "upi" | "netbanking" = "card";
    if (rawMethod.includes("upi")) paymentMethod = "upi";
    else if (rawMethod.includes("net") || rawMethod.includes("bank")) paymentMethod = "netbanking";

    const cardLast4 = rawLast4.replace(/\D/g, "").slice(-4) || "4242";

    let engagementScore = 0.65;
    if (rawEngagement) {
      const e = parseFloat(rawEngagement);
      if (!isNaN(e) && e >= 0 && e <= 1) engagementScore = e;
      else if (!isNaN(e) && e > 1 && e <= 100) engagementScore = e / 100;
    }

    const ltvPaise = parseAmountToPaise(rawLtv) ?? (amountPaise ? amountPaise * 12 : 3598800);
    const tenureMonths = parseInt(rawTenure, 10) || 6;

    let segment: "new" | "core" | "vip" | "at_risk" = "core";
    if (["new", "core", "vip", "at_risk"].includes(rawSegment)) {
      segment = rawSegment as any;
    }

    const cancelled = ["true", "1", "yes", "y"].includes(rawCancelled);

    if (errors.length === 0 && amountPaise && failureReason) {
      totalAmountPaise += amountPaise;
      rows.push({
        rowNumber,
        raw,
        parsed: {
          customerName,
          customerEmail,
          customerPhone,
          planName,
          amountPaise,
          failureReason,
          paymentMethod,
          cardLast4,
          engagementScore,
          ltvPaise,
          tenureMonths,
          segment,
          cancelled,
        },
        valid: true,
        errors: [],
      });
    } else {
      rows.push({
        rowNumber,
        raw,
        valid: false,
        errors,
      });
    }
  });

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;

  return {
    headers,
    rows,
    totalRows: rows.length,
    validCount,
    invalidCount,
    totalAmountPaise,
  };
}

/**
 * Generates a realistic sample CSV dataset with Indian subscription businesses data.
 */
export function generateSampleCsv(): string {
  return `customer_name,customer_email,customer_phone,plan_name,amount_inr,failure_reason,payment_method,card_last4,segment
Aarav Sharma,aarav.sharma@acme.in,+919820123456,Scale Monthly,4999,INSUFFICIENT_FUNDS,card,4242,core
Pooja Patel,pooja.p@fintech.io,+919876543210,Pro Growth,2999,CARD_EXPIRED,card,1881,vip
Vikram Malhotra,vikram@malhotralabs.co,+919811223344,Enterprise Annual,14999,BANK_DECLINED,card,9021,vip
Neha Sen,neha.sen@designstudio.in,+919930445566,Starter Monthly,999,NETWORK_TIMEOUT,card,3112,new
Rohan Mehta,rohan.mehta@saashq.com,+919741556677,Team Monthly,1999,CARD_BLOCKED,card,5544,at_risk
Ananya Reddy,ananya.r@cloudreach.in,+919845012345,Growth Monthly,3499,INSUFFICIENT_FUNDS,upi,4433,core`;
}

/**
 * Inserts valid parsed CSV records atomically into the database.
 */
export async function importValidatedRows(
  prisma: PrismaClient,
  validRows: ValidatedRow[],
): Promise<{
  importedCount: number;
  totalAtRiskPaise: number;
  caseIds: string[];
}> {
  const casesToInsert = validRows.filter((r) => r.valid && r.parsed);
  if (casesToInsert.length === 0) {
    return { importedCount: 0, totalAtRiskPaise: 0, caseIds: [] };
  }

  const now = Date.now();
  let totalAtRiskPaise = 0;
  const caseIds: string[] = [];

  for (const row of casesToInsert) {
    const p = row.parsed!;
    totalAtRiskPaise += p.amountPaise;
    const uid = `imp_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
    const customerId = `cust_${uid}`;
    const subscriptionId = `sub_${uid}`;
    const caseId = `case_${uid}`;
    caseIds.push(caseId);

    const spec: ReasonSpec = REASONS[p.failureReason];
    const openedAt = new Date(now);

    await prisma.$transaction([
      prisma.customer.create({
        data: {
          id: customerId,
          name: p.customerName,
          email: p.customerEmail,
          phone: p.customerPhone || "+919876543210",
          engagementScore: p.engagementScore,
          ltvPaise: p.ltvPaise,
          tenureMonths: p.tenureMonths,
          segment: p.segment,
          cancelled: p.cancelled,
          createdAt: openedAt,
        },
      }),
      prisma.subscription.create({
        data: {
          id: subscriptionId,
          customerId,
          planName: p.planName,
          amountPaise: p.amountPaise,
          interval: "monthly",
          status: "active",
          method: p.paymentMethod,
          cardLast4: p.cardLast4 || "4242",
          razorpaySubId: `sub_${uid}`,
          createdAt: openedAt,
        },
      }),
      prisma.recoveryCase.create({
        data: {
          id: caseId,
          subscriptionId,
          customerId,
          reason: p.failureReason,
          amountAtRiskPaise: p.amountPaise,
          status: "open",
          currentAttempt: 0,
          maxAttempts: POLICY.maxAttempts,
          openedAt,
        },
      }),
      prisma.paymentAttempt.create({
        data: {
          subscriptionId,
          caseId,
          attemptNumber: 0,
          amountPaise: p.amountPaise,
          status: "failed",
          failureReason: p.failureReason,
          failureCode: spec.razorpayCode,
          gateway: "simulation",
          detail: `Imported failed charge for ${p.planName} (${formatINR(p.amountPaise)}) — ${spec.label}.`,
          createdAt: openedAt,
        },
      }),
      prisma.auditEvent.create({
        data: {
          caseId,
          ts: openedAt,
          actor: "system",
          event: "case_opened",
          message: `Imported failed payment for ${p.customerName} (${formatINR(p.amountPaise)}) — ${spec.label}. Case opened for recovery.`,
          payload: JSON.stringify({
            imported: true,
            reason: p.failureReason,
            segment: p.segment,
            method: p.paymentMethod,
          }),
        },
      }),
    ]);
  }

  return {
    importedCount: casesToInsert.length,
    totalAtRiskPaise,
    caseIds,
  };
}
