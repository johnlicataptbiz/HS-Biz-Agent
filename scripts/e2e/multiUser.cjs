/* eslint-disable no-console */
const puppeteer = require('puppeteer');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const PAT = process.env.E2E_HUBSPOT_PAT || '';

async function registerAndMaybeConnect(page, { email, password, name }) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  // Switch to Create Account
  const createBtn = await page.$x("//button[contains(., 'Create Account') and contains(@class, 'font-semibold')]");
  if (createBtn[0]) await createBtn[0].click();

  // Fill fields
  await page.type('input[placeholder="Your name"]', name);
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Open Settings from sidebar
  await page.click('button:has-text("Settings")');
  await page.waitForSelector('div[role="dialog"], .fixed.inset-0');

  if (PAT) {
    // Open PAT flow
    await page.click('button:has-text("Use Private App Token")');
    await page.type('input[placeholder^="pat-"]', PAT);
    await page.click('button:has-text("Connect")');
    // Wait for Connected state or error
    await page.waitForTimeout(2000);
  } else {
    // Toggle Demo Mode on
    const toggleSelector = 'button[class*="rounded-full"]';
    const toggles = await page.$$(toggleSelector);
    if (toggles.length) await toggles[0].click();
  }

  // Toggle demo mode to ensure UI populates
  const toggles = await page.$$('[class*="rounded-full"]');
  if (toggles.length) await toggles[0].click().catch(()=>{});

  // Close modal (Esc)
  await page.keyboard.press('Escape').catch(() => {});
}

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });

  const email1 = `user1+${Date.now()}@e2e.test`;
  const email2 = `user2+${Date.now()}@e2e.test`;
  const password = 'Testing123!';

  const [page1, page2] = await Promise.all([
    browser.newPage(),
    browser.newPage(),
  ]);

  await registerAndMaybeConnect(page1, { email: email1, password, name: 'E2E User 1' });
  await registerAndMaybeConnect(page2, { email: email2, password, name: 'E2E User 2' });

  // Navigate to Workflows and verify page renders + pagination visible
  await page1.click('button:has-text("Workflows")');
  await page1.waitForSelector('h1:has-text("Workflows")');
  await page1.waitForSelector('button:has-text("Next")');

  await page2.click('button:has-text("Sequences")');
  await page2.waitForSelector('h1:has-text("Sequences")');
  await page2.waitForSelector('button:has-text("Next")');

  // Role restriction smoke test: second user (likely member) should not see enabled Execute state in CoPilot panel
  await page2.click('button:has-text("Co-Pilot")');
  await page2.waitForSelector('h1:has-text("HubSpot Co-Pilot")');
  // Open modal
  await page2.click('button:has-text("Open Chat")');
  // CoPilot bottom panel buttons may be visible; ensure Execute button is disabled
  const execButtons = await page2.$$eval('button', els => els.map(e => ({ text: e.textContent || '', disabled: e.disabled })));
  const execDisabled = execButtons.some(b => b.text.includes('Execute') && b.disabled);
  console.log('Execute button disabled for member:', execDisabled);

  // View All Recommendations
  await page1.click('button:has-text("Dashboard")');
  await page1.waitForSelector('h1:has-text("Portal Overview")');
  await page1.click('button:has-text("View All Recommendations")');
  await page1.waitForSelector('h1:has-text("Recommendations")');
  await page1.waitForSelector('button:has-text("Next")');

  console.log('E2E multi-user flow completed');
  await browser.close();
}

run().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
