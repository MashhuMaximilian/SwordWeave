// Verify SandboxLayout at tablet viewport (1023px) — should show 2 columns + Preview toggle.

import { chromium } from "playwright";

const BASE_URL = process.env["SW_TEST_URL"] ?? "http://localhost:3011";
const TABLET_VIEWPORT = { width: 1023, height: 768 };

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: TABLET_VIEWPORT });
  const page = await ctx.newPage();
  const url = `${BASE_URL}/dev/layout-test`;
  console.log(`navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });

  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  // Tablet should NOT have a PanelGroup (only desktop uses one).
  const groupExists = await page.locator("[data-group]").count();
  console.log(`panel-group count: ${groupExists} (expected 0 on tablet)`);

  // Should NOT have tabs either (only mobile uses tabs).
  const tabCount = await page.locator('[role="tab"]').count();
  console.log(`tab count: ${tabCount} (expected 0 on tablet)`);

  // Should have a "Hide Preview" button.
  const toggleBtn = page.locator('button[aria-pressed="true"]', {
    hasText: "Hide Preview",
  });
  const toggleVisible = await toggleBtn.isVisible();
  console.log(`preview toggle visible: ${toggleVisible} (expected true)`);

  // Library + Builder + Preview should all be visible.
  const libraryVisible = await page.locator("text=Library Column").isVisible();
  const builderVisible = await page.locator("text=Build Column").isVisible();
  const previewVisible = await page.locator("text=Preview Column").isVisible();
  console.log(
    `library:${libraryVisible} build:${builderVisible} preview:${previewVisible} (expected all true)`,
  );

  // Click "Hide Preview" — preview should disappear, button text should flip.
  await toggleBtn.click();
  await page.waitForTimeout(150);

  const previewVisibleAfterHide = await page
    .locator("text=Preview Column")
    .isVisible();
  console.log(`preview visible after hide: ${previewVisibleAfterHide} (expected false)`);

  const showBtn = page.locator('button[aria-pressed="false"]', {
    hasText: "Show Preview",
  });
  const showVisible = await showBtn.isVisible();
  console.log(`show preview button visible: ${showVisible} (expected true)`);

  // Click "Show Preview" — should bring back.
  await showBtn.click();
  await page.waitForTimeout(150);
  const previewVisibleAfterShow = await page
    .locator("text=Preview Column")
    .isVisible();
  console.log(`preview visible after show: ${previewVisibleAfterShow} (expected true)`);

  // Persisted state.
  const stored = await page.evaluate(() =>
    window.localStorage.getItem("sandbox:layout:test-sandbox"),
  );
  console.log(`localStorage: ${stored}`);

  await page.screenshot({ path: "/tmp/sandbox-layout-tablet.png", fullPage: false });
  console.log("screenshot: /tmp/sandbox-layout-tablet.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});