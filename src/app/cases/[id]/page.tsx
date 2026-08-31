import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, CreditCard, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRuntimeInfo } from "@/lib/metrics";
import { REASONS } from "@/lib/failure-reasons";
import { formatINR } from "@/lib/money";
import type { FailureReasonCode } from "@/lib/types";
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
          right={<ExplainButton caseId={c.id} available={info.llmAvailable} />}
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
