import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login first
  console.log('Logging in...');
  await page.goto('https://swordweave.quest/sign-in');
  await page.waitForTimeout(2000);
  
  // Try to find email input
  const emailInput = await page.$('input[name="identifier"], input[type="email"], input[placeholder*="email" i]');
  if (emailInput) {
    await emailInput.fill('xeun-vere@proton.me');
    const continueBtn = await page.$('button:has-text("Continue"), button:has-text("Sign in"), button[type="submit"]');
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(3000);
    }
  }
  
  // Check if password field appears
  const passwordInput = await page.$('input[name="password"], input[type="password"]');
  if (passwordInput) {
    await passwordInput.fill('Admin.Anomaly!@#');
    const submitBtn = await page.$('button:has-text("Continue"), button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
    }
  }
  
  console.log('Current URL:', page.url());
  await page.screenshot({ path: '/root/SwordWeave/screenshots/login-state.png' });
  
  // Navigate to grammar sandbox
  console.log('Navigating to grammar sandbox...');
  await page.goto('https://swordweave.quest/sandbox/grammar');
  await page.waitForTimeout(5000);
  console.log('Grammar sandbox URL:', page.url());
  await page.screenshot({ path: '/root/SwordWeave/screenshots/grammar-sandbox.png', fullPage: true });
  
  // Look for library entries
  const entries = await page.$$('button:has-text("Effect"), button:has-text("Capability"), [data-entity-type]');
  console.log(`Found ${entries.length} entity buttons`);
  
  // Try clicking on an effect or capability in the library
  const effectRow = await page.$('text=Abyssal Despair, text=Shattered Composure, button:has-text("Effect")');
  if (effectRow) {
    console.log('Found effect, clicking...');
    await effectRow.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/root/SwordWeave/screenshots/grammar-preview.png', fullPage: true });
  } else {
    console.log('No effect row found, checking page content...');
    const text = await page.textContent('body');
    console.log('Page contains "grammar":', text?.includes('grammar'));
    console.log('Page contains "sandbox":', text?.includes('sandbox'));
    console.log('Page contains "sign":', text?.includes('Sign') || text?.includes('sign'));
  }
  
  await browser.close();
  console.log('Done');
})();
