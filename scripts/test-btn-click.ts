import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("request", (r) => console.log("REQ:", r.method(), r.url()));
  page.on("response", (r) => console.log("RES:", r.status(), r.url()));

  console.log("Navigating to https://recura-three.vercel.app/...");
  await page.goto("https://recura-three.vercel.app/", { waitUntil: "networkidle" });

  const btn = page.locator("button:has-text('Run recovery batch')");
  console.log("Button visible:", await btn.isVisible());
  console.log("Clicking button...");
  await btn.click();

  await page.waitForTimeout(20000);
  await browser.close();
  console.log("Finished!");
}

main().catch(console.error);
