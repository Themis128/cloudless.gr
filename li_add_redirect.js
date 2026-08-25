const { chromium } = require('playwright');

const APP_CLIENT_ID   = '77tf4oysp8u3fz';
const REDIRECT_URI    = 'http://localhost:8083/api/v1/auth/oauth/linkedin/callback';
const AUTH_PAGE_URL   = `https://www.linkedin.com/developers/apps/${APP_CLIENT_ID}/auth`;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900',
    ],
  });

  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log('Opening LinkedIn app Auth page...');
  await page.goto(AUTH_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // If we land on login, wait up to 10 minutes for the user to sign in
  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('/uas/') || currentUrl.includes('/checkpoint/')) {
    console.log('Login required — please sign in in the browser window.');
    console.log('Waiting up to 10 minutes...');
    try {
      await page.waitForURL(u => u.toString().includes(APP_CLIENT_ID), { timeout: 600000 });
      console.log('Logged in! Navigating to Auth tab...');
      await page.goto(AUTH_PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.log('Timed out waiting for login.');
      await browser.close();
      process.exit(1);
    }
  }

  await page.waitForLoadState('networkidle');
  console.log('On page:', page.url());

  // Check if already registered
  const bodyText = await page.textContent('body');
  if (bodyText.includes(REDIRECT_URI)) {
    console.log('✓ Redirect URI already registered — nothing to do.');
    await browser.close();
    return;
  }

  // Dump visible buttons for debugging
  const buttons = await page.$$eval('button', btns =>
    btns.map(b => b.innerText.trim()).filter(t => t.length > 0)
  );
  console.log('Visible buttons:', buttons);

  // Try to click "Add redirect URL" (or similar)
  const addSelectors = [
    'button:has-text("Add redirect URL")',
    'button:has-text("Add URL")',
    'button:has-text("Add")',
    '[data-test-id="add-redirect-url"]',
    'a:has-text("Add redirect URL")',
  ];
  let clicked = false;
  for (const sel of addSelectors) {
    try {
      await page.click(sel, { timeout: 5000 });
      clicked = true;
      console.log('Clicked add button:', sel);
      break;
    } catch {}
  }
  if (!clicked) {
    console.log('Could not find "Add redirect URL" button automatically.');
    console.log('Please click it manually in the browser — waiting 60s...');
    await page.waitForTimeout(60000);
  }

  // Short pause for input to appear
  await page.waitForTimeout(1500);

  // Dump all inputs
  const inputs = await page.$$('input');
  console.log('Inputs found:', inputs.length);

  // Fill the last empty text/url input (newly added)
  let filled = false;
  const allInputs = await page.$$('input[type="text"], input[type="url"], input:not([type])');
  for (let i = allInputs.length - 1; i >= 0; i--) {
    const val = await allInputs[i].inputValue().catch(() => '');
    if (!val || val.trim() === '') {
      await allInputs[i].click();
      await allInputs[i].fill(REDIRECT_URI);
      console.log('Filled redirect URI.');
      filled = true;
      break;
    }
  }
  if (!filled) {
    // Try placeholder-based
    const urlInput = page.locator('input[placeholder*="URL" i], input[placeholder*="redirect" i]').last();
    try {
      await urlInput.fill(REDIRECT_URI, { timeout: 5000 });
      console.log('Filled via placeholder selector.');
      filled = true;
    } catch {}
  }
  if (!filled) {
    console.log('Could not find empty input. Please paste manually:');
    console.log(' ', REDIRECT_URI);
    console.log('Waiting 60s...');
    await page.waitForTimeout(60000);
  }

  // Click Save/Update
  const saveSelectors = [
    'button:has-text("Update")',
    'button:has-text("Save")',
    'button[type="submit"]',
    '[data-test-id="save-auth-settings"]',
  ];
  let saved = false;
  for (const sel of saveSelectors) {
    try {
      await page.click(sel, { timeout: 5000 });
      saved = true;
      console.log('Clicked save:', sel);
      break;
    } catch {}
  }
  if (!saved) {
    console.log('Could not click Save. Please click it manually — waiting 60s...');
    await page.waitForTimeout(60000);
  }

  await page.waitForTimeout(3000);
  const finalText = await page.textContent('body');
  if (finalText.includes(REDIRECT_URI)) {
    console.log('✓ Redirect URI confirmed registered!');
  } else {
    console.log('⚠ Could not confirm on page — please verify manually in the browser.');
  }

  console.log('Done. Closing in 10s...');
  await page.waitForTimeout(10000);
  await browser.close();
})();
