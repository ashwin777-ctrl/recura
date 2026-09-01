"use client";

import { useState } from "react";
import { Play, CheckCircle2, ShieldAlert, Sparkles, Sliders } from "lucide-react";
import { proposeAction, allowedActions } from "@/lib/policy";
import { analyzeCase } from "@/lib/intelligence";
import { REASONS } from "@/lib/failure-reasons";
import type { FailureReasonCode, CustomerSegment, DecisionContext } from "@/lib/types";
import { Badge, Card, CardHeader } from "./ui";

export function PolicyPlayground() {
  const [reason, setReason] = useState<FailureReasonCode>("INSUFFICIENT_FUNDS");
  const [attemptNumber, setAttemptNumber] = useState<number>(1);
  const [amountRupees, setAmountRupees] = useState<number>(1499);
  const [cancelled, setCancelled] = useState<boolean>(false);
  const [ltvRupees, setLtvRupees] = useState<number>(18000);
  const [segment, setSegment] = useState<CustomerSegment>("core");
  const [engagementScore, setEngagementScore] = useState<number>(0.75);

  const amountPaise = amountRupees * 100;
  const ltvPaise = ltvRupees * 100;

  const ctx: DecisionContext = {
    caseId: "sim-playground-test",
    reason,
    attemptNumber,
    maxAttempts: 3,
    amountPaise,
    method: "card",
    customer: {
      id: "sim-cust",
      name: "Simulated Customer",
      segment,
      engagementScore,
      ltvPaise,
      tenureMonths: 12,
      cancelled,
    },
    history: [],
    discountUsed: false,
  };

  const policyDecision = proposeAction(ctx);
  const validActions = allowedActions(ctx);
  const aiAnalysis = analyzeCase(ctx);

  return (
    <Card className="border-brand/30 bg-surface/90 shadow-xl overflow-hidden mt-6">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand" />
            <span>Interactive Policy & Guardrail Playground</span>
          </div>
        }
        desc="Test how stopping rules & AI recommendations evaluate any customer scenario in real-time."
        right={
          <Badge tone={policyDecision.actionType === "stop" ? "bad" : "brand"}>
            {policyDecision.actionType.toUpperCase()}
          </Badge>
        }
      />

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-6 space-y-4 bg-surface-2/60 p-4 rounded-xl border border-border/70">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-brand" /> Scenario Parameters
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Failure Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as FailureReasonCode)}
                className="w-full text-xs bg-[#0f1422] border border-border rounded-lg px-2.5 py-1.5 text-fg focus:outline-none focus:border-brand"
              >
                {Object.entries(REASONS).map(([code, spec]) => (
                  <option key={code} value={code}>
                    {spec.label} ({code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Attempt # (Cap: 3)</label>
              <select
                value={attemptNumber}
                onChange={(e) => setAttemptNumber(parseInt(e.target.value))}
                className="w-full text-xs bg-[#0f1422] border border-border rounded-lg px-2.5 py-1.5 text-fg focus:outline-none focus:border-brand"
              >
                <option value={1}>Attempt 1 (Initial failure)</option>
                <option value={2}>Attempt 2 (First retry)</option>
                <option value={3}>Attempt 3 (Final retry)</option>
                <option value={4}>Attempt 4 (Exceeds policy cap)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Payment Amount (INR)</label>
              <input
                type="number"
                value={amountRupees}
                onChange={(e) => setAmountRupees(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full text-xs bg-[#0f1422] border border-border rounded-lg px-2.5 py-1.5 text-fg focus:outline-none focus:border-brand font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Customer LTV (INR)</label>
              <input
                type="number"
                value={ltvRupees}
                onChange={(e) => setLtvRupees(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full text-xs bg-[#0f1422] border border-border rounded-lg px-2.5 py-1.5 text-fg focus:outline-none focus:border-brand font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Customer Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as CustomerSegment)}
                className="w-full text-xs bg-[#0f1422] border border-border rounded-lg px-2.5 py-1.5 text-fg focus:outline-none focus:border-brand"
              >
                <option value="vip">VIP (High LTV)</option>
                <option value="core">Core (Standard)</option>
                <option value="new">New Customer</option>
                <option value="at_risk">At Risk</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Customer Status</label>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cancelled"
                    checked={!cancelled}
                    onChange={() => setCancelled(false)}
                  />
                  <span>Active</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cancelled"
                    checked={cancelled}
                    onChange={() => setCancelled(true)}
                  />
                  <span className="text-bad font-medium">Cancelled</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Live Evaluation Output */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          {/* Policy Outcome */}
          <div className="p-4 rounded-xl border border-border bg-[#0a0e17] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Deterministic Policy Result
              </span>
              <span className="text-xs font-mono text-brand">
                Delay: {policyDecision.delayHours}h
              </span>
            </div>

            <div className="text-sm font-semibold text-fg">
              {policyDecision.actionType !== "stop" ? (
                <span className="text-good flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Action Allowed: {policyDecision.actionType}
                </span>
              ) : (
                <span className="text-bad flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Halted / Abandoned: {policyDecision.reasoning}
                </span>
              )}
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Allowed actions in this state:{" "}
              <span className="text-fg font-mono">
                {validActions.length > 0 ? validActions.join(", ") : "none (terminal state)"}
              </span>
            </p>
          </div>

          {/* AI Intelligence Scoring */}
          <div className="p-4 rounded-xl border border-brand/25 bg-brand/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                <Sparkles className="w-3.5 h-3.5" /> Recura AI Churn Evaluation
              </div>
              <Badge
                tone={
                  aiAnalysis.classification === "HIGH"
                    ? "good"
                    : aiAnalysis.classification === "MEDIUM"
                      ? "warn"
                      : "bad"
                }
              >
                Score: {aiAnalysis.score}/100 ({aiAnalysis.classification})
              </Badge>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              <span className="font-semibold text-fg">AI Strategy:</span> {aiAnalysis.reasoning}
            </p>

            {aiAnalysis.guardrails.length > 0 && (
              <div className="text-[11px] text-warn border-t border-warn/20 pt-1.5 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 shrink-0" />
                <span>{aiAnalysis.guardrails.join("; ")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
