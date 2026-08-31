# Architecture

Recura is a Next.js app with a clean separation between **decision-making** (the product) and **execution** (the payment gateway). This doc explains the moving parts and the design decisions that make the output trustworthy.

## Design goals (in priority order)

1. **Controlled, not autonomous-to-a-fault.** Hard stopping rules that an LLM cannot override. This is the difference between a recovery agent and a liability.
2. **Honest numbers.** Metrics come from a full batch and are reproducible; stated confidence matches the model that actually decides outcomes.
3. **Traceable.** A reviewer can pick any case and see every decision, why it was made, who made it, and what the gateway returned.
4. **Real where it counts.** Real gateway calls, real agent reasoning — with an explicit line around the one thing that must be simulated.

## Data model (Prisma / SQLite)

Seven tables, append-only where it matters:

- **Customer** — segment, engagement score (0–1), lifetime value, tenure, cancellation flag. Drives eligibility and success probability.
- **Subscription** — plan, amount (paise), method (card/upi/netbanking), card last-4.
- **PaymentAttempt** — every charge that hit the gateway. Attempt `0` is the original failure; `1..n` are recovery attempts. This is the ledger of what *actually happened*.
- **RecoveryCase** — one per failed payment: reason, amount at risk, amount recovered, status (`open → recovering → recovered | exhausted | abandoned`), attempt counter, and a human `closeReason`.
- **RecoveryAction** — one per decision: action type, `decidedBy` (`rules` | `claude`), reasoning, confidence, any guardrail note, scheduled/executed timestamps, outcome.
- **AuditEvent** — append-only, timestamped, human-readable. Actors: `system`, `agent:rules`, `agent:claude`, `gateway`, `webhook`. This is the trace.
- **Meta** — key/value (e.g. the active seed).

SQLite has no native enums, so enum-like fields are stored as strings and validated in the app layer (`src/lib/types.ts`). JSON payloads are stringified. This keeps the DB portable and zero-setup.

## The decision flow

For each open case, `engine.ts` runs a loop (bounded well above `maxAttempts` to guarantee termination):

```
loadCase → buildContext(attempt N)
         → decideRecoveryAction(ctx)          # agent.ts
              → proposeAction(ctx)             # policy.ts — ALWAYS runs
                   → checkAbandon()            # hard stops → "stop"
                   → reason-specific playbook  # pick the action
              → if stop OR no LLM: return rules decision
              → else: askClaudeForDecision(ctx, allowedActions)
                   → GUARDRAIL: Claude's pick must be in allowedActions
                                else fall back to rules + record override
         → record RecoveryAction + AuditEvent(decision)
         → if "stop": abandon cleanly, close case
         → execute via gateway → record PaymentAttempt + AuditEvent(charge)
         → success? close "recovered" : loop to attempt N+1 (with backoff)
         → attempt > maxAttempts? close "exhausted"
```

### The guardrail (why the LLM can't go rogue)

`allowedActions(ctx)` is computed **from the policy**, per case state — e.g. an expired card never includes `immediate_retry`; a discount only appears for eligible, not-yet-discounted customers. Claude is handed that list and asked to pick. If it returns anything else, we discard its choice, use the policy's, mark `decidedBy: "rules"`, and write a `guardrails` note explaining the rejection. Hard stops (cancelled customer, sub-threshold amount) short-circuit **before** Claude is ever consulted. The policy has final say on anything that touches a stopping rule.

### The honesty guarantee (single source of truth)

`successProbability(reason, action, ctx)` in `failure-reasons.ts` is the *only* place that answers "how likely is this to work." It's called:

- by the **policy** to report the `confidence` shown in the UI, and
- by the **simulation gateway** to draw the actual success/failure.

Because both read the same function, the confidence a reviewer sees is exactly the distribution the outcome was drawn from. There's no separate "demo" fudge factor. Probabilities are attempt-indexed (e.g. insufficient-funds retries clear ~12% → 42% → 55% as payday approaches), and modulated by customer engagement/LTV for method-switch and discount actions.

### The simulated clock

Backoffs are real durations (72h, 120h). To keep those meaningful in the audit trail *without* making a batch take days, the engine carries a `simClock` per case: scheduling an action advances the clock by the backoff, and every DB timestamp uses the simulated time. So attempt 2 legitimately shows up "3 days later" in the trace while the batch completes in milliseconds.

## Gateway abstraction

`gateway/index.ts` defines a `PaymentGateway` interface with one method, `executeRecovery(action, ctx, seed)`. Two implementations:

- **SimulationGateway** — deterministic. Outcome is drawn using a seeded RNG keyed by `${seed}:${caseId}:${attempt}:${action}`, against `successProbability()`. Same seed ⇒ same batch ⇒ same metrics.
- **RazorpayGateway** — creates a **real order** in Razorpay TEST mode via `POST api.razorpay.com/v1/orders`, then resolves the final success/failure through the same probability model (documented honest boundary — you can't drive a real test card through a multi-day payday-recovery arc). Selected by `RAZORPAY_MODE=live`.

Swapping to a fully-live capture flow later means implementing one method — the engine, policy, metrics, and UI don't change.

## Determinism & reproducibility

A seeded RNG (`xmur3` + `mulberry32`, keyed by strings) drives both batch generation and simulated outcomes. Given a seed, the entire run — who fails, why, what the agent decides, what recovers — is identical across machines. That's what lets the README quote exact figures and a judge reproduce them.

## Money

All amounts are integer **paise** end to end (like the Razorpay API), formatted to ₹ only at the display boundary (`money.ts`). No floating-point rupees in the data path.

## Where the code lives

| Concern | File |
| --- | --- |
| Reason catalog + probability model | `src/lib/failure-reasons.ts` |
| Stopping rules + playbook | `src/lib/policy.ts` |
| Agent orchestration + guardrail | `src/lib/agent.ts` |
| Per-case recovery loop | `src/lib/engine.ts` |
| Gateway interface + impls | `src/lib/gateway/` |
| Metrics | `src/lib/metrics.ts` |
| Deterministic RNG | `src/lib/rng.ts` |
| Tests | `src/tests/policy.test.ts` |
