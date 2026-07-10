import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Go to grammar sandbox
  console.log('Navigating to grammar sandbox...');
  await page.goto('https://swordweave.quest/sandbox/grammar');
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  
  // Check if we're redirected to sign-in
  if (page.url().includes('sign-in')) {
    console.log('Redirected to sign-in - need auth');
    await page.screenshot({ path: '/root/SwordWeave/screenshots/grammar-redirect.png' });
  } else {
    console.log('On grammar sandbox page');
    await page.screenshot({ path: '/root/SwordWeave/screenshots/grammar-page.png', fullPage: true });
    
    // Check for version chips in the page
    const versionChips = await page.$$('text=/v\\d+/');
    console.log(`Found ${versionChips.length} version chips`);
    
    // Check for BU cost
    const buCosts = await page.$$('text=/\\d+ BU/');
    console.log(`Found ${buCosts.length} BU cost elements`);
  }
  
  await browser.close();
  console.log('Done');
})();
