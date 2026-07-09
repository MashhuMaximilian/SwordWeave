import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== Testing SwordWeave ===');
  
  // Test 1: Check forks list on source page
  console.log('\n--- Test 1: Forks list on PRIMITIVE:13 ---');
  await page.goto('https://swordweave.quest/library/item/PRIMITIVE:13');
  await page.waitForTimeout(3000);
  
  const forksText = await page.textContent('body');
  const hasForkCount = forksText.includes('Forked') && forksText.includes('times');
  const hasShowAll = forksText.includes('Show all');
  console.log(`Has fork count: ${hasForkCount}`);
  console.log(`Has "Show all" button: ${hasShowAll}`);
  
  // Take screenshot
  await page.screenshot({ path: '/root/SwordWeave/screenshots/primitive-source.png', fullPage: true });
  console.log('Screenshot saved: primitive-source.png');
  
  // Test 2: Version history page
  console.log('\n--- Test 2: Version history for CAPABILITY ---');
  await page.goto('https://swordweave.quest/library/item/CAPABILITY:26d4a9d0-e76c-4773-afd2-1b2b44ca1a68/versions');
  await page.waitForTimeout(3000);
  
  const versionsText = await page.textContent('body');
  const hasVersionCount = versionsText.includes('versions published');
  const hasPreviewButton = versionsText.includes('Preview');
  const hasRestoreButton = versionsText.includes('Restore');
  const hasRawData = versionsText.includes('"id": "26d4a9d0') || versionsText.includes('"data":');
  console.log(`Has version count: ${hasVersionCount}`);
  console.log(`Has Preview button: ${hasPreviewButton}`);
  console.log(`Has Restore button: ${hasRestoreButton}`);
  console.log(`Shows raw data wrapper: ${hasRawData}`);
  
  await page.screenshot({ path: '/root/SwordWeave/screenshots/version-history.png', fullPage: true });
  console.log('Screenshot saved: version-history.png');
  
  // Test 3: Click Preview button and check modal
  console.log('\n--- Test 3: Version preview modal ---');
  const previewButtons = await page.$$('button:has-text("Preview")');
  if (previewButtons.length > 0) {
    await previewButtons[0].click();
    await page.waitForTimeout(2000);
    
    const modalText = await page.textContent('body');
    const hasModal = modalText.includes('v1') || modalText.includes('Capability');
    console.log(`Modal opened: ${hasModal}`);
    
    await page.screenshot({ path: '/root/SwordWeave/screenshots/version-preview-modal.png', fullPage: true });
    console.log('Screenshot saved: version-preview-modal.png');
    
    // Close modal
    const closeButtons = await page.$$('button:has-text("Close")');
    if (closeButtons.length > 0) {
      await closeButtons[0].click();
      await page.waitForTimeout(500);
    }
  }
  
  // Test 4: Capability source page
  console.log('\n--- Test 4: Capability source page ---');
  await page.goto('https://swordweave.quest/library/item/CAPABILITY:26d4a9d0-e76c-4773-afd2-1b2b44ca1a68');
  await page.waitForTimeout(3000);
  
  const capText = await page.textContent('body');
  const hasForksSection = capText.includes('Forked') && capText.includes('times');
  console.log(`Has forks section: ${hasForksSection}`);
  
  await page.screenshot({ path: '/root/SwordWeave/screenshots/capability-source.png', fullPage: true });
  console.log('Screenshot saved: capability-source.png');
  
  // Test 5: Login and check sandbox
  console.log('\n--- Test 5: Login and check sandbox ---');
  await page.goto('https://swordweave.quest/sign-in');
  await page.waitForTimeout(3000);
  
  // Try to find login form
  const emailInput = await page.$('input[name="identifier"]');
  if (emailInput) {
    await emailInput.fill('xeun-vere@proton.me');
    const continueBtn = await page.$('button:has-text("Continue")');
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
    }
    
    const passwordInput = await page.$('input[name="password"]');
    if (passwordInput) {
      await passwordInput.fill('Admin.Anomaly!@#');
      const continueBtn2 = await page.$('button:has-text("Continue")');
      if (continueBtn2) {
        await continueBtn2.click();
        await page.waitForTimeout(3000);
      }
    }
    
    // Check if logged in
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);
    
    // Navigate to sandbox
    await page.goto('https://swordweave.quest/sandbox/grammar');
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: '/root/SwordWeave/screenshots/sandbox-grammar.png', fullPage: true });
    console.log('Screenshot saved: sandbox-grammar.png');
    
    // Click on a primitive in the library
    const primitiveRows = await page.$$('tr[role="button"]');
    if (primitiveRows.length > 0) {
      await primitiveRows[0].click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: '/root/SwordWeave/screenshots/sandbox-preview.png', fullPage: true });
      console.log('Screenshot saved: sandbox-preview.png');
    }
  } else {
    console.log('Could not find login form');
  }
  
  await browser.close();
  console.log('\n=== Tests complete ===');
})();
