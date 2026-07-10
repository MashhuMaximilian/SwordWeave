import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test 1: Forks on source page
  console.log('Test 1: Forks on PRIMITIVE:13');
  await page.goto('https://swordweave.quest/library/item/PRIMITIVE:13');
  await page.waitForTimeout(5000);
  
  const forksSection = await page.$('[data-testid="forks-list"]');
  if (forksSection) {
    const forkItems = await forksSection.$$('li');
    console.log(`  Fork entries found: ${forkItems.length}`);
  } else {
    console.log('  No forks section found');
  }
  
  await page.screenshot({ path: '/root/SwordWeave/screenshots/01-forks.png', fullPage: true });
  
  // Test 2: Version history 
  console.log('Test 2: Version history');
  await page.goto('https://swordweave.quest/library/item/CAPABILITY:26d4a9d0-e76c-4773-afd2-1b2b44ca1a68/versions');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/root/SwordWeave/screenshots/02-versions.png', fullPage: true });
  
  // Test 3: Click Preview
  console.log('Test 3: Version preview modal');
  const previewBtn = await page.$('button:has-text("Preview")');
  if (previewBtn) {
    await previewBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/root/SwordWeave/screenshots/03-preview-modal.png', fullPage: true });
    
    // Close modal
    const closeBtn = await page.$('button:has-text("Close")');
    if (closeBtn) await closeBtn.click();
  }
  
  // Test 4: Capability source page
  console.log('Test 4: Capability source');
  await page.goto('https://swordweave.quest/library/item/CAPABILITY:26d4a9d0-e76c-4773-afd2-1b2b44ca1a68');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/root/SwordWeave/screenshots/04-capability.png', fullPage: true });
  
  await browser.close();
  console.log('Done');
})();
