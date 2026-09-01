# Code Quality, Review & Simplification Standards

> Synthesized from **coderabbit** and **code-review-and-quality**.

---

## 1. Quality Axes
1. **Correctness & Type Safety**: Zero TypeScript errors (`npm run typecheck`), strict schema contracts with Zod/Prisma.
2. **Defensive Validation**: Validate all inbound user payloads (CSV rows, API query params, webhook events).
3. **Simplicity & Readability**: Avoid unnecessary abstraction layers. Keep business logic directly understandable in pure functions (`money.ts`, `failure-reasons.ts`, `policy.ts`).
4. **Test Integrity**: Every critical business requirement must have automated unit or E2E tests (`npm test`, `npm run test:e2e`).
