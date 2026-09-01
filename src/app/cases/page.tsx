import Link from "next/link";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { REASONS } from "@/lib/failure-reasons";
import { formatINR } from "@/lib/money";
import { actionLabel, type FailureReasonCode } from "@/lib/types";
import { Card, PageHeader, Badge, Button } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CaseFilters } from "@/components/CaseFilters";

export const dynamic = "force-dynamic";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reason?: string }>;
}) {
  const { status, reason } = await searchParams;

  const cases = await prisma.recoveryCase.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
    },
    orderBy: [{ amountAtRiskPaise: "desc" }],
    include: {
      customer: { select: { name: true, segment: true } },
      actions: { orderBy: { attemptNumber: "desc" }, take: 1 },
    },
  });

  return (
    <div>
      <PageHeader
        title="Recovery cases"
        desc={`${cases.length} case${cases.length === 1 ? "" : "s"} — each traceable from failure to outcome.`}
        right={
          <div className="flex items-center gap-3">
            <CaseFilters />
            <Link href="/import">
              <Button variant="secondary" size="sm" className="gap-1.5 shadow-sm">
                <FileSpreadsheet className="h-4 w-4 text-brand" />
                Import CSV
              </Button>
            </Link>
          </div>
        }
      />

      {/* Quick overview chips */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Total Cases</div>
          <div className="text-lg font-bold text-fg tnum mt-0.5">{cases.length}</div>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">At Risk</div>
          <div className="text-lg font-bold text-fg tnum mt-0.5">
            {formatINR(cases.reduce((sum, item) => sum + item.amountAtRiskPaise, 0))}
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Recovered</div>
          <div className="text-lg font-bold text-good tnum mt-0.5">
            {formatINR(cases.reduce((sum, item) => sum + item.amountRecoveredPaise, 0))}
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Active In-Flight</div>
          <div className="text-lg font-bold text-brand tnum mt-0.5">
            {cases.filter((item) => item.status === "open").length}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden shadow-xl border-border/80">
        <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_auto] gap-3 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted bg-[#0e1422]">
          <div>Customer</div>
          <div>Failure reason</div>
          <div className="text-right">At risk</div>
          <div>Last action</div>
          <div className="text-right">Status</div>
        </div>

        {cases.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No cases match this filter.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {cases.map((c) => {
              const last = c.actions[0];
              const recovered = c.status === "recovered";
              return (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_auto] items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-fg">{c.customer.name}</div>
                    <div className="text-xs capitalize text-muted">{c.customer.segment}</div>
                  </div>
                  <div className="min-w-0">
                    <span className="truncate text-fg">
                      {REASONS[c.reason as FailureReasonCode]?.label ?? c.reason}
                    </span>
                  </div>
                  <div className="text-right tnum">
                    <span className={recovered ? "text-muted line-through" : "text-fg"}>
                      {formatINR(c.amountAtRiskPaise)}
                    </span>
                    {recovered && c.amountRecoveredPaise > 0 ? (
                      <div className="text-xs text-good">+{formatINR(c.amountRecoveredPaise)}</div>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    {last ? (
                      <div className="flex items-center gap-1.5">
                        <Badge tone={last.decidedBy === "claude" || last.decidedBy === "ai" ? "brand" : "neutral"}>
                          {last.decidedBy === "claude" || last.decidedBy === "ai" ? "AI" : "R"}
                        </Badge>
                        <span className="truncate text-xs text-muted">
                          {actionLabel(last.actionType)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <StatusBadge status={c.status} />
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
