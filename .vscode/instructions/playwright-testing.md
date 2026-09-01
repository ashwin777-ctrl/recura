# Playwright Testing Patterns & E2E Verification

> Synthesized from **playwright-skill**.

---

## 1. Playwright Setup in VS Code
- Playwright is configured in `playwright.config.ts` targeting Chromium headless.
- Default `baseURL` points to the live Vercel production deployment (`https://recura-three.vercel.app`) or local development server (`http://localhost:3000`).

## 2. Test Execution Patterns
- Run full suite: `npm run test:e2e` or via VS Code Test Explorer (`ms-playwright.playwright`).
- Debug individual test: `npx playwright test src/tests/e2e/dashboard-recovery.spec.ts --debug`.
- View trace logs: `npx playwright show-trace test-results/...`.

## 3. Best Practices
- **Resilient Locators**: Prefer role-based and user-facing locators (`getByRole('button', { name: '...' })`, `getByText(...)`, `locator('data-testid=...')`).
- **Network Resilience**: When testing remote Supabase instances over network hops, use `waitForResponse()` or `expect(locator).toBeVisible({ timeout: 10000 })` rather than arbitrary hard sleeps.
