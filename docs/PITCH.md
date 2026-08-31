# 5-Minute Pitch

A tight script for the demo video / live pitch. Timings are a guide. The whole thing is built to make **two claims undeniable**: *the numbers are real (whole batch, reproducible)* and *the agent stops itself*.

---

## 0:00–0:40 — The problem (with a number)

> "Every subscription business loses revenue it already earned — not to customers quitting, but to **failed payments**. Cards expire, accounts are short on payday, banks decline. It's called *involuntary churn*, and for most SaaS companies it's **5–10% of revenue** leaking out silently.
>
> The naive fix is a retry bot. But a bot that hammers a card 15 times gets your merchant account flagged and annoys the customer you're trying to keep. What you actually want is a **controlled agent** — one that's smart about *which* recovery move fits *which* failure, and disciplined about **when to stop**."

## 0:40–1:20 — What Recura is

> "This is Recura. I feed it a batch of 80 failed subscription charges — ₹51,820 at risk — with realistic failure reasons: insufficient funds, expired cards, bank declines, network timeouts.
>
> For each one, the agent classifies the failure, picks a recovery action — immediate retry, delayed retry with backoff, prompt to update the card, or a win-back discount — executes it against Razorpay, and repeats until it recovers the payment **or hits a stopping rule**."

*[Show the Overview dashboard.]*

## 1:20–2:30 — The headline numbers (the first undeniable thing)

> "Here's the whole batch after one run. **65% of cases recovered. 75% of the money recovered** — ₹38,930 back.
>
> Notice value-recovery is *higher* than count-recovery. That's deliberate: the agent chases the ₹2,999 subscriptions and **walks away** from ₹49 add-ons and customers who already cancelled. It optimizes for money, not a vanity percentage.
>
> And this isn't a lucky demo run. The batch is **seeded** — I can reset and re-run right now and get the exact same numbers." *[Click Reset → Re-seed → Run. Same figures.]* "Reproducible, from a whole batch. That's the first thing I want you to trust."

## 2:30–3:30 — The stopping rules (the second undeniable thing)

*[Open the Policy page.]*

> "This is what makes it *controlled*. **Max 3 attempts** — then the case is closed, exhausted. **No dunning after cancellation.** **A ₹50 floor** — below that, retrying costs more than it recovers. **Backoff** so we wait for payday instead of re-charging a dry account. **Never retry a dead card** — expired cards go straight to 'update your method.'
>
> Look at *recoveries by attempt*: **most land on the first try**, very few need all three. The agent isn't over-retrying — it's stopping early when the signal says stop. **28 of the 80 cases stopped cleanly.**
>
> These rules are deterministic and unit-tested. When I turn on the Claude reasoning layer, Claude can only re-pick *within the actions the policy already allows* — it can never exceed the cap or dun a cancelled customer. If it tries, we override it and log that we did."

## 3:30–4:30 — Traceability (the reviewer's trust)

*[Open a single case — ideally the win-back one.]*

> "Every decision is auditable. Here's one case end-to-end: insufficient funds on a ₹2,999 plan. Attempt 1, immediate retry — failed, and the agent *said* it expected ~12%. Attempt 2, it **waited 72 hours** for payday — you can see the timestamp jump — failed again. Attempt 3: this is a high-value, long-tenure customer, so instead of a fourth retry it extended a **one-time 20% win-back**. Customer accepted — **₹2,399 recovered, subscription saved.**
>
> Below is the append-only audit log: system, agent, gateway — every actor, every timestamp. A reviewer can trace *any* case like this. And with a Claude key, this button narrates the whole trail in plain English."

## 4:30–5:00 — Close

> "So: a recovery agent that gets **75% of at-risk revenue back**, proves it on a **reproducible batch**, and — just as importantly — **knows when to stop**. Real Razorpay test-mode execution, real Claude reasoning, a full audit trail behind every rupee.
>
> That's Recura. The decisions are the product; the discipline is the point."

---

## Demo checklist

- [ ] App running, batch already seeded (opens populated).
- [ ] Have a recovered **win-back** case URL open in a tab (best single story).
- [ ] If showing AI: `ANTHROPIC_API_KEY` set; pre-click one **Explain with AI** so it's warm.
- [ ] The reproducibility beat (Reset → Re-seed → Run → same numbers) rehearsed.
- [ ] Policy page ready — it's the differentiator most demos skip.

## One-liners to keep in your pocket

- "Value-recovery beats count-recovery *on purpose* — it optimizes for money, not a vanity rate."
- "The stopping rules are unit-tested. The LLM is on a leash, not in the driver's seat."
- "Same seed, same numbers — this is a batch result, not a highlight reel."
- "You can't script a real card to fail twice and clear on payday — so the outcome is modeled, transparently, from the same probability the agent quotes you."
