import {
  Zap,
  Clock,
  CreditCard,
  Tag,
  OctagonX,
  CheckCircle2,
  XCircle,
  CircleDot,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { actionLabel, type ActionType } from "@/lib/types";
import { formatINR, formatPct } from "@/lib/money";
import { cn } from "@/lib/cn";

export type TimelineAction = {
  id: string;
  attemptNumber: number;
  actionType: string;
  decidedBy: string;
  reasoning: string | null;
  confidence: number | null;
  guardrails: string | null;
  scheduledFor: Date | null;
  executedAt: Date | null;
  outcome: string;
  amountPaise: number | null;
  detail: string | null;
};

const ICONS: Record<ActionType, typeof Zap> = {
  immediate_retry: Zap,
  delayed_retry_backoff: Clock,
  switch_payment_method: CreditCard,
  discount_offer: Tag,
  stop: OctagonX,
};

function outcomeBadge(outcome: string) {
  if (outcome === "success")
    return (
      <Badge tone="good">
        <CheckCircle2 className="h-3 w-3" /> Succeeded
      </Badge>
    );
  if (outcome === "failed")
    return (
      <Badge tone="bad">
        <XCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  if (outcome === "stopped")
    return (
      <Badge tone="neutral">
        <OctagonX className="h-3 w-3" /> Stopped
      </Badge>
    );
  return (
    <Badge tone="info">
      <CircleDot className="h-3 w-3" /> Pending
    </Badge>
  );
}

function fmtWhen(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CaseTimeline({ actions }: { actions: TimelineAction[] }) {
  if (!actions.length) {
    return <p className="px-5 pb-5 text-sm text-muted">No recovery actions yet — run the batch.</p>;
  }
  return (
    <ol className="relative space-y-0 px-5 pb-5">
      {actions.map((a, i) => {
        const Icon = ICONS[a.actionType as ActionType] ?? CircleDot;
        const last = i === actions.length - 1;
        const delayed = a.scheduledFor && a.executedAt && +new Date(a.scheduledFor) > +new Date(a.executedAt) - 1;
        return (
          <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-border" />}
            <div
              className={cn(
                "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                a.outcome === "success"
                  ? "bg-good/12 text-good ring-good/25"
                  : a.outcome === "failed"
                    ? "bg-bad/12 text-bad ring-bad/25"
                    : "bg-surface-2 text-muted ring-border",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg">
                  Attempt {a.attemptNumber}: {actionLabel(a.actionType)}
                </span>
                {outcomeBadge(a.outcome)}
                <Badge tone={a.decidedBy === "claude" ? "brand" : "neutral"}>
                  {a.decidedBy === "claude" ? "Claude" : "Rules"}
                </Badge>
              </div>

              {a.reasoning ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{a.reasoning}</p>
              ) : null}

              {a.guardrails ? (
                <p className="mt-1.5 rounded-md bg-warn/8 px-2.5 py-1.5 text-xs text-warn ring-1 ring-inset ring-warn/15">
                  Guardrail: {a.guardrails}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {a.confidence != null ? (
                  <span>
                    Expected success: <span className="tnum text-fg">{formatPct(a.confidence)}</span>
                  </span>
                ) : null}
                {a.amountPaise ? (
                  <span>
                    Charged: <span className="tnum text-fg">{formatINR(a.amountPaise)}</span>
                  </span>
                ) : null}
                {fmtWhen(a.executedAt) ? (
                  <span>
                    {delayed ? "Ran (after backoff)" : "Ran"}:{" "}
                    <span className="tnum text-fg">{fmtWhen(a.executedAt)}</span>
                  </span>
                ) : a.scheduledFor ? (
                  <span>
                    Scheduled: <span className="tnum text-fg">{fmtWhen(a.scheduledFor)}</span>
                  </span>
                ) : null}
                {a.detail ? <span className="text-muted/80">{a.detail}</span> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
