---
description: Perform a complete verification audit of Recura (tests, types, e2e, build, health)
---

# Recura Verification Audit

Execute the following verification checklist:
1. Run unit and integration tests: `npm test`
2. Verify TypeScript types: `npm run typecheck`
3. Execute Playwright E2E tests: `npm run test:e2e`
4. Verify Next.js production build: `npm run build`
5. Check production health: Verify `https://recura-three.vercel.app/api/health` returns `status: "healthy"` and database connected.
