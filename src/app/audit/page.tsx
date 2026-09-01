import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { AuditFilterExport } from "@/components/AuditFilterExport";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const events = await prisma.auditEvent.findMany({
    orderBy: [{ ts: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        desc="Append-only, timestamped record of every decision and gateway call. Trace every single recovery end-to-end or export logs to CSV/JSON."
      />

      <AuditFilterExport
        events={events.map((e) => ({
          id: e.id,
          ts: e.ts,
          actor: e.actor,
          event: e.event,
          message: e.message,
          caseId: e.caseId,
          payload: e.payload,
        }))}
      />
    </div>
  );
}
