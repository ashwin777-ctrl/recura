"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINRCompact, formatPct } from "@/lib/money";

const AXIS = { fill: "#8a97b1", fontSize: 11 };
const GRID = "#232c40";

function ChartTip({ active, payload, label, kind }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-card">
      <div className="mb-1 font-medium text-fg">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-muted">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color ?? p.fill }}
          />
          {p.name}:{" "}
          <span className="tnum font-medium text-fg">
            {kind === "pct" ? formatPct(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

type ReasonRow = {
  label: string;
  cases: number;
  recovered: number;
  atRiskPaise: number;
  recoveredPaise: number;
  rate: number;
};

export function ReasonChart({ data }: { data: ReasonRow[] }) {
  const rows = data.map((d) => ({
    name: d.label,
    Recovered: d.recovered,
    Unrecovered: d.cases - d.recovered,
    rate: d.rate,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 4 }} barSize={22}>
        <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} interval={0} angle={0} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(91,140,255,0.06)" }} content={<ChartTip />} />
        <Bar dataKey="Recovered" stackId="a" fill="#3ecf8e" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Unrecovered" stackId="a" fill="#232c40" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type ActionRow = { label: string; executed: number; succeeded: number; rate: number };

export function ActionChart({ data }: { data: ActionRow[] }) {
  const rows = data
    .filter((d) => d.executed > 0)
    .map((d) => ({ name: d.label, rate: d.rate, executed: d.executed, succeeded: d.succeeded }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barSize={18}>
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={(v) => formatPct(v)}
          tick={AXIS}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={AXIS}
          width={128}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "rgba(91,140,255,0.06)" }} content={<ChartTip kind="pct" />} />
        <Bar dataKey="rate" name="Success rate" radius={[0, 4, 4, 0]}>
          {rows.map((_, i) => (
            <Cell key={i} fill="#5b8cff" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AttemptChart({ data }: { data: { attempt: number; recovered: number }[] }) {
  const rows = data.map((d) => ({ name: `Attempt ${d.attempt}`, Recovered: d.recovered }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 4 }} barSize={40}>
        <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(91,140,255,0.06)" }} content={<ChartTip />} />
        <Bar dataKey="Recovered" fill="#59c2e6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
