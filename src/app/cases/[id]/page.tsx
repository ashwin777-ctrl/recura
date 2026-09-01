import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, CreditCard, AlertCircle, Sparkles, Brain, CheckCircle2, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRuntimeInfo } from "@/lib/metrics";
import { REASONS } from "@/lib/failure-reasons";
import { formatINR } from "@/lib/money";
import { analyzeCase, explainCaseNarrative } from "@/lib/intelligence";
import { ACTION_META } from "@/lib/types";
import type { FailureReasonCode, DecisionContext, ActionType, Outcome } from "@/lib/types";
import { Card, CardHeader, Badge, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CaseTimeline } from "@/components/CaseTimeline";
import { ExplainButton } from "@/components/ExplainButton";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, info] = await Promise.all([
    prisma.recoveryCase.findUnique({
      where: { id },
      include: {
        customer: true,
        subscription: true,
        actions: { orderBy: { attemptNumber: "asc" } },
        attempts: { orderBy: { attemptNumber: "asc" } },
        events: { orderBy: [{ ts: "asc" }, { createdAt: "asc" }] },
      },
    }),
    getRuntimeInfo(),
  ]);

  if (!c) notFound();

  const spec = REASONS[c.reason as FailureReasonCode];

  const history: DecisionContext["history"] = c.actions
    .filter((a) => a.executedAt)
    .map((a) => ({
      attemptNumber: a.attemptNumber,
      actionType: a.actionType as ActionType,
      outcome: a.outcome as Outcome,
    }));

  const discountUsed = c.actions.some((a) => a.actionType === "discount_offer" && a.outcome === "success");

  const ctx: DecisionContext = {
    caseId: c.id,
    reason: c.reason as FailureReasonCode,
    attemptNumber: Math.max(1, c.currentAttempt),
    maxAttempts: c.maxAttempts,
    amountPaise: c.amountAtRiskPaise,
    method: c.subscription.method as any,
    cardLast4: c.subscription.cardLast4,
    customer: {
      id: c.customer.id,
      name: c.customer.name,
      segment: c.customer.segment as any,
      engagementScore: c.customer.engagementScore,
      ltvPaise: c.customer.ltvPaise,
      tenureMonths: c.customer.tenureMonths,
      cancelled: c.customer.cancelled,
    },
    history,
    discountUsed,
  };

  const aiAnalysis = analyzeCase(ctx);
  const narrative = explainCaseNarrative(aiAnalysis, ctx);

  return (
    <div>
      <Link
        href="/cases"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> All cases
      </Link>

      <PageHeader
        title={c.customer.name}
        desc={`Recovery case · opened ${new Date(c.openedAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`}
        right={<StatusBadge status={c.status} />}
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <AlertCircle className="h-4 w-4" /> Failure
          </div>
          <div className="text-sm font-semibold text-fg">{spec?.label ?? c.reason}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{spec?.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="neutral">{spec?.razorpayCode ?? "—"}</Badge>
            <span className="tnum text-sm text-fg">{formatINR(c.amountAtRiskPaise)} at risk</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <User className="h-4 w-4" /> Customer
          </div>
          <dl className="space-y-1.5 text-sm">
            <Row k="Segment" v={<span className="capitalize">{c.customer.segment}</span>} />
            <Row k="Lifetime value" v={formatINR(c.customer.ltvPaise)} />
            <Row k="Tenure" v={`${c.customer.tenureMonths} months`} />
            <Row k="Engagement" v={`${Math.round(c.customer.engagementScore * 100)}%`} />
            <Row
              k="Subscription"
              v={c.customer.cancelled ? <Badge tone="bad">Cancelled</Badge> : <Badge tone="good">Active</Badge>}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <CreditCard className="h-4 w-4" /> Plan & outcome
          </div>
          <dl className="space-y-1.5 text-sm">
            <Row k="Plan" v={c.subscription.planName} />
            <Row k="Amount" v={`${formatINR(c.subscription.amountPaise)}/mo`} />
            <Row
              k="Method"
              v={
                <span className="capitalize">
                  {c.subscription.method}
                  {c.subscription.cardLast4 ? ` ••••${c.subscription.cardLast4}` : ""}
                </span>
              }
            />
            <Row
              k="Recovered"
              v={
                c.amountRecoveredPaise > 0 ? (
                  <span className="text-good">{formatINR(c.amountRecoveredPaise)}</span>
                ) : (
                  "—"
                )
              }
            />
            <Row k="Attempts used" v={`${c.currentAttempt} of ${c.maxAttempts}`} />
          </dl>
        </Card>
      </div>

      {/* Recura Recovery Intelligence Card */}
      <Card className="mt-4 border-brand/30 bg-surface-2 p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-fg">Recura Recovery Intelligence</span>
                <Badge
                  tone={
                    aiAnalysis.classification === "HIGH"
                      ? "good"
                      : aiAnalysis.classification === "MEDIUM"
                        ? "warn"
                        : "bad"
                  }
                >
                  {aiAnalysis.classification} LIKELIHOOD
                </Badge>
              </div>
              <p className="text-xs text-muted">
                Deterministic recovery probability score computed locally from behavioral and telemetry signals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start rounded-lg border border-border bg-surface px-4 py-2 text-center md:self-auto">
            <span className="text-xs text-muted">Recovery Score:</span>
            <span className="tnum text-xl font-bold text-brand">{aiAnalysis.score}</span>
            <span className="text-xs text-muted">/ 100</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border/70 pt-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Decision Influencing Factors
            </div>
            <ul className="space-y-1.5 text-xs text-fg">
              {aiAnalysis.factors.map((f, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Recommended Action
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="brand">{ACTION_META[aiAnalysis.recommendedAction]?.label ?? aiAnalysis.recommendedAction}</Badge>
                <span className="text-xs text-muted">Delay: {aiAnalysis.delayHours}h</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{aiAnalysis.reasoning}</p>
            </div>
            {aiAnalysis.guardrails.length > 0 ? (
              <div className="rounded border border-warn/30 bg-warn/5 p-2 text-xs text-warn">
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" /> Policy Guardrail Enforced
                </div>
                <div className="mt-1 text-[11px] text-muted">{aiAnalysis.guardrails.join(", ")}</div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Close reason banner */}
      {c.closeReason ? (
        <Card
          className={`mt-4 p-4 text-sm ${
            c.status === "recovered"
              ? "border-good/25 bg-good/5 text-good"
              : c.status === "abandoned"
                ? "border-border bg-surface-2 text-muted"
                : "border-bad/25 bg-bad/5 text-bad"
          }`}
        >
          <span className="font-medium">Outcome:</span> {c.closeReason}
        </Card>
      ) : null}

      {/* Decision timeline */}
      <Card className="mt-4">
        <CardHeader
          title="Decision & execution trace"
          desc="Every action the agent took, why, and what the gateway returned"
          right={<ExplainButton caseId={c.id} available={true} />}
        />
        <CaseTimeline actions={c.actions} />
      </Card>

      {/* Raw audit + payment attempts */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Audit events" desc="Append-only, timestamped" />
          <div className="max-h-80 overflow-y-auto px-5 pb-4 pt-2">
            <ol className="space-y-2.5">
              {c.events.map((e) => (
                <li key={e.id} className="text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="tnum shrink-0 text-muted">
                      {new Date(e.ts).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-fg">{e.message}</span>
                  </div>
                  <span className="ml-0 text-[11px] text-muted">{e.actor}</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment attempts" desc="What actually hit the gateway" />
          <div className="px-5 pb-4 pt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1.5 font-medium">#</th>
                  <th className="py-1.5 font-medium">Amount</th>
                  <th className="py-1.5 font-medium">Status</th>
                  <th className="py-1.5 font-medium">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {c.attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 tnum text-muted">
                      {a.attemptNumber === 0 ? "orig" : a.attemptNumber}
                    </td>
                    <td className="py-2 tnum text-fg">{formatINR(a.amountPaise)}</td>
                    <td className="py-2">
                      {a.status === "success" ? (
                        <Badge tone="good">success</Badge>
                      ) : (
                        <Badge tone="bad">failed</Badge>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted">{a.failureCode ?? a.gateway}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-fg">{v}</dd>
    </div>
  );
}
