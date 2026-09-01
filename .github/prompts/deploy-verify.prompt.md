---
description: Deploy Recura to Vercel and verify live production health
---

# Deploy and Live Verification

1. Ensure all tests pass: `npm test && npm run typecheck`
2. Deploy to Vercel production: `npx vercel --prod --yes`
3. Execute live deep QA suite: `npx tsx scripts/live-production-full-qa.ts`
4. Confirm all 22 live assertions pass against live Supabase PostgreSQL.
