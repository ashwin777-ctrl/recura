"use client";

import { useState } from "react";
import { FileSpreadsheet, Check } from "lucide-react";
import type { Metrics } from "@/lib/metrics";

interface MetricExportProps {
  metrics: Metrics;
}

export function DashboardExportButton({ metrics }: MetricExportProps) {
  const [downloaded, setDownloaded] = useState(false);

  const exportSummary = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Failed Cases", metrics.totals.cases.toString()],
      ["Recovered Cases", metrics.totals.recoveredCases.toString()],
      ["Count Recovery Rate", `${(metrics.totals.recoveryRateCount * 100).toFixed(1)}%`],
      ["Total Value at Risk (INR)", `₹${(metrics.totals.atRiskPaise / 100).toFixed(2)}`],
      ["Total Value Recovered (INR)", `₹${(metrics.totals.recoveredPaise / 100).toFixed(2)}`],
      ["Value Recovery Rate", `${(metrics.totals.recoveryRateValue * 100).toFixed(1)}%`],
      ["Cases Exhausted (Max Retries)", metrics.stopping.exhausted.toString()],
      ["Cases Halted (Policy/Cancelled)", metrics.stopping.abandoned.toString()],
      ["Avg Attempts to Recover", metrics.stopping.avgAttemptsToRecover ? metrics.stopping.avgAttemptsToRecover.toFixed(2) : "0"],
      ["Export Timestamp", new Date().toISOString()],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `recura-recovery-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <button
      onClick={exportSummary}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141b2d] border border-[#232c40] text-xs font-medium text-gray-300 hover:text-white hover:border-gray-500 transition shadow-sm"
      title="Export Executive Recovery Report CSV"
    >
      {downloaded ? <Check className="w-3.5 h-3.5 text-[#3ecf8e]" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400" />}
      <span>Export Report</span>
    </button>
  );
}
