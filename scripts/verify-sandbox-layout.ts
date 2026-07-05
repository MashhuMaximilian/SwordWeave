// Verify SandboxLayout renders three columns + collapses at desktop viewport.

import { chromium } from "playwright";

const BASE_URL = process.env["SW_TEST_URL"] ?? "http://localhost:3011";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await ctx.newPage();
  const url = `${BASE_URL}/dev/layout-test`;
  console.log(`navigating to ${url}`);
  const resp = await page.goto(url, { waitUntil: "networkidle" });
  console.log(`status: ${resp?.status()}`);

  // Reset any previous storage from prior runs.
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  const columnChromeCount = await page.locator("[data-column-chrome]").count();
  console.log(`column chrome count: ${columnChromeCount}`);

  for (const key of ["library", "builder", "preview"]) {
    const text = await page.locator(`[data-column-chrome="${key}"]`).innerText();
    console.log(`  ${key}: ${text.replace(/\n/g, " | ")}`);
  }

  const panelIds = await page.locator("[data-panel]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid") ?? e.id),
  );
  console.log(`panel ids: ${panelIds.join(", ")}`);

  const groupExists = await page.locator("[data-group]").count();
  console.log(`group count: ${groupExists}`);

  const widths = await page.locator("[data-panel]").evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute("data-testid") ?? e.id,
      width: e.getBoundingClientRect().width,
    })),
  );
  console.log(`initial column widths (px):`);
  for (const w of widths) {
    console.log(`  ${w.id}: ${w.width.toFixed(0)}px`);
  }

  // Click "Hide column" on Library — should unmount the library Panel.
  const libraryHideBtn = page.locator(
    '[data-column-chrome="library"] button[title="Hide column"]',
  );
  await libraryHideBtn.click();
  await page.waitForTimeout(300);

  const panelsAfterHide = await page.locator("[data-panel]").count();
  console.log(`panel count after hiding library: ${panelsAfterHide}`);
  const chromeAfterHide = await page.locator("[data-column-chrome]").count();
  console.log(`column-chrome count after hiding library: ${chromeAfterHide}`);

  const widthsAfterHide = await page.locator("[data-panel]").evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute("data-testid") ?? e.id,
      width: e.getBoundingClientRect().width,
    })),
  );
  console.log(`column widths after hiding library:`);
  for (const w of widthsAfterHide) {
    console.log(`  ${w.id}: ${w.width.toFixed(0)}px`);
  }

  // The library restore button should now appear.
  const restoreVisible = await page
    .locator('button[aria-label="Show Library"]')
    .isVisible();
  console.log(`library restore button visible: ${restoreVisible}`);

  // Click it to bring back.
  await page.locator('button[aria-label="Show Library"]').click();
  await page.waitForTimeout(300);
  const panelsAfterRestore = await page.locator("[data-panel]").count();
  console.log(`panel count after restoring library: ${panelsAfterRestore}`);

  const widthsAfterRestore = await page.locator("[data-panel]").evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute("data-testid") ?? e.id,
      width: e.getBoundingClientRect().width,
    })),
  );
  console.log(`column widths after restoring library:`);
  for (const w of widthsAfterRestore) {
    console.log(`  ${w.id}: ${w.width.toFixed(0)}px`);
  }

  const stored = await page.evaluate(() =>
    window.localStorage.getItem("sandbox:layout:test-sandbox"),
  );
  console.log(`localStorage: ${stored}`);

  await page.screenshot({ path: "/tmp/sandbox-layout-1440.png", fullPage: false });
  console.log("screenshot: /tmp/sandbox-layout-1440.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});