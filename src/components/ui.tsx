import { cn } from "@/lib/cn";

type Tone = "good" | "warn" | "bad" | "info" | "brand" | "neutral";

// ---- Card ----

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  desc,
  right,
  className,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {desc ? <p className="mt-0.5 text-xs text-muted">{desc}</p> : null}
      </div>
      {right}
    </div>
  );
}

// ---- Badge ----

const toneClasses: Record<Tone, string> = {
  good: "bg-good/12 text-good ring-1 ring-inset ring-good/20",
  warn: "bg-warn/12 text-warn ring-1 ring-inset ring-warn/20",
  bad: "bg-bad/12 text-bad ring-1 ring-inset ring-bad/20",
  info: "bg-info/12 text-info ring-1 ring-inset ring-info/20",
  brand: "bg-brand/12 text-brand ring-1 ring-inset ring-brand/25",
  neutral: "bg-surface-2 text-muted ring-1 ring-inset ring-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---- Button ----

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-brand text-white hover:bg-brand/90 disabled:hover:bg-brand",
    secondary: "bg-surface-2 text-fg border border-border hover:border-brand/50",
    ghost: "text-muted hover:text-fg hover:bg-surface-2",
    danger: "bg-bad/12 text-bad border border-bad/25 hover:bg-bad/20",
  };
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

// ---- Stat tile ----

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
}) {
  const valueTone: Record<Tone, string> = {
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    info: "text-info",
    brand: "text-brand",
    neutral: "text-fg",
  };
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tnum", valueTone[tone])}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </Card>
  );
}

// ---- Progress bar ----

export function Progress({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  const bar: Record<Tone, string> = {
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-bad",
    info: "bg-info",
    brand: "bg-brand",
    neutral: "bg-muted",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={cn("h-full rounded-full transition-all", bar[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {desc ? <p className="mt-1 text-sm text-muted">{desc}</p> : null}
      </div>
      {right}
    </div>
  );
}
