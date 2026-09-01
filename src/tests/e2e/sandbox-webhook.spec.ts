import { test, expect } from "@playwright/test";

test.describe("Razorpay Webhook Sandbox & Simulation Flow", () => {
  test("loads webhook sandbox with event presets and HMAC verification card", async ({ page }) => {
    await page.goto("/sandbox");
    await expect(page.locator("h1")).toContainText("Razorpay Webhook Sandbox");
    await expect(page.locator("text=Cryptographic Signature Verification")).toBeVisible();
    await expect(page.locator("button:has-text('payment.failed')")).toBeVisible();
    await expect(page.locator("button:has-text('payment.authorized')")).toBeVisible();
    await expect(page.locator("button:has-text('subscription.cancelled')")).toBeVisible();
  });

  test("dispatches a simulated payment.failed webhook and renders signed payload", async ({ page }) => {
    await page.goto("/sandbox");

    // Click dispatch simulated webhook
    const dispatchBtn = page.locator("button:has-text('Dispatch Simulated Webhook')");
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();

    // Verify response inspection panel renders
    await expect(page.locator("text=HTTP 200 OK")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=HMAC Verified")).toBeVisible();
    await expect(page.locator("text=Recorded in PostgreSQL Audit Trail")).toBeVisible();
  });
});
