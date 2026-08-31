# Recura — AI Revenue Recovery

**A controlled AI agent that recovers failed subscription payments — with hard stopping rules, a full audit trail, and honest batch metrics.**

Recura takes a batch of failed recurring charges (the kind every subscription business silently loses to *involuntary churn*), and works each one like a careful ops analyst: it classifies **why** the payment failed, picks the right recovery move, retries against the payment gateway, and **stops cleanly** the moment continuing would be pointless or abusive. Every decision is logged so a reviewer can trace any single case from failure to outcome.

> Built for **Track 3: AI Revenue Recovery**. Payment execution runs against **Razorpay test mode** (or a deterministic built-in simulator); the recovery *decisions* are the product.

---

## The headline (seed `42`, 80-customer batch — reproducible)

| Metric | Result |
| --- | --- |
| Failed payments processed | **80** (₹51,820 at risk) |
| Recovered (by count) | **52 / 80 → 65.0%** |
| Recovered (by value) | **₹38,930 → 75.1%** |
| **Stopped cleanly** (no over-dunning) | **28** (9 hit the attempt cap, 19 halted before any retry) |
| Avg attempts to recover | **1.6** |
| Saved via win-back discount | 12 cases (₹1,918 in discounts given up to retain recurring revenue) |

Two things make these numbers trustworthy:

1. **They come from a whole batch, not a cherry-picked demo.** Re-run the batch and you get the same figures, every time (deterministic seed).
2. **Value-recovery (75.1%) is higher than count-recovery (65.0%) *on purpose*.** The agent chases the ₹2,999 subscriptions and walks away from ₹49 add-ons and cancelled customers. It optimizes for money saved, not a vanity success rate.

---

## Why this isn't "a bot that retries forever"

The scary version of a payment-recovery agent hammers a customer's card 20 times and gets the merchant's account flagged. Recura is the opposite — the **stopping rules are first-class and visible** (see the **Policy** page in the app):

- **Max 3 attempts per case.** Then the case is `exhausted` and closed. Full stop.
- **No dunning after cancellation.** If the customer already left, recovery halts before the first retry.
- **Minimum recoverable amount (₹50).** Below this, a retry costs more in fees/goodwill than it can recover, so the case is abandoned cleanly.
- **Backoff between attempts** (0h → 72h → 120h for funds failures; shorter for transient network errors) so we wait for payday instead of re-charging a dry account.
- **Never retry a dead instrument.** Expired/blocked cards go straight to "update your payment method" — retrying them is guaranteed to fail.
- **Win-back discounts are tightly gated** — high-LTV `core`/`vip` customers only, once per case, on the final attempt.

These rules are enforced by a **deterministic policy engine** and are **unit-tested** (`src/tests/policy.test.ts`, 16 tests). The optional Claude layer can only *re-pick within the actions the policy already allows* — it can never exceed the cap, dun a cancelled customer, or override a hard stop. If Claude proposes something disallowed, the system falls back to the rules decision **and records the override in the audit trail.**

---

## Architecture

```mermaid
flowchart TD
    subgraph Seed["1 · Synthetic batch"]
      G["Deterministic generator<br/>(seeded RNG)"] --> DB[(SQLite via Prisma)]
    end

    subgraph Engine["2 · Recovery engine (per case, simulated clock)"]
      direction TB
      P["Policy engine<br/>(hard stopping rules)"] --> A{"AI layer<br/>enabled?"}
      A -- "no" --> D["Decision"]
      A -- "yes" --> C["Claude re-picks<br/>within allowed actions"] --> GR["Guardrail check"] --> D
      D --> X["Execute via gateway"]
    end

    subgraph GW["3 · Payment gateway"]
      SIM["Simulation<br/>(deterministic outcome)"]
      RZP["Razorpay TEST mode<br/>(real orders)"]
    end

    subgraph Out["4 · Evidence"]
      M["Batch metrics<br/>recovery rate, ₹ recovered"]
      AUD["Append-only audit log"]
    end

    DB --> P
    X --> SIM
    X --> RZP
    X --> DB
    DB --> M
    Engine --> AUD
    M --> UI["Dashboard"]
    AUD --> UI
```

The **single source of truth** for "how likely is this action to succeed" ([`successProbability()`](src/lib/failure-reasons.ts)) is used by *both* the agent's stated confidence *and* the simulator's actual outcome draw — so the confidence a reviewer sees is honest, not decorative.

Full write-up in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Pitch script in [docs/PITCH.md](docs/PITCH.md).

---

## What's real vs. simulated

Being explicit here, because it matters for a payments track:

| Piece | Status |
| --- | --- |
| Recovery **decision logic** & stopping rules | **Real.** Deterministic policy engine, fully unit-tested. |
| **Claude** agent reasoning / per-case explanations | **Real** when `ANTHROPIC_API_KEY` is set (model: `claude-haiku-4-5`). Degrades gracefully to rules-only without a key. |
| Razorpay **order creation** | **Real** against Razorpay TEST mode when `RAZORPAY_MODE=live` + keys are set — actual API calls to `api.razorpay.com`. |
| Whether a retried charge ultimately **succeeds** | **Simulated** from the probability model. You can't script a real card to "fail twice then succeed on payday" in a hackathon, so the *outcome* is modeled — transparently, from one source of truth. |
| Customer batch (names, plans, failure reasons) | **Synthetic**, deterministically generated. |
| Audit trail, metrics, dashboard | **Real** — computed from the actual database rows the engine wrote. |

Out of the box it runs **100% offline** on the simulator with zero keys. Add keys to light up the real Razorpay + Claude paths.

---

## Quickstart

Requires Node 18+.

```bash
npm install
npm run setup      # generate Prisma client, create the SQLite DB, seed the batch
npm run dev        # http://localhost:3000
```

Then in the dashboard: **Run recovery batch** (instant, deterministic) → explore the funnel, the per-case traces, the audit log, and the **Policy** page.

To reset and reproduce from scratch at any time:

```bash
npm run db:reset   # drop + recreate schema
npm run seed       # re-seed the deterministic batch
```

Run the stopping-rule tests:

```bash
npm run test
```

### Optional: turn on the real integrations

Copy `.env.example` to `.env` and fill in what you want:

```bash
# Enable live Razorpay TEST-mode order creation
RAZORPAY_MODE="live"
RAZORPAY_KEY_ID="rzp_test_xxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxx"

# Enable the Claude reasoning layer + "Explain with AI"
ANTHROPIC_API_KEY="sk-ant-xxxx"
```

With a Claude key set, the **Run with AI** button routes up to 12 cases through Claude (bounded by the same guardrails), and every case detail page gets an **Explain with AI** button that narrates the decision trail in plain English.

---

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite location. |
| `RECURA_SEED` | `42` | Deterministic batch seed — the knob for reproducibility. |
| `RAZORPAY_MODE` | `simulation` | `simulation` or `live` (Razorpay TEST mode). |
| `RAZORPAY_KEY_ID` / `_SECRET` | — | Razorpay TEST keys (live mode only). |
| `RAZORPAY_WEBHOOK_SECRET` | — | Verifies incoming webhook signatures. |
| `ANTHROPIC_API_KEY` | — | Enables the Claude agent + explanations. |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Model for per-case reasoning. |

---

## Project structure

```
src/
  lib/
    failure-reasons.ts   # reason catalog + the single-source-of-truth probability model
    policy.ts            # the stopping rules + reason-specific playbook (deterministic)
    agent.ts             # policy + optional Claude layer, with the hard guardrail
    engine.ts            # per-case recovery loop with a simulated clock
    gateway/             # PaymentGateway interface: simulation + real Razorpay adapter
    metrics.ts           # batch metrics computed from DB rows
    claude.ts            # Claude decision + explanation calls (optional)
    seed-data.ts         # deterministic synthetic batch generator
  app/
    page.tsx             # Overview dashboard (funnel, charts, KPIs)
    cases/               # case list + end-to-end case trace
    audit/               # append-only audit log
    policy/              # the visible stopping rules
    api/                 # seed / run / reset / metrics / cases / audit / webhook
  tests/policy.test.ts   # 16 tests pinning the stopping rules
```

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Prisma + SQLite · Tailwind · Recharts · Anthropic SDK · Vitest.

---

## License

MIT — built for a hackathon; use it however helps.
