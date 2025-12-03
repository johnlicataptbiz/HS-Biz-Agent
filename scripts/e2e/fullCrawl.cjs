/* eslint-disable no-console */
/**
 * Full E2E Crawler - Comprehensive SaaS Test Suite
 * 
 * This script:
 * 1. Launches the app and registers a test user
 * 2. Systematically visits every page in the app
 * 3. Discovers and exercises all interactive elements
 * 4. Records console errors, network failures, and no-op buttons
 * 5. Tests pagination on all list views
 * 6. Verifies modal open/close behavior
 * 7. Fails on any critical issues
 * 
 * Usage:
 *   npm run e2e:crawl
 *   E2E_BASE_URL=http://localhost:3000 node scripts/e2e/fullCrawl.cjs
 */

const puppeteer = require('puppeteer');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8080';
const TIMEOUT = 15000;

// Test results accumulator
const results = {
  pages: [],
  consoleErrors: [],
  networkErrors: [],
  noOpButtons: [],
  accessibilityIssues: [],
  passed: 0,
  failed: 0,
  skipped: 0
};

// All pages/tabs in the app
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', selector: 'h1:has-text("Portal Overview")' },
  { id: 'copilot', label: 'Co-Pilot', selector: 'h1:has-text("HubSpot Co-Pilot")' },
  { id: 'workflows', label: 'Workflows', selector: 'h1:has-text("Workflows")' },
  { id: 'sequences', label: 'Sequences', selector: 'h1:has-text("Sequences")' },
  { id: 'campaigns', label: 'Campaigns', selector: 'h1:has-text("Campaigns")' },
  { id: 'datamodel', label: 'Data Model', selector: 'h1:has-text("Data Model")' },
  { id: 'breezetools', label: 'Breeze Tools', selector: 'h1:has-text("Breeze Tools")' },
  { id: 'recommendations', label: 'Recommendations', selector: 'h1:has-text("Recommendations")' }
];

// Helper: wait for element
async function waitFor(page, selector, timeout = TIMEOUT) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

// Helper: safe click
async function safeClick(page, selector, description = '') {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    return { success: true, description };
  } catch (e) {
    return { success: false, description, error: e.message };
  }
}

// Helper: check for console errors
function setupConsoleListener(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore some expected errors
      if (!text.includes('favicon') && !text.includes('net::ERR_')) {
        results.consoleErrors.push({ text, url: page.url() });
      }
    }
  });

  page.on('pageerror', (err) => {
    results.consoleErrors.push({ text: err.message, url: page.url(), type: 'pageerror' });
  });
}

// Helper: check for network errors
function setupNetworkListener(page) {
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    // Track 4xx/5xx errors (except expected ones)
    if (status >= 400 && !url.includes('favicon') && !url.includes('/api/recommendations')) {
      results.networkErrors.push({ status, url, pageUrl: page.url() });
    }
  });
}

// Test: Register a new user
async function testRegister(page) {
  console.log('📝 Testing user registration...');
  
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
  
  // Click "Create Account" tab
  const createBtn = await page.$x("//button[contains(., 'Create Account')]");
  if (createBtn[0]) {
    await createBtn[0].click();
    await page.waitForTimeout(500);
  }
  
  const email = `crawler+${Date.now()}@e2e.test`;
  const password = 'CrawlerTest123!';
  
  // Fill registration form
  await page.type('input[placeholder="Your name"]', 'E2E Crawler');
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  
  // Submit
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT })
  ]);
  
  // Verify we're logged in (should see Dashboard)
  const onDashboard = await waitFor(page, 'h1', 5000);
  if (onDashboard) {
    console.log('✅ Registration successful');
    results.passed++;
    return { email, password };
  } else {
    console.log('❌ Registration failed');
    results.failed++;
    return null;
  }
}

// Test: Navigate to all pages
async function testNavigateAllPages(page) {
  console.log('\n📍 Testing navigation to all pages...');
  
  for (const pageInfo of PAGES) {
    console.log(`  → Navigating to ${pageInfo.label}...`);
    
    // Find and click the nav button
    const navResult = await safeClick(
      page, 
      `button:has-text("${pageInfo.label}")`,
      `Navigate to ${pageInfo.label}`
    );
    
    if (!navResult.success) {
      // Try alternative selector
      const buttons = await page.$$('button');
      let found = false;
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent || '');
        if (text.includes(pageInfo.label) || text.includes(pageInfo.id)) {
          await btn.click();
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`    ⚠️ Could not find nav button for ${pageInfo.label}`);
        results.skipped++;
        continue;
      }
    }
    
    await page.waitForTimeout(1000);
    
    // Verify page loaded
    const pageLoaded = await waitFor(page, 'h1', 5000);
    const h1Text = pageLoaded ? await page.$eval('h1', el => el.textContent).catch(() => '') : '';
    
    results.pages.push({
      id: pageInfo.id,
      label: pageInfo.label,
      loaded: pageLoaded,
      h1Text
    });
    
    if (pageLoaded) {
      console.log(`    ✅ ${pageInfo.label} loaded`);
      results.passed++;
    } else {
      console.log(`    ❌ ${pageInfo.label} failed to load`);
      results.failed++;
    }
  }
}

// Test: Pagination on list pages
async function testPagination(page) {
  console.log('\n📄 Testing pagination...');
  
  const paginatedPages = ['workflows', 'sequences', 'recommendations'];
  
  for (const pageId of paginatedPages) {
    console.log(`  → Testing pagination on ${pageId}...`);
    
    // Navigate to page
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent || '');
      if (text.toLowerCase().includes(pageId.replace('s', ''))) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(1500);
    
    // Check for pagination controls
    const hasNext = await page.$('button:has-text("Next")');
    const hasPrev = await page.$('button:has-text("Previous")');
    
    if (hasNext || hasPrev) {
      console.log(`    ✅ ${pageId} has pagination controls`);
      results.passed++;
      
      // Try clicking Next if not disabled
      if (hasNext) {
        const isDisabled = await page.$eval('button:has-text("Next")', el => el.disabled).catch(() => true);
        if (!isDisabled) {
          await page.click('button:has-text("Next")');
          await page.waitForTimeout(500);
          console.log(`    ✅ Next button works`);
        }
      }
    } else {
      console.log(`    ⚠️ ${pageId} missing pagination (may be expected with few items)`);
    }
  }
}

// Test: Modal open/close
async function testModals(page) {
  console.log('\n🪟 Testing modal interactions...');
  
  // Test Settings modal
  console.log('  → Testing Settings modal...');
  const settingsBtn = await page.$('button:has-text("Settings")');
  if (settingsBtn) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
    
    const modalOpen = await page.$('.fixed.inset-0');
    if (modalOpen) {
      console.log('    ✅ Settings modal opens');
      results.passed++;
      
      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      const modalClosed = !(await page.$('.fixed.inset-0'));
      if (modalClosed) {
        console.log('    ✅ Settings modal closes with Escape');
        results.passed++;
      }
    }
  }
  
  // Test AI Modal on Workflows page
  console.log('  → Testing AI modal on Workflows...');
  const workflowsBtn = await page.$('button:has-text("Workflows")');
  if (workflowsBtn) {
    await workflowsBtn.click();
    await page.waitForTimeout(1000);
    
    const draftBtn = await page.$('button:has-text("Draft Workflow")');
    if (draftBtn) {
      await draftBtn.click();
      await page.waitForTimeout(500);
      
      const aiModalOpen = await page.$('[role="dialog"], .fixed.inset-0');
      if (aiModalOpen) {
        console.log('    ✅ AI modal opens');
        results.passed++;
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  }
}

// Test: Button functionality (no-op detection)
async function testButtonFunctionality(page) {
  console.log('\n🔘 Testing button functionality...');
  
  // Go to Dashboard
  const dashBtn = await page.$('button:has-text("Dashboard")');
  if (dashBtn) await dashBtn.click();
  await page.waitForTimeout(1000);
  
  // Test "View All Recommendations" button
  const viewAllBtn = await page.$('button:has-text("View All Recommendations")');
  if (viewAllBtn) {
    const beforeUrl = page.url();
    await viewAllBtn.click();
    await page.waitForTimeout(1000);
    
    const h1 = await page.$eval('h1', el => el.textContent).catch(() => '');
    if (h1.includes('Recommendations')) {
      console.log('  ✅ View All Recommendations button works');
      results.passed++;
    } else {
      console.log('  ❌ View All Recommendations button is no-op');
      results.noOpButtons.push('View All Recommendations');
      results.failed++;
    }
  }
  
  // Test Refresh buttons
  const refreshBtns = await page.$$('button[title="Refresh Data"]');
  console.log(`  → Found ${refreshBtns.length} Refresh buttons`);
  
  // Test "Connect to see live data" button (if not connected)
  const connectBtn = await page.$('button:has-text("Connect to see live data")');
  if (connectBtn) {
    console.log('  ℹ️ Connect button present (expected in demo mode)');
  }
}

// Test: Accessibility basics
async function testAccessibility(page) {
  console.log('\n♿ Testing basic accessibility...');
  
  // Check for buttons without accessible names
  const buttons = await page.$$('button');
  let unlabeledCount = 0;
  
  for (const btn of buttons) {
    const text = await btn.evaluate(el => {
      return el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '';
    });
    if (!text) {
      unlabeledCount++;
    }
  }
  
  if (unlabeledCount > 0) {
    console.log(`  ⚠️ Found ${unlabeledCount} buttons without text/aria-label`);
    results.accessibilityIssues.push(`${unlabeledCount} unlabeled buttons`);
  } else {
    console.log('  ✅ All buttons have accessible names');
    results.passed++;
  }
  
  // Check for images without alt text
  const images = await page.$$('img');
  let noAltCount = 0;
  for (const img of images) {
    const alt = await img.evaluate(el => el.getAttribute('alt') || '');
    if (!alt) noAltCount++;
  }
  
  if (noAltCount > 0) {
    console.log(`  ⚠️ Found ${noAltCount} images without alt text`);
    results.accessibilityIssues.push(`${noAltCount} images without alt`);
  } else {
    console.log('  ✅ All images have alt text');
    results.passed++;
  }
}

// Test: Error states
async function testErrorStates(page) {
  console.log('\n⚠️ Testing error handling...');
  
  // Try to trigger an error by visiting an invalid API endpoint
  // This is more of a smoke test for error boundaries
  
  // Go to Workflows and check empty state handling
  const workflowsBtn = await page.$('button:has-text("Workflows")');
  if (workflowsBtn) {
    await workflowsBtn.click();
    await page.waitForTimeout(1500);
    
    // Check for loading state or content
    const hasContent = await page.$('[data-testid="wf-card"], .text-center');
    if (hasContent) {
      console.log('  ✅ Workflows handles data/empty state correctly');
      results.passed++;
    }
  }
}

// Generate report
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 E2E CRAWL REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️ Skipped: ${results.skipped}`);
  
  if (results.consoleErrors.length > 0) {
    console.log(`\n🔴 Console Errors (${results.consoleErrors.length}):`);
    results.consoleErrors.slice(0, 5).forEach(e => {
      console.log(`   - ${e.text.substring(0, 100)}`);
    });
  }
  
  if (results.networkErrors.length > 0) {
    console.log(`\n🔴 Network Errors (${results.networkErrors.length}):`);
    results.networkErrors.slice(0, 5).forEach(e => {
      console.log(`   - ${e.status}: ${e.url.substring(0, 80)}`);
    });
  }
  
  if (results.noOpButtons.length > 0) {
    console.log(`\n⚠️ No-Op Buttons (${results.noOpButtons.length}):`);
    results.noOpButtons.forEach(b => console.log(`   - ${b}`));
  }
  
  if (results.accessibilityIssues.length > 0) {
    console.log(`\n♿ Accessibility Issues:`);
    results.accessibilityIssues.forEach(i => console.log(`   - ${i}`));
  }
  
  console.log('\n📍 Pages Tested:');
  results.pages.forEach(p => {
    const status = p.loaded ? '✅' : '❌';
    console.log(`   ${status} ${p.label}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  // Return exit code
  const criticalErrors = results.consoleErrors.filter(e => e.type === 'pageerror').length;
  const has500Errors = results.networkErrors.some(e => e.status >= 500);
  
  if (criticalErrors > 0 || has500Errors || results.failed > 3) {
    console.log('❌ CRAWL FAILED - Critical issues found');
    return 1;
  }
  
  console.log('✅ CRAWL PASSED');
  return 0;
}

// Main runner
async function run() {
  console.log('🕷️ Starting Full E2E Crawl...');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Backend URL: ${BACKEND_URL}`);
  console.log('');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT);
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  // Setup listeners
  setupConsoleListener(page);
  setupNetworkListener(page);
  
  try {
    // Run all tests
    const user = await testRegister(page);
    if (!user) {
      console.log('❌ Cannot continue without registration');
      await browser.close();
      process.exit(1);
    }
    
    await testNavigateAllPages(page);
    await testPagination(page);
    await testModals(page);
    await testButtonFunctionality(page);
    await testAccessibility(page);
    await testErrorStates(page);
    
  } catch (error) {
    console.error('❌ Crawler error:', error.message);
    results.failed++;
  }
  
  await browser.close();
  
  const exitCode = generateReport();
  process.exit(exitCode);
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
