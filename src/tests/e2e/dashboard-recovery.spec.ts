import { test, expect } from "@playwright/test";

test.describe("Dashboard Recovery Workflow", () => {
  test("loads the overview dashboard with key metrics and controls", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Recura/);

    // Verify main header and controls
    await expect(page.locator("h1")).toContainText("Revenue Recovery");
    await expect(page.locator("button:has-text('Run with AI')")).toBeVisible();
    await expect(page.locator("button:has-text('Re-seed')")).toBeVisible();

    // Verify presence of core metric stat cards
    await expect(page.locator("text=Recovery rate")).toBeVisible();
    await expect(page.locator("text=Value recovered")).toBeVisible();
    await expect(page.locator("text=Stopped cleanly")).toBeVisible();
    await expect(page.locator("text=Avg attempts to recover")).toBeVisible();

    // Verify charts
    await expect(page.locator("text=Outcome by failure reason")).toBeVisible();
    await expect(page.locator("text=Which interventions worked")).toBeVisible();
  });

  test("runs recovery with Recura Recovery Intelligence engine", async ({ page }) => {
    await page.goto("/");

    const aiButton = page.locator("button:has-text('Run with AI')");
    await expect(aiButton).toBeEnabled();
    await aiButton.click();

    // Wait for response and verify result toast/summary appears
    await expect(page.locator("text=Recura Recovery Intelligence")).toBeVisible({ timeout: 15000 });
  });

  test("exports executive report CSV on click", async ({ page }) => {
    await page.goto("/");

    const exportBtn = page.locator("button:has-text('Export Report')");
    if (await exportBtn.isVisible()) {
      const downloadPromise = page.waitForEvent("download");
      await exportBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain("recura-recovery-report");
    }
  });
});
