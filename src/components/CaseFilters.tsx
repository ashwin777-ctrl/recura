"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { REASONS } from "@/lib/failure-reasons";
import { CASE_STATUS_META } from "@/lib/types";
import { cn } from "@/lib/cn";

const STATUSES = Object.keys(CASE_STATUS_META);
const REASON_KEYS = Object.keys(REASONS);

export function CaseFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const reason = params.get("reason") ?? "";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip active={!status && !reason} onClick={() => router.push(pathname)}>
        All
      </Chip>
      <Select
        value={status}
        onChange={(v) => setParam("status", v)}
        placeholder="Any status"
        options={STATUSES.map((s) => ({
          value: s,
          label: CASE_STATUS_META[s as keyof typeof CASE_STATUS_META].label,
        }))}
      />
      <Select
        value={reason}
        onChange={(v) => setParam("reason", v)}
        placeholder="Any failure reason"
        options={REASON_KEYS.map((r) => ({ value: r, label: REASONS[r as keyof typeof REASONS].label }))}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-brand/12 text-brand ring-1 ring-inset ring-brand/25"
          : "bg-surface-2 text-muted ring-1 ring-inset ring-border hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg outline-none transition-colors hover:border-brand/40 focus:border-brand"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
