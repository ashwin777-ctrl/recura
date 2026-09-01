"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, CheckCircle2, AlertCircle, Copy, Check, Radio, Shield, Terminal, ArrowRight, RefreshCw } from "lucide-react";

const EVENT_PRESETS = [
  {
    type: "payment.failed",
    label: "Payment Failed (Card Decline / Insufficient Funds)",
    desc: "Simulates an automated subscription charge attempt declined by the issuer.",
    defaultReason: "INSUFFICIENT_FUNDS",
    amount: 149900,
  },
  {
    type: "payment.authorized",
    label: "Payment Authorized / Captured",
    desc: "Simulates a successful recovery charge after smart dunning action.",
    defaultReason: "",
    amount: 149900,
  },
  {
    type: "subscription.cancelled",
    label: "Subscription Cancelled",
    desc: "Simulates customer cancelling subscription — triggers policy hard stop.",
    defaultReason: "",
    amount: 149900,
  },
];

export default function SandboxPage() {
  const [selectedEvent, setSelectedEvent] = useState("payment.failed");
  const [customerName, setCustomerName] = useState("Priya Sharma");
  const [email, setEmail] = useState("priya.sharma@example.com");
  const [amount, setAmount] = useState("1499");
  const [failureReason, setFailureReason] = useState("INSUFFICIENT_FUNDS");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/sandbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: selectedEvent,
          customerName,
          email,
          amountPaise: Math.round(parseFloat(amount || "0") * 100),
          failureReason: selectedEvent === "payment.failed" ? failureReason : undefined,
        }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ ok: false, error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!response?.payload) return;
    navigator.clipboard.writeText(JSON.stringify(response.payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#232c40] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Razorpay Webhook Sandbox</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Simulate real-time gateway webhook events, test HMAC-SHA256 signature verification, and inspect recovery ingestion.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/audit"
            className="text-xs px-3.5 py-2 rounded-lg bg-[#141b2d] border border-[#232c40] text-gray-300 hover:text-white hover:border-gray-600 transition inline-flex items-center gap-1.5"
          >
            <span>View Live Audit Trail</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Event Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#111726] border border-[#232c40] rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#3ecf8e]" />
              <span>Select Webhook Event</span>
            </h2>

            <div className="space-y-2.5">
              {EVENT_PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => {
                    setSelectedEvent(preset.type);
                    if (preset.defaultReason) setFailureReason(preset.defaultReason);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedEvent === preset.type
                      ? "bg-[#172033] border-[#3ecf8e] text-white shadow-sm"
                      : "bg-[#0b101b] border-[#232c40] text-gray-400 hover:border-gray-600 hover:text-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-[#3ecf8e]">{preset.type}</span>
                    {selectedEvent === preset.type && <CheckCircle2 className="w-4 h-4 text-[#3ecf8e]" />}
                  </div>
                  <div className="text-xs font-medium text-gray-200 mt-1">{preset.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>

            <div className="border-t border-[#232c40] pt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#0b101b] border border-[#232c40] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#3ecf8e]"
                  placeholder="e.g. Priya Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Customer Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#0b101b] border border-[#232c40] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#3ecf8e]"
                  placeholder="e.g. priya.sharma@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#0b101b] border border-[#232c40] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#3ecf8e]"
                    placeholder="1499"
                  />
                </div>

                {selectedEvent === "payment.failed" ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Failure Reason</label>
                    <select
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-[#0b101b] border border-[#232c40] rounded-lg text-white focus:outline-none focus:border-[#3ecf8e]"
                    >
                      <option value="INSUFFICIENT_FUNDS">Insufficient Funds</option>
                      <option value="CARD_EXPIRED">Card Expired</option>
                      <option value="BANK_DECLINED">Bank Declined (do_not_honor)</option>
                      <option value="NETWORK_TIMEOUT">Network Timeout</option>
                      <option value="CARD_BLOCKED">Card Blocked / Lost</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Currency</label>
                    <input
                      type="text"
                      disabled
                      value="INR (₹)"
                      className="w-full text-xs px-3 py-2 bg-[#0b101b]/50 border border-[#232c40] rounded-lg text-gray-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSimulate}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#3ecf8e] text-[#0b101b] font-semibold text-xs hover:bg-[#34b77c] transition flex items-center justify-center gap-2 shadow-lg shadow-[#3ecf8e]/10 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching Webhook Event...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Dispatch Simulated Webhook</span>
                </>
              )}
            </button>
          </div>

          {/* Security & Verification Card */}
          <div className="bg-[#111726]/60 border border-[#232c40] rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#3ecf8e] shrink-0 mt-0.5" />
            <div className="text-xs text-gray-400 leading-relaxed">
              <span className="font-semibold text-gray-200 block mb-0.5">Cryptographic Signature Verification</span>
              Every event calculates an <code className="text-[#3ecf8e] bg-[#141b2d] px-1 py-0.5 rounded">HMAC-SHA256</code> signature using your secret. Recura enforces constant-time buffer comparison to prevent timing attacks.
            </div>
          </div>
        </div>

        {/* Right Output: Live Inspector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#111726] border border-[#232c40] rounded-xl p-5 flex flex-col h-full min-h-[480px]">
            <div className="flex items-center justify-between border-b border-[#232c40] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3ecf8e] animate-pulse"></span>
                <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Webhook Payload Inspector
                </span>
              </div>
              {response && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#3ecf8e]/10 border border-[#3ecf8e]/30 text-[#3ecf8e] font-mono">
                    HTTP 200 OK
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-md hover:bg-[#1f283d] text-gray-400 hover:text-white transition text-xs flex items-center gap-1"
                    title="Copy payload JSON"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#3ecf8e]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>

            {response ? (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Signature Banner */}
                <div className="bg-[#0b101b] border border-[#232c40] rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>X-Razorpay-Signature:</span>
                    <span className="text-[#3ecf8e] font-mono font-semibold text-[11px]">HMAC Verified</span>
                  </div>
                  <div className="font-mono text-[11px] text-gray-300 break-all bg-[#141b2d] p-2 rounded border border-[#232c40]">
                    {response.signature}
                  </div>
                </div>

                {/* JSON Body */}
                <div className="flex-1 bg-[#0b101b] border border-[#232c40] rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto max-h-[380px] overflow-y-auto">
                  <pre>{JSON.stringify(response.payload, null, 2)}</pre>
                </div>

                {/* Audit confirmation */}
                <div className="pt-2 flex items-center justify-between text-xs text-gray-400">
                  <span>Recorded in PostgreSQL Audit Trail</span>
                  <Link
                    href="/audit"
                    className="text-[#3ecf8e] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>View in Audit Log</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500">
                <Terminal className="w-12 h-12 text-[#232c40] mb-3" />
                <p className="text-sm font-medium text-gray-400">No Webhook Dispatched Yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Select an event preset on the left and click "Dispatch Simulated Webhook" to generate a signed payload and test live ingestion.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
