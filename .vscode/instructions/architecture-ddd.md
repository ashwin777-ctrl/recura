# Modular Architecture & Domain-Driven Boundaries

> Synthesized from **tech-leads-agent-skills** and **domain-analysis**.

---

## 1. Domain Bounded Contexts
Recura is divided into clean, decoupled domain modules:
- **`Recovery Policy Domain` (`src/lib/policy.ts`, `src/lib/failure-reasons.ts`)**: Pure deterministic rules, probability models, and stopping conditions.
- **`Engine & Orchestration Domain` (`src/lib/engine.ts`, `src/lib/agent.ts`)**: Execution pipelines, batch concurrency control, and AI narrative generation.
- **`Ingestion Domain` (`src/app/api/import/csv/route.ts`, `src/app/import/page.tsx`)**: CSV parsing, field validation, and atomic database persistence.
- **`Gateway & Webhook Domain` (`src/lib/razorpay.ts`, `src/app/api/webhooks/razorpay/route.ts`)**: Payment rail abstractions and HMAC webhook verification.
- **`Audit & Observability Domain` (`src/app/api/audit/route.ts`, `src/app/api/health/route.ts`)**: Immutable ledger queries, latency monitoring, and database telemetry.
