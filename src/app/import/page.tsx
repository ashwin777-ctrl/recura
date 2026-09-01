"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Trash2,
  Info,
  Check,
} from "lucide-react";
import { Card, CardHeader, Button, Badge, PageHeader } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { REASONS } from "@/lib/failure-reasons";
import type { FailureReasonCode } from "@/lib/types";
import { generateSampleCsv, type CsvParseResult, type ValidatedRow } from "@/lib/csv-import";

export default function ImportPage() {
  const router = useRouter();
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{
    count: number;
    amountPaise: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Validate on CSV text change
  useEffect(() => {
    if (!csvText.trim()) {
      setPreview(null);
      setErrorMsg(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/import/csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvText, action: "preview" }),
        });
        const data = await res.json();
        if (data.ok && data.validation) {
          setPreview(data.validation);
          setErrorMsg(null);
        } else {
          setErrorMsg(data.error || "Failed to validate CSV structure.");
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Network error while validating CSV.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [csvText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      setImportSuccess(null);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    const sample = generateSampleCsv();
    setFileName("sample_failed_payments.csv");
    setCsvText(sample);
    setImportSuccess(null);
  };

  const handleDownloadSample = () => {
    const sample = generateSampleCsv();
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "recura_failed_payments_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClear = () => {
    setCsvText("");
    setFileName(null);
    setPreview(null);
    setImportSuccess(null);
    setErrorMsg(null);
  };

  const handleImport = async () => {
    if (!preview || preview.validCount === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, action: "import" }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setImportSuccess({
          count: data.result.importedCount,
          amountPaise: data.result.totalAtRiskPaise,
        });
        startTransition(() => {
          router.refresh();
        });
      } else {
        setErrorMsg(data.error || "Failed to complete import.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to server for import.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Failed Payment Data"
        desc="Upload or paste custom customer, subscription, and failed charge data to evaluate Recura on your own records."
        right={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownloadSample}>
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <Button variant="primary" size="sm" onClick={handleLoadSample}>
              <Sparkles className="h-4 w-4" />
              Load Sample Data
            </Button>
          </div>
        }
      />

      {importSuccess ? (
        <Card className="border-good/30 bg-good/5 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-good/15 text-good">
              <Check className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-fg">
                Successfully imported {importSuccess.count} recovery case
                {importSuccess.count === 1 ? "" : "s"}!
              </h3>
              <p className="text-sm text-muted">
                Total value at risk:{" "}
                <span className="font-semibold text-fg">
                  {formatINR(importSuccess.amountPaise)}
                </span>
                . These cases have been opened with initial failed payment records and audit
                trails, ready for autonomous recovery.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href="/cases">
                  <Button variant="primary" size="sm">
                    View Cases in Queue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="secondary" size="sm">
                    Go to Dashboard & Run Batch
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Import Another File
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* CSV Input Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-brand" />
              <span className="text-sm font-semibold text-fg">CSV Input Source</span>
            </div>
            {csvText ? (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-muted">
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            {/* File drop area */}
            <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/40 p-6 text-center cursor-pointer hover:border-brand/50 hover:bg-surface-2 transition-colors">
              <UploadCloud className="h-8 w-8 text-brand/80 mb-2" />
              <span className="text-sm font-medium text-fg">
                {fileName ? fileName : "Upload CSV file"}
              </span>
              <span className="mt-1 text-xs text-muted">
                Drag and drop your file here or click to browse (.csv)
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Direct Paste Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="csv-paste" className="text-xs font-medium uppercase tracking-wider text-muted">
                  Or Paste Raw CSV
                </label>
                {loading ? (
                  <span className="flex items-center gap-1 text-xs text-brand">
                    <Loader2 className="h-3 w-3 animate-spin" /> Validating...
                  </span>
                ) : null}
              </div>
              <textarea
                id="csv-paste"
                value={csvText}
                onChange={(e) => {
                  setFileName(null);
                  setCsvText(e.target.value);
                }}
                placeholder="customer_name,customer_email,plan_name,amount_inr,failure_reason,payment_method,card_last4&#10;Aarav Sharma,aarav@acme.in,Scale Monthly,4999,INSUFFICIENT_FUNDS,card,4242&#10;Pooja Patel,pooja@fintech.io,Pro Growth,2999,CARD_EXPIRED,card,1881"
                rows={8}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-mono text-fg placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
        </Card>

        {/* Expected Schema & Documentation */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Info className="h-4 w-4 text-info" />
              <span className="text-sm font-semibold text-fg">Supported CSV Columns</span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs text-muted leading-relaxed">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-surface-2 p-2.5 border border-border">
                  <div className="font-semibold text-fg">customer_name / name *</div>
                  <div className="text-[11px] text-muted mt-0.5">Customer full name</div>
                </div>
                <div className="rounded-md bg-surface-2 p-2.5 border border-border">
                  <div className="font-semibold text-fg">customer_email / email *</div>
                  <div className="text-[11px] text-muted mt-0.5">Valid email address</div>
                </div>
                <div className="rounded-md bg-surface-2 p-2.5 border border-border">
                  <div className="font-semibold text-fg">amount_inr / amount *</div>
                  <div className="text-[11px] text-muted mt-0.5">Failed charge amount (e.g. 2999)</div>
                </div>
                <div className="rounded-md bg-surface-2 p-2.5 border border-border">
                  <div className="font-semibold text-fg">failure_reason / reason *</div>
                  <div className="text-[11px] text-muted mt-0.5">Funds, Expired, Declined, Timeout, Blocked</div>
                </div>
                <div className="rounded-md bg-surface-2 p-2.5 border border-border">
                  <div className="font-semibold text-fg">plan_name / plan</div>
                  <div className="text-[11px] text-muted mt-0.5">Subscription name (default: Pro)</div>
                </div>
                <div className="rounded-md bg-surface-2 p-2.5 border border-border">
                  <div className="font-semibold text-fg">payment_method / method</div>
                  <div className="text-[11px] text-muted mt-0.5">card, upi, netbanking (default: card)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted">Columns with * are required.</span>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!preview || preview.validCount === 0 || importing}
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing Cases...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Import {preview?.validCount ?? 0} Valid Case{(preview?.validCount ?? 0) === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {errorMsg ? (
        <Card className="border-bad/30 bg-bad/5 p-4 flex items-center gap-3 text-bad text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </Card>
      ) : null}

      {/* Live Validation & Preview Table */}
      {preview && preview.totalRows > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="Validation & Import Preview"
            desc={`Parsed ${preview.totalRows} row${preview.totalRows === 1 ? "" : "s"} from CSV.`}
            right={
              <div className="flex items-center gap-2">
                <Badge tone={preview.validCount > 0 ? "good" : "neutral"}>
                  {preview.validCount} Valid
                </Badge>
                {preview.invalidCount > 0 ? (
                  <Badge tone="bad">{preview.invalidCount} Invalid</Badge>
                ) : null}
                <Badge tone="brand">
                  Total at risk: {formatINR(preview.totalAmountPaise)}
                </Badge>
              </div>
            }
          />

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-muted font-medium">
                <tr>
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Plan & Method</th>
                  <th className="py-2.5 px-4">Failure Reason</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {preview.rows.map((r: ValidatedRow) => {
                  const spec = r.parsed ? REASONS[r.parsed.failureReason as FailureReasonCode] : null;
                  return (
                    <tr
                      key={r.rowNumber}
                      className={r.valid ? "hover:bg-surface-2/40" : "bg-bad/5"}
                    >
                      <td className="py-3 px-4 font-mono text-muted">{r.rowNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-fg">
                          {r.parsed?.customerName || r.raw.customer_name || r.raw.name || "—"}
                        </div>
                        <div className="text-muted text-[11px]">
                          {r.parsed?.customerEmail || r.raw.customer_email || r.raw.email || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-fg">{r.parsed?.planName || "Pro Monthly"}</div>
                        <div className="text-muted text-[11px] uppercase">
                          {r.parsed?.paymentMethod || "card"}
                          {r.parsed?.cardLast4 ? ` ••••${r.parsed.cardLast4}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {r.parsed?.failureReason ? (
                          <Badge tone="neutral">
                            {spec?.label || r.parsed.failureReason}
                          </Badge>
                        ) : (
                          <span className="text-bad font-mono">
                            {r.raw.failure_reason || r.raw.reason || "Missing"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-fg tnum">
                        {r.parsed?.amountPaise ? formatINR(r.parsed.amountPaise) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {r.valid ? (
                          <Badge tone="good">Valid</Badge>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <Badge tone="bad">Error</Badge>
                            <span className="text-[10px] text-bad max-w-xs text-right">
                              {r.errors.join(" ")}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
