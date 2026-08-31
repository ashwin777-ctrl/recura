import { Badge } from "@/components/ui";
import { CASE_STATUS_META, type CaseStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  const meta = CASE_STATUS_META[status as CaseStatus] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
