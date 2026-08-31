import Link from "next/link";
import { ArrowUpRight, TrendingUp, ShieldCheck, IndianRupee, Percent } from "lucide-react";
import { computeMetrics, getRuntimeInfo } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { POLICY } from "@/lib/policy";
import { formatINR, formatINRCompact, formatPct } from "@/lib/money";
import { Card, CardHeader, Stat, Progress, Badge, PageHeader } from "@/components/ui";
import { Controls } from "@/components/Controls";
import { Funnel } from "@/components/Funnel";
import { ReasonChart, ActionChart, AttemptChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [m, info, recentAudit] = await Promise.all([
    computeMetrics(),
    getRuntimeInfo(),
    prisma.auditEvent.findMany({ orderBy: [{ ts: "desc" }, { createdAt: "desc" }], take: 7 }),
  ]);

  const empty = m.totals.cases === 0;
  const notRun = m.totals.closed === 0 && !empty;

  return (
    <div>
      <PageHeader
        title="Revenue Recovery"
        desc="A controlled agent that recovers failed subscription payments — with hard stopping rules and a full audit trail."
        right={<Controls info={info} />}
      />

      {empty ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted">
            No batch loaded yet. Click <span className="font-medium text-fg">Re-seed</span> to
            generate a synthetic batch of failed payments, then{" "}
            <span className="font-medium text-fg">Run recovery batch</span>.
          </p>
        </Card>
      ) : (
        <>
          {notRun ? (
            <Card className="mb-6 border-brand/25 bg-brand/5 p-4 text-sm text-brand">
              {m.totals.cases} failed payments worth {formatINR(m.totals.atRiskPaise)} are queued.
              Click <span className="font-semibold">Run recovery batch</span> to let the agent work
              them.
            </Card>
          ) : null}

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Recovery rate"
              value={formatPct(m.totals.recoveryRateCount)}
              sub={`${m.totals.recoveredCases} of ${m.totals.cases} cases recovered`}
              tone="good"
            />
            <Stat
              label="Value recovered"
              value={formatINRCompact(m.totals.recoveredPaise)}
              sub={`of ${formatINRCompact(m.totals.atRiskPaise)} at risk · ${formatPct(
                m.totals.recoveryRateValue,
              )}`}
              tone="brand"
            />
            <Stat
              label="Stopped cleanly"
              value={m.stopping.stoppedCleanly}
              sub={`${m.stopping.exhausted} exhausted · ${m.stopping.abandoned} halted early`}
              tone="info"
            />
            <Stat
              label="Avg attempts to recover"
              value={m.stopping.avgAttemptsToRecover ? m.stopping.avgAttemptsToRecover.toFixed(1) : "—"}
              sub={`hard cap ${POLICY.maxAttempts} attempts / case`}
              tone="neutral"
            />
          </div>

          {/* Funnel + reason chart */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Recovery funnel"
                desc="Failed → attempted → recovered"
                right={<IndianRupee className="h-4 w-4 text-muted" />}
              />
              <Funnel stages={m.funnel} />
            </Card>

            <Card>
              <CardHeader
                title="Outcome by failure reason"
                desc="Recovered vs. unrecovered, per reason"
                right={<TrendingUp className="h-4 w-4 text-muted" />}
              />
              <div className="px-3 pb-4 pt-2">
                <ReasonChart data={m.byReason} />
              </div>
            </Card>
          </div>

          {/* Action effectiveness + attempts */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Which interventions worked"
                desc="Success rate of each recovery lever the agent pulled"
                right={<Percent className="h-4 w-4 text-muted" />}
              />
              <div className="px-3 pb-4 pt-2">
                <ActionChart data={m.byAction} />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Recoveries by attempt number"
                desc="Most wins land early — proof the agent isn't over-retrying"
              />
              <div className="px-3 pb-4 pt-2">
                <AttemptChart data={m.recoveryByAttempt} />
              </div>
              <div className="border-t border-border px-5 py-3 text-xs text-muted">
                {m.discount.casesRecoveredViaDiscount > 0 ? (
                  <>
                    {m.discount.casesRecoveredViaDiscount} subscription
                    {m.discount.casesRecoveredViaDiscount === 1 ? "" : "s"} saved via a win-back
                    discount — giving up{" "}
                    <span className="text-fg">{formatINR(m.discount.discountGivenUpPaise)}</span> to
                    retain recurring revenue that would otherwise have churned.
                  </>
                ) : (
                  <>Discounts are reserved for high-LTV customers on their final attempt.</>
                )}
              </div>
            </Card>
          </div>

          {/* Agent split + recent audit */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title="Decision engine" desc="Who made the calls" />
              <div className="space-y-4 px-5 pb-5 pt-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">Deterministic rules</span>
                    <span className="tnum text-fg">{m.llm.decisionsByRules}</span>
                  </div>
                  <Progress
                    value={
                      m.llm.decisionsByRules /
                      Math.max(1, m.llm.decisionsByRules + m.llm.decisionsByClaude)
                    }
                    tone="brand"
                  />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">Claude-assisted</span>
                    <span className="tnum text-fg">{m.llm.decisionsByClaude}</span>
                  </div>
                  <Progress
                    value={
                      m.llm.decisionsByClaude /
                      Math.max(1, m.llm.decisionsByRules + m.llm.decisionsByClaude)
                    }
                    tone="info"
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  Every decision — rules or Claude — is bounded by the same hard stopping rules.
                  Claude may only re-pick within allowed actions; it can never override a stop.
                </p>
                <Link
                  href="/policy"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> View policy & stopping rules
                </Link>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Recent activity"
                desc="Newest audit events"
                right={
                  <Link
                    href="/audit"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    Full audit log <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="divide-y divide-border px-5 pb-2 pt-2">
                {recentAudit.length === 0 ? (
                  <p className="py-4 text-sm text-muted">No events yet.</p>
                ) : (
                  recentAudit.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <ActorDot actor={e.actor} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-fg">{e.message}</p>
                        <p className="text-xs text-muted">
                          {new Date(e.ts).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {e.actor}
                        </p>
                      </div>
                      {e.caseId ? (
                        <Link
                          href={`/cases/${e.caseId}`}
                          className="shrink-0 text-xs text-brand hover:underline"
                        >
                          view
                        </Link>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone={info.gatewayMode === "razorpay" ? "good" : "info"}>
              {info.gatewayMode === "razorpay" ? "Razorpay test mode" : "Simulation mode"}
            </Badge>
            <span>
              Batch is deterministic (seed {info.seed}) — the same seed reproduces every number
              above.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function ActorDot({ actor }: { actor: string }) {
  const tone = actor.includes("claude")
    ? "bg-brand"
    : actor.includes("rules") || actor === "agent"
      ? "bg-info"
      : actor === "gateway"
        ? "bg-warn"
        : actor === "webhook"
          ? "bg-good"
          : "bg-muted";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone}`} />;
}
