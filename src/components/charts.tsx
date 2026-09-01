"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINRCompact, formatPct } from "@/lib/money";

const AXIS = { fill: "#8a97b1", fontSize: 11 };
const GRID = "#232c40";

const SHORT_LABELS: Record<string, string> = {
  "Insufficient funds": "Insufficient funds",
  "Card expired": "Card expired",
  "Bank declined (do_not_honor)": "Bank declined",
  "Bank declined": "Bank declined",
  "Network timeout (gateway)": "Network timeout",
  "Network timeout": "Network timeout",
  "Card blocked / lost": "Card blocked",
  "Card blocked": "Card blocked",
};

function ChartTip({ active, payload, label, kind }: any) {
  if (!active || !payload?.length) return null;
  const firstItem = payload[0]?.payload;
  const title = firstItem?.fullName || label;

  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs shadow-card backdrop-blur-md">
      <div className="mb-1.5 font-medium text-fg">{title}</div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3 text-muted">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.color ?? p.fill }}
              />
              <span>{p.name}:</span>
            </div>
            <span className="tnum font-semibold text-fg">
              {kind === "pct" ? formatPct(p.value) : p.value}
            </span>
          </div>
        ))}
        {firstItem?.rate !== undefined ? (
          <div className="mt-1 border-t border-border/60 pt-1 flex items-center justify-between text-[11px] text-muted">
            <span>Recovery rate:</span>
            <span className="font-semibold text-good">{formatPct(firstItem.rate)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Custom wrapped / clean tick for X-Axis to prevent overlap
function ReasonXAxisTick({ x, y, payload }: any) {
  const label = payload.value;
  // Break into 2 lines if longer than 11 chars
  const words = label.split(" ");
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="middle"
        fill="#8a97b1"
        fontSize={10.5}
        className="font-sans"
      >
        {words.length === 2 ? (
          <>
            <tspan x="0" dy="8">
              {words[0]}
            </tspan>
            <tspan x="0" dy="12">
              {words[1]}
            </tspan>
          </>
        ) : (
          <tspan x="0" dy="10">
            {label}
          </tspan>
        )}
      </text>
    </g>
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
    name: SHORT_LABELS[d.label] ?? d.label,
    fullName: d.label,
    Recovered: d.recovered,
    Unrecovered: d.cases - d.recovered,
    rate: d.rate,
    cases: d.cases,
  }));

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-end gap-4 text-[11px] text-muted">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#3ecf8e]" />
          <span>Recovered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#232c40]" />
          <span>Unrecovered</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, left: -18, bottom: 20 }}
          barCategoryGap="20%"
          barSize={20}
        >
          <XAxis
            dataKey="name"
            tick={<ReasonXAxisTick />}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            interval={0}
            height={42}
          />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(91,140,255,0.06)" }} content={<ChartTip />} />
          <Bar dataKey="Recovered" name="Recovered" stackId="a" fill="#3ecf8e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Unrecovered" name="Unrecovered" stackId="a" fill="#232c40" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
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
