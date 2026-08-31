import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTOR_TONE: Record<string, "brand" | "info" | "warn" | "good" | "neutral"> = {
  "agent:claude": "brand",
  "agent:rules": "info",
  gateway: "warn",
  webhook: "good",
  system: "neutral",
};

export default async function AuditPage() {
  const events = await prisma.auditEvent.findMany({
    orderBy: [{ ts: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        desc="Append-only, timestamped record of every decision and gateway call. This is how a reviewer traces any single recovery end-to-end."
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[auto_130px_1fr_auto] gap-3 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted">
          <div className="w-28">Time</div>
          <div>Actor</div>
          <div>Event</div>
          <div>Case</div>
        </div>

        {events.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No audit events yet. Seed a batch and run recovery.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[auto_130px_1fr_auto] items-start gap-3 px-5 py-2.5 text-sm"
              >
                <div className="w-28 shrink-0 tnum text-xs text-muted">
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
                <div className="min-w-0">
                  <p className="text-fg">{e.message}</p>
                  <p className="text-[11px] text-muted">{e.event}</p>
                </div>
                <div className="shrink-0 text-right">
                  {e.caseId ? (
                    <Link href={`/cases/${e.caseId}`} className="text-xs text-brand hover:underline">
                      view case
                    </Link>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {events.length === 300 ? (
        <p className="mt-3 text-center text-xs text-muted">Showing the 300 most recent events.</p>
      ) : null}
    </div>
  );
}
