# Recura — AI Agent Development Instructions for VS Code

Welcome to the **Recura** codebase — an autonomous, policy-controlled B2B SaaS revenue recovery platform built for recurring billing and payment failures.

---

## 1. Core Architecture & Mental Model

1. **Deterministic Guardrails (`src/lib/policy.ts`)**:
   - Recovery decisions are strictly bound by deterministic rules (max 3 retry attempts, minimum ₹50 / 5,000 paise threshold, backoff schedules, cancellation checks, and customer LTV-based discount eligibility).
   - **Critical Rule**: The AI/LLM intelligence layer can NEVER override or loosen deterministic stopping rules.

2. **State Machine (`src/lib/types.ts` & `src/lib/engine.ts`)**:
   - Case States: `open` -> `in_progress` -> `recovered` | `exhausted` | `abandoned`.
   - Actions: `immediate_retry`, `delayed_retry_backoff`, `switch_payment_method`, `discount_offer`, `stop`.
   - Every state transition must record an immutable audit event (`AuditEvent` table).

3. **Dual-Database Layer (`prisma/schema.prisma` & `src/lib/db.ts`)**:
   - Primary: Supabase PostgreSQL (via connection pooler, port 6543, `pgbouncer=true`).
   - Local fallback: SQLite when `USE_SQLITE=true` is enabled.
   - Dynamic schema generation is handled by `node scripts/db-generate.js`.

4. **Security & Cryptography (`src/app/api/webhooks/razorpay/route.ts`)**:
   - All inbound webhooks (e.g. Razorpay payment failures) must verify HMAC-SHA256 signatures using `crypto.timingSafeEqual`.
   - Never bypass signature verification in production routes.

---

## 2. Development Guidelines & Tooling

- **Language / Framework**: Next.js (App Router), TypeScript, React 19, Tailwind CSS.
- **Testing**:
  - Unit / Integration: `npm test` (Vitest across 5 test suites).
  - Typecheck: `npm run typecheck` (`tsc --noEmit`).
  - End-to-End: `npm run test:e2e` (Playwright Chromium automation).
  - Production Build: `npm run build`.
- **Database**:
  - `node scripts/db-generate.js` to update Prisma Client.
  - `npx tsx scripts/seed-db.ts` to populate synthetic benchmark data.

---

## 3. UI/UX Standards & Craft (Impeccable & Huashu-Design Guidelines)

- **Palette**: Sleek dark-mode aesthetic with zinc/slate base, violet/emerald accents, and glassmorphic cards (`backdrop-blur-md`, subtle borders `border-white/10`).
- **Typography & Motion**: Clean font hierarchy, smooth CSS micro-transitions (200ms ease), and responsive layouts (tested down to 375x812 mobile viewports).
- **No Placeholders**: Render live stats, real calculated aggregates, and clear error diagnostics.

---

## 4. MCP Servers in VS Code (`.vscode/mcp.json`)

- **`github`**: Repository inspections, commits, PR reviews, issue management.
- **`supabase`**: Database schema inspection and query performance checks.
- **`vercel`**: Production deployments, domain routing, and runtime serverless logs.
- **`playwright`**: Live browser interaction and automated test execution.

---

## 5. Modular Instructions Library

Refer to specialized instruction guides in `.vscode/instructions/`:
- [UI/UX Craft & Design Tokens](file:///.vscode/instructions/ui-ux-craft.md)
- [Playwright E2E & Visual Testing](file:///.vscode/instructions/playwright-testing.md)
- [Policy Engine & Financial State Machine](file:///.vscode/instructions/policy-engine.md)
- [Performance, Security & HMAC Webhooks](file:///.vscode/instructions/performance-security.md)
- [Code Quality & Multi-Axis Review](file:///.vscode/instructions/code-quality.md)
- [GSD Project Lifecycle & Autonomous Execution](file:///.vscode/instructions/gsd-lifecycle.md)
