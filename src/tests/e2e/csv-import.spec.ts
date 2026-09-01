import { test, expect } from "@playwright/test";

test.describe("CSV Import & Custom Data Ingestion Flow", () => {
  test("navigates to import page and displays CSV schema instructions", async ({ page }) => {
    await page.goto("/import");
    await expect(page.locator("h1")).toContainText("Import Failed Payment Data");
    await expect(page.locator("text=Supported CSV Columns")).toBeVisible();
    await expect(page.locator("button:has-text('Load Sample Data')")).toBeVisible();
  });

  test("loads sample dataset, validates rows, and previews data table", async ({ page }) => {
    await page.goto("/import");

    // Click load sample data
    await page.locator("button:has-text('Load Sample Data')").click();

    // Verify textarea populated
    const textarea = page.locator("textarea");
    await expect(textarea).not.toBeEmpty();

    // Verify automatic validation table renders
    await expect(page.locator("text=Validation & Import Preview")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button:has-text('Import')")).toBeVisible();
  });

  test("shows clear field-level diagnostics when invalid data is provided", async ({ page }) => {
    await page.goto("/import");

    const badCSV = `customer_name,customer_email,amount_inr,failure_reason,payment_method
,not_an_email,-500,UNKNOWN_CODE,card`;

    await page.locator("textarea").fill(badCSV);

    // Auto-validates and displays Error badge
    await expect(page.locator("text=1 Invalid")).toBeVisible({ timeout: 10000 });
  });
});
