// Smoke test: visit /sandbox/heritage on desktop + mobile and check that:
//  - Desktop: three columns visible (Library / Build / Preview)
//  - Mobile: three tabs (Library | Build | Preview)
//  - Library shows the heritage list (server-side rendered, so we can't
//    test content without auth — check for the chrome elements instead).

import { chromium } from "playwright";

const BASE_URL = process.env["SW_TEST_URL"] ?? "http://localhost:3011";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 393, height: 852 };

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();

  // /sandbox/* requires auth — let's just confirm the redirect to /login.
  console.log("== desktop ==");
  const resp = await page.goto(`${BASE_URL}/sandbox/heritage`, {
    waitUntil: "networkidle",
  });
  console.log(`final URL: ${page.url()}`);
  console.log(`final status: ${resp?.status()}`);

  // Now check the dev layout test page to ensure SandboxLayout shell works.
  await page.setViewportSize(DESKTOP);
  await page.goto(`${BASE_URL}/dev/layout-test`, { waitUntil: "networkidle" });
  const columns = await page.locator("[data-column-chrome]").count();
  console.log(`dev layout test columns: ${columns}`);
  await page.screenshot({
    path: "/tmp/sandbox-heritage-desktop.png",
    fullPage: false,
  });

  await page.setViewportSize(MOBILE);
  await page.goto(`${BASE_URL}/dev/layout-test`, { waitUntil: "networkidle" });
  const tabs = await page.locator('[role="tab"]').count();
  console.log(`dev layout test mobile tabs: ${tabs}`);
  await page.screenshot({
    path: "/tmp/sandbox-heritage-mobile.png",
    fullPage: false,
  });

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });