import { ShieldCheck, Ban, Clock, Coins, Repeat, OctagonX, Lock } from "lucide-react";
import { POLICY } from "@/lib/policy";
import { REASONS } from "@/lib/failure-reasons";
import { formatINR } from "@/lib/money";
import { Card, CardHeader, Badge, PageHeader } from "@/components/ui";
import { PolicyPlayground } from "@/components/PolicyPlayground";

export const dynamic = "force-dynamic";

const REASON_STRATEGY: Record<string, string> = {
  INSUFFICIENT_FUNDS:
    "Wait out the backoff (payday cycle), retry the same card; escalate high-LTV customers to a win-back on the last attempt.",
  CARD_EXPIRED: "Never retry the dead card — prompt a new method immediately; win-back on the last attempt if eligible.",
  BANK_DECLINED:
    "One immediate retry (issuer noise), then switch rails; win-back on the last attempt if eligible.",
  NETWORK_TIMEOUT: "Immediate retry (transient), then short-backoff retries only.",
  CARD_BLOCKED: "Never retry a blocked card — require a new method; win-back on the last attempt if eligible.",
};

export default function PolicyPage() {
  const reasons = Object.values(REASONS);

  return (
    <div>
      <PageHeader
        title="Policy & stopping rules"
        desc="The controlled part of a controlled agent. These rules run deterministically on every decision and cannot be overridden — by the AI engine or anything else."
      />

      {/* Guardrail statement */}
      <Card className="border-brand/25 bg-brand/5 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div>
            <h3 className="text-sm font-semibold text-brand">Hard guardrail</h3>
            <p className="mt-1 text-sm leading-relaxed text-fg">
              The deterministic policy engine always runs first. When the Recura Intelligence layer is enabled it
              may only <span className="font-medium">re-pick within the allowed actions</span> for
              the current state — it can never exceed the attempt cap, retry a dead instrument, dun a
              cancelled customer, or chase an uneconomical amount. If the AI engine proposes anything outside
              the allowed set, the system falls back to the rules decision and records the override
              in the audit trail.
            </p>
          </div>
        </div>
      </Card>

      {/* Hard stops */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RuleCard
          icon={Repeat}
          title="Max attempts"
          value={`${POLICY.maxAttempts} per case`}
          desc="After the third recovery attempt fails, the case is marked exhausted and closed. No infinite retries."
        />
        <RuleCard
          icon={Coins}
          title="Minimum recoverable amount"
          value={formatINR(POLICY.minRecoverableAmountPaise)}
          desc="Charges below this are abandoned cleanly — a retry would cost more in fees and goodwill than it can recover."
        />
        <RuleCard
          icon={Ban}
          title="No dunning after cancellation"
          value="Halt immediately"
          desc="If the customer has cancelled, recovery stops before any attempt. We never chase a customer who has left."
        />
        <RuleCard
          icon={Clock}
          title="Standard backoff"
          value={POLICY.backoffHours.map((h) => `${h}h`).join(" → ")}
          desc="Waits before each attempt for funds/method failures — lets balances recover instead of hammering the card."
        />
        <RuleCard
          icon={Clock}
          title="Transient backoff"
          value={POLICY.transientBackoffHours.map((h) => `${h}h`).join(" → ")}
          desc="Shorter waits for clearly transient failures (network timeouts) where an early retry is likely to clear."
        />
        <RuleCard
          icon={OctagonX}
          title="Cool-off"
          value={`${POLICY.coolOffHours}h`}
          desc="Minimum spacing enforced between customer-facing prompts so recovery never feels like spam."
        />
      </div>

      {/* Discount eligibility */}
      <Card className="mt-4">
        <CardHeader
          title="Win-back discount eligibility"
          desc="The one lever that gives up revenue — tightly gated"
        />
        <div className="flex flex-wrap gap-6 px-5 pb-5 pt-3 text-sm">
          <Gate label="Offer size" value={`${POLICY.discount.percent}% one-time`} />
          <Gate label="Min lifetime value" value={formatINR(POLICY.discount.eligibleMinLtvPaise)} />
          <Gate
            label="Eligible segments"
            value={POLICY.discount.eligibleSegments.map((s) => (
              <Badge key={s} tone="brand" className="capitalize">
                {s}
              </Badge>
            ))}
          />
          <Gate label="Timing" value="Final attempt only" />
          <Gate label="Frequency" value="Once per case" />
        </div>
      </Card>

      {/* Per-reason playbook */}
      <Card className="mt-4">
        <CardHeader
          title="Per-reason playbook"
          desc="How the agent treats each failure type, and the probability model behind its confidence"
        />
        <div className="overflow-x-auto px-5 pb-5 pt-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-medium">Reason</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Retry odds (1→3)</th>
                <th className="py-2 font-medium">Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reasons.map((r) => (
                <tr key={r.code} className="align-top">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-fg">{r.label}</div>
                    <div className="text-[11px] text-muted">{r.razorpayCode}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge
                      tone={
                        r.category === "transient"
                          ? "info"
                          : r.category === "funds"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {r.category}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 tnum text-muted">
                    {r.retryProb.map((p) => `${Math.round(p * 100)}%`).join(" · ")}
                  </td>
                  <td className="py-3 text-xs leading-relaxed text-muted">
                    {REASON_STRATEGY[r.code]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Interactive Playground */}
      <PolicyPlayground />

      <div className="mt-6 flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-4 w-4 text-good" />
        Every one of these rules is unit-tested and enforced deterministically (see <code className="text-fg">src/tests/policy.test.ts</code>).
      </div>
    </div>
  );
}

function RuleCard({
  icon: Icon,
  title,
  value,
  desc,
}: {
  icon: typeof Repeat;
  title: string;
  value: string;
  desc: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
      </div>
      <div className="mt-2 text-lg font-semibold tnum text-fg">{value}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{desc}</p>
    </Card>
  );
}

function Gate({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 font-medium text-fg">{value}</div>
    </div>
  );
}
