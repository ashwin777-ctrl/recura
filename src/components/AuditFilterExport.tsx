"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Download, Search, Filter, FileSpreadsheet, FileJson, Check, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui";

const ACTOR_TONE: Record<string, "brand" | "info" | "warn" | "good" | "neutral"> = {
  "agent:ai": "brand",
  "agent:claude": "brand",
  "agent:rules": "info",
  gateway: "warn",
  webhook: "good",
  system: "neutral",
};

interface AuditItem {
  id: string;
  ts: string | Date;
  actor: string;
  event: string;
  message: string;
  caseId: string | null;
  payload: string | null;
}

export function AuditFilterExport({ events }: { events: AuditItem[] }) {
  const [search, setSearch] = useState("");
  const [selectedActor, setSelectedActor] = useState<string>("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  const actors = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.actor));
    return ["all", ...Array.from(set)];
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchActor = selectedActor === "all" || e.actor === selectedActor;
      const matchSearch =
        search === "" ||
        e.message.toLowerCase().includes(search.toLowerCase()) ||
        e.event.toLowerCase().includes(search.toLowerCase()) ||
        (e.caseId && e.caseId.toLowerCase().includes(search.toLowerCase()));
      return matchActor && matchSearch;
    });
  }, [events, search, selectedActor]);

  const exportCSV = () => {
    setDownloading("csv");
    const headers = ["Timestamp", "Actor", "Event", "Message", "Case ID"];
    const rows = filtered.map((e) => [
      new Date(e.ts).toISOString(),
      `"${e.actor.replace(/"/g, '""')}"`,
      `"${e.event.replace(/"/g, '""')}"`,
      `"${e.message.replace(/"/g, '""')}"`,
      e.caseId || "",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `recura-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 1000);
  };

  const exportJSON = () => {
    setDownloading("json");
    const jsonStr = JSON.stringify(filtered, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recura-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloading(null), 1000);
  };

  return (
    <div className="space-y-4">
      {/* Search & Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111726]/80 p-3 rounded-xl border border-[#232c40]">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter audit events by message, code, or case..."
              className="w-full text-xs pl-9 pr-3 py-1.5 bg-[#0b101b] border border-[#232c40] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Actor filter dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="bg-[#0b101b] border border-[#232c40] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#3ecf8e]"
            >
              {actors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor === "all" ? "All Actors" : actor}
                </option>
              ))}
            </select>
          </div>

          {/* Export CSV button */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#141b2d] border border-[#232c40] rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition"
          >
            {downloading === "csv" ? <Check className="w-3.5 h-3.5 text-[#3ecf8e]" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span>CSV</span>
          </button>

          {/* Export JSON button */}
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#141b2d] border border-[#232c40] rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition"
          >
            {downloading === "json" ? <Check className="w-3.5 h-3.5 text-[#3ecf8e]" /> : <FileJson className="w-3.5 h-3.5" />}
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-[#111726] border border-[#232c40] rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[auto_130px_1fr_auto] gap-3 border-b border-[#232c40] px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">
          <div className="w-28">Time</div>
          <div>Actor</div>
          <div>Event & Decision Reason</div>
          <div className="text-right">Case Link</div>
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">
            No audit events matched your filter criteria.
          </p>
        ) : (
          <div className="divide-y divide-[#232c40]">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[auto_130px_1fr_auto] items-start gap-3 px-5 py-3 text-sm hover:bg-[#141b2d]/50 transition"
              >
                <div className="w-28 shrink-0 font-mono text-xs text-gray-400 pt-0.5">
                  {new Date(e.ts).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div>
                  <Badge tone={ACTOR_TONE[e.actor] ?? "neutral"}>{e.actor}</Badge>
                </div>
                <div className="min-w-0 pr-4">
                  <p className="text-gray-100 text-xs leading-relaxed font-normal">{e.message}</p>
                  <p className="text-[11px] font-mono text-gray-400 mt-0.5">{e.event}</p>
                </div>
                <div className="shrink-0 text-right">
                  {e.caseId ? (
                    <Link
                      href={`/cases/${e.caseId}`}
                      className="inline-flex items-center gap-1 text-xs text-[#3ecf8e] hover:underline font-medium"
                    >
                      <span>case</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>Showing {filtered.length} of {events.length} audit events</span>
        <span className="font-mono text-[11px] text-gray-400">Immutable ledger</span>
      </div>
    </div>
  );
}
