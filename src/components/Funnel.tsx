import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";

type Stage = { stage: string; cases: number; amountPaise: number };

const TONES = ["bg-bad/70", "bg-warn/70", "bg-good/70"];

export function Funnel({ stages }: { stages: Stage[] }) {
  const top = Math.max(1, stages[0]?.cases ?? 1);
  return (
    <div className="space-y-3 px-5 pb-5 pt-4">
      {stages.map((s, i) => {
        const pct = s.cases / top;
        const conv = i === 0 ? 1 : s.cases / (stages[0]?.cases || 1);
        return (
          <div key={s.stage}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-fg">{s.stage}</span>
              <span className="text-muted">
                <span className="tnum text-fg">{s.cases}</span>
                {s.amountPaise > 0 ? (
                  <span className="tnum"> · {formatINR(s.amountPaise)}</span>
                ) : null}
                {i > 0 ? <span className="tnum"> · {(conv * 100).toFixed(0)}%</span> : null}
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-md bg-surface-2">
              <div
                className={cn("flex h-full items-center rounded-md transition-all", TONES[i] ?? "bg-brand/70")}
                style={{ width: `${Math.max(4, pct * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
