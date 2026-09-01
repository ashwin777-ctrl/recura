# Policy Engine & Financial State Machine Guidelines

---

## 1. Non-Negotiable Hard Guardrails
- **Max Retries**: Exactly 3 attempts maximum per failed payment (`POLICY.maxAttempts = 3`).
- **Minimum Recoverable Amount**: ₹50 (5,000 paise). Do not trigger recovery attempts below this amount (`POLICY.minRecoverableAmountPaise`).
- **Backoff Schedules**:
  - Transient failures (`NETWORK_TIMEOUT`): `[0h, 12h, 24h]`.
  - Non-transient (`INSUFFICIENT_FUNDS`, `BANK_DECLINED`): `[0h, 72h, 120h]`.
- **Card Expiry / Blocked Instrument**: Never retry the same instrument on `CARD_EXPIRED` or `CARD_BLOCKED`; immediately recommend `switch_payment_method`.
- **Cancelled Subscriptions**: Immediately halt and cleanly abandon if `customer.cancelled === true`.

## 2. Audit Trail Ledger
- Every state mutation and action execution must write to the `AuditEvent` table with:
  - `caseId`: Target case identifier.
  - `actor`: `"rules"` | `"ai"` | `"webhook"` | `"system"`.
  - `action`: Specific action code.
  - `metadata`: JSON payload containing before/after state and reasoning narrative.
