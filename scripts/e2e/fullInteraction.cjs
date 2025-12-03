/* eslint-disable no-console */
const puppeteer = require('puppeteer');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function register(page, { name, email, password }) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  const createBtn = await page.$x("//button[contains(., 'Create Account')]");
  if (createBtn[0]) await createBtn[0].click();
  await page.type('input[placeholder="Your name"]', name);
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
}

async function openSettingsAndToggleDemo(page) {
  await page.click('button:has-text("Settings")');
  await page.waitForSelector('.fixed.inset-0');
  const toggles = await page.$$('[class*="rounded-full"]');
  if (toggles.length) await toggles[0].click().catch(()=>{});
  await page.keyboard.press('Escape').catch(()=>{});
}

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const email = `full+${Date.now()}@e2e.test`;
  const pass = 'Testing123!';
  await register(page, { name: 'Full E2E', email, password: pass });

  // Go to Dashboard and click View All Recommendations
  await page.waitForSelector('h1:has-text("Portal Overview")');
  await openSettingsAndToggleDemo(page);
  await page.click('button:has-text("View All Recommendations")');
  await page.waitForSelector('h1:has-text("Recommendations")');
  await page.waitForSelector('button:has-text("Next")');

  // Workflows pagination
  await page.click('button:has-text("Workflows")');
  await page.waitForSelector('h1:has-text("Workflows")');
  await page.waitForSelector('button:has-text("Next")');
  await page.click('button:has-text("Next")');

  // Sequences pagination
  await page.click('button:has-text("Sequences")');
  await page.waitForSelector('h1:has-text("Sequences")');
  await page.waitForSelector('button:has-text("Next")');

  // Co-Pilot preview panel visibility
  await page.click('button:has-text("Co-Pilot")');
  await page.waitForSelector('h1:has-text("HubSpot Co-Pilot")');
  await page.click('button:has-text("Open Chat")');
  // bottom panel should appear when modal is open; check presence of Target ID input placeholder text
  const hasTargetInput = await page.$eval('input[placeholder*="workflowId"], input[placeholder*="sequenceId"]', () => true).catch(()=>false);
  console.log('Co-Pilot panel visible:', !!hasTargetInput);

  // Settings role UI should be visible for first user (admin)
  await page.click('button:has-text("Settings")');
  await page.waitForSelector('.fixed.inset-0');
  const roleVisible = await page.$eval('select', () => true).catch(()=>false);
  console.log('Role controls visible (admin):', !!roleVisible);
  await page.keyboard.press('Escape').catch(()=>{});

  console.log('E2E full interaction completed');
  await browser.close();
}

run().catch((err) => {
  console.error('E2E full failed:', err);
  process.exit(1);
});

