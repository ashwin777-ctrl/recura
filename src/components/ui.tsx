import { cn } from "@/lib/cn";
import React from "react";

export type Tone = "good" | "warn" | "bad" | "info" | "brand" | "neutral";

// ---- Card ----

export function Card({
  className,
  glow = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
  glow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-surface/90 backdrop-blur-md shadow-card transition-all duration-200",
        glow && "border-brand/40 shadow-[0_0_25px_-5px_rgba(91,140,255,0.15)]",
        className,
      )}
      {...props}
    >
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
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-2", className)}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3>
        {desc ? <p className="mt-0.5 text-xs text-muted leading-relaxed">{desc}</p> : null}
      </div>
      {right}
    </div>
  );
}

// ---- Badge ----

const toneClasses: Record<Tone, string> = {
  good: "bg-good/10 text-[#3ecf8e] ring-1 ring-inset ring-good/25 border-b border-good/20",
  warn: "bg-warn/10 text-[#f5b445] ring-1 ring-inset ring-warn/25 border-b border-warn/20",
  bad: "bg-bad/10 text-[#ff6b6b] ring-1 ring-inset ring-bad/25 border-b border-bad/20",
  info: "bg-info/10 text-[#59c2e6] ring-1 ring-inset ring-info/25 border-b border-info/20",
  brand: "bg-brand/10 text-[#5b8cff] ring-1 ring-inset ring-brand/30 border-b border-brand/25",
  neutral: "bg-surface-2/80 text-muted ring-1 ring-inset ring-border",
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
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium tracking-wide shadow-sm",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---- Pulse Dot ----

export function PulseDot({
  tone = "good",
  className,
}: {
  tone?: Tone;
  className?: string;
}) {
  const dotColor: Record<Tone, { ping: string; dot: string }> = {
    good: { ping: "bg-good", dot: "bg-good" },
    warn: { ping: "bg-warn", dot: "bg-warn" },
    bad: { ping: "bg-bad", dot: "bg-bad" },
    info: { ping: "bg-info", dot: "bg-info" },
    brand: { ping: "bg-brand", dot: "bg-brand" },
    neutral: { ping: "bg-muted", dot: "bg-muted" },
  };

  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span
        className={cn(
          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
          dotColor[tone].ping,
        )}
      />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", dotColor[tone].dot)} />
    </span>
  );
}

// ---- Button ----

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "brand-outline";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  const variants = {
    primary:
      "bg-brand text-white shadow-md shadow-brand/20 hover:bg-brand/90 active:scale-[0.98] disabled:hover:bg-brand border border-brand/40",
    secondary:
      "bg-surface-2 text-fg border border-border/90 hover:border-brand/50 hover:bg-[#1c2438] active:scale-[0.98]",
    ghost: "text-muted hover:text-fg hover:bg-surface-2 active:scale-[0.98]",
    danger: "bg-bad/10 text-bad border border-bad/25 hover:bg-bad/20 active:scale-[0.98]",
    "brand-outline":
      "border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10 active:scale-[0.98]",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-5 text-sm font-semibold",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
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
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
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

  const bgGradient: Record<Tone, string> = {
    good: "from-good/5 to-transparent",
    warn: "from-warn/5 to-transparent",
    bad: "from-bad/5 to-transparent",
    info: "from-info/5 to-transparent",
    brand: "from-brand/5 to-transparent",
    neutral: "from-surface-2/40 to-transparent",
  };

  return (
    <Card className={cn("p-5 relative overflow-hidden bg-gradient-to-b", bgGradient[tone])}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted/90">
          {label}
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted/60" />}
      </div>
      <div className={cn("mt-2 text-2xl font-bold tracking-tight tnum", valueTone[tone])}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted/90">{sub}</div> : null}
    </Card>
  );
}

// ---- Progress bar ----

export function Progress({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  const bar: Record<Tone, string> = {
    good: "bg-good shadow-[0_0_12px_rgba(62,207,142,0.4)]",
    warn: "bg-warn shadow-[0_0_12px_rgba(245,180,69,0.4)]",
    bad: "bg-bad shadow-[0_0_12px_rgba(255,107,107,0.4)]",
    info: "bg-info shadow-[0_0_12px_rgba(89,194,230,0.4)]",
    brand: "bg-brand shadow-[0_0_12px_rgba(91,140,255,0.4)]",
    neutral: "bg-muted",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2 border border-border/50">
      <div
        className={cn("h-full rounded-full transition-all duration-500", bar[tone])}
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg flex items-center gap-2">
          {title}
        </h1>
        {desc ? <p className="mt-1 text-sm text-muted leading-relaxed">{desc}</p> : null}
      </div>
      {right}
    </div>
  );
}
