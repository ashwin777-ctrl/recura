"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, ScrollText, ShieldCheck, Activity } from "lucide-react";
import type { RuntimeInfo } from "@/lib/types";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/cases", label: "Recovery cases", icon: ListChecks },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/policy", label: "Policy & stopping rules", icon: ShieldCheck },
];

export function Sidebar({ info }: { info: RuntimeInfo }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface/60 md:flex">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 ring-1 ring-inset ring-brand/30">
          <Activity className="h-5 w-5 text-brand" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight text-fg">Recura</div>
          <div className="text-[11px] leading-tight text-muted">Revenue Recovery Agent</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand/12 text-brand ring-1 ring-inset ring-brand/20"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 px-5 py-5 text-[11px]">
        <Row label="Gateway">
          <span className={info.gatewayMode === "razorpay" ? "text-good" : "text-info"}>
            {info.gatewayMode === "razorpay" ? "Razorpay test" : "Simulation"}
          </span>
        </Row>
        <Row label="Agent">
          <span className={info.llmAvailable ? "text-good" : "text-muted"}>
            {info.llmAvailable ? "Rules + Claude" : "Rules only"}
          </span>
        </Row>
        <Row label="Seed">
          <span className="tnum text-fg">{info.seed}</span>
        </Row>
        <p className="pt-1 leading-relaxed text-muted">
          Deterministic batch — same seed reproduces every number on this dashboard.
        </p>
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="uppercase tracking-wide text-muted">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
