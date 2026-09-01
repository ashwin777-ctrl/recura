# Performance, Security & Observability Best Practices

> Synthesized from **addyosmani-agent-skills**, **security-and-hardening**, and **perf-web-optimization**.

---

## 1. Webhook Cryptographic Security
- **HMAC-SHA256**: All incoming Razorpay webhook calls must be verified using:
  ```typescript
  import crypto from "crypto";
  const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  ```
- Reject any signature mismatches with HTTP `401 Unauthorized`.

## 2. Serverless Database Connection Management
- Connect to Supabase via the transaction pooler (`port 6543`, `?pgbouncer=true&connection_limit=10`).
- Process batch runs in concurrency chunks (`CHUNK_SIZE = 8`) to avoid saturating connection limits and keep serverless response times under 5 seconds.

## 3. Telemetry & Health Checks
- The `/api/health` route monitors:
  - Database connectivity status (`connected` | `disconnected`).
  - Active Prisma provider (`PostgreSQL` | `SQLite`).
  - Query latency (ms).
  - Live recovery case count.
