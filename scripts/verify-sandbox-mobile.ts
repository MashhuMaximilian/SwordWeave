// Verify SandboxLayout at mobile viewport — should show tabs, no panels.

import { chromium } from "playwright";

const BASE_URL = process.env["SW_TEST_URL"] ?? "http://localhost:3011";
const MOBILE_VIEWPORT = { width: 393, height: 852 }; // <768
const TABLET_VIEWPORT = { width: 1023, height: 768 }; // 768-1023

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: MOBILE_VIEWPORT });
  const page = await ctx.newPage();
  const url = `${BASE_URL}/dev/layout-test`;
  console.log(`navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });

  // Reset storage so we don't carry over desktop widths.
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  // Mobile should NOT have a PanelGroup.
  const groupExists = await page.locator("[data-group]").count();
  console.log(`panel-group count: ${groupExists} (expected 0 on mobile)`);

  // Should have a tablist with 3 tabs.
  const tabCount = await page.locator('[role="tab"]').count();
  console.log(`tab count: ${tabCount} (expected 3)`);

  // Library content should be hidden initially (default tab is "builder").
  const libraryVisible = await page
    .locator("text=Library Column")
    .isVisible();
  console.log(`library content visible: ${libraryVisible} (expected false)`);

  const builderVisible = await page
    .locator("text=Build Column")
    .isVisible();
  console.log(`build content visible: ${builderVisible} (expected true)`);

  const previewVisible = await page
    .locator("text=Preview Column")
    .isVisible();
  console.log(`preview content visible: ${previewVisible} (expected false)`);

  // Click Library tab.
  await page.locator('[role="tab"]', { hasText: "Library" }).click();
  await page.waitForTimeout(150);
  const libraryVisibleAfter = await page
    .locator("text=Library Column")
    .isVisible();
  console.log(`library content after tab click: ${libraryVisibleAfter} (expected true)`);

  await page.screenshot({ path: "/tmp/sandbox-layout-mobile.png", fullPage: false });
  console.log("screenshot: /tmp/sandbox-layout-mobile.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});