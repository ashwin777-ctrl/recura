"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  FileSpreadsheet,
  ScrollText,
  ShieldCheck,
  Zap,
  Terminal,
  Server,
  Sparkles,
  Layers,
} from "lucide-react";
import type { RuntimeInfo } from "@/lib/types";
import { cn } from "@/lib/cn";
import { PulseDot } from "./ui";

const SECTIONS = [
  {
    title: "Operations",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, shortcut: "O" },
      { href: "/cases", label: "Recovery Cases", icon: ListChecks, shortcut: "C" },
    ],
  },
  {
    title: "Data & Ingestion",
    items: [
      { href: "/import", label: "Import CSV Data", icon: FileSpreadsheet, shortcut: "I" },
      { href: "/sandbox", label: "Webhook Sandbox", icon: Terminal, shortcut: "S" },
    ],
  },
  {
    title: "Intelligence & Audit",
    items: [
      { href: "/audit", label: "Audit Ledger", icon: ScrollText, shortcut: "A" },
      { href: "/policy", label: "Stopping Rules", icon: ShieldCheck, shortcut: "P" },
    ],
  },
];

export function Sidebar({ info }: { info: RuntimeInfo }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/80 bg-[#0d121e]/90 backdrop-blur-xl md:flex shadow-2xl">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/40 shadow-[0_0_15px_rgba(91,140,255,0.25)]">
            <Zap className="h-5 w-5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-fg">Recura</span>
              <span className="inline-flex items-center rounded-full bg-brand/10 px-1.5 py-0.2 text-[9px] font-semibold text-brand ring-1 ring-inset ring-brand/30">
                v1.2
              </span>
            </div>
            <div className="text-[11px] font-medium text-muted">Recovery Intelligence</div>
          </div>
        </div>
        <PulseDot tone="good" />
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
              {sec.title}
            </div>
            {sec.items.map(({ href, label, icon: Icon, shortcut }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group relative flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                    active
                      ? "bg-brand/15 text-brand font-semibold shadow-sm ring-1 ring-inset ring-brand/30 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-brand"
                      : "text-muted hover:bg-surface-2/80 hover:text-fg hover:translate-x-0.5",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn("h-4 w-4 transition-colors", active ? "text-brand" : "text-muted group-hover:text-fg")} />
                    <span>{label}</span>
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-mono border",
                      active
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : "border-border/60 text-muted/50 group-hover:text-muted",
                    )}
                  >
                    {shortcut}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Runtime Telemetry Footer */}
      <div className="border-t border-border/60 bg-[#0a0e17]/80 p-4 text-[11px] space-y-2.5">
        <div className="flex items-center justify-between text-muted">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-muted/70" />
            <span className="uppercase tracking-wider text-[10px]">Gateway</span>
          </div>
          <span className={cn("font-medium", info.gatewayMode === "razorpay" ? "text-good" : "text-info")}>
            {info.gatewayMode === "razorpay" ? "Razorpay Test" : "Simulation"}
          </span>
        </div>

        <div className="flex items-center justify-between text-muted">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span className="uppercase tracking-wider text-[10px]">Decision Engine</span>
          </div>
          <span className="text-fg font-medium">Recura AI + Rules</span>
        </div>

        <div className="flex items-center justify-between text-muted">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted/70" />
            <span className="uppercase tracking-wider text-[10px]">Seed State</span>
          </div>
          <span className="font-mono text-fg tnum">#{info.seed}</span>
        </div>
      </div>
    </aside>
  );
}
