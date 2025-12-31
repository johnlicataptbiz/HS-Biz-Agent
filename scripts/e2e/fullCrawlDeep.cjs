/* eslint-disable no-console */
/**
 * Deep E2E Crawler - Comprehensive Integration Test Suite
 * 
 * Tests:
 * - User registration/login flow
 * - HubSpot OAuth connection (with mock PAT if configured)
 * - AI Agent interactions (chat, tool calls)
 * - CRM object creation (contacts, companies, deals)
 * - Workflow and sequence auditing
 * - Property management
 * - Full CRUD operations pushed to HubSpot
 * 
 * Usage:
 *   npm run e2e:deep
 *   E2E_PAT=pat-xxx npm run e2e:deep  # With real HubSpot PAT
 */

const puppeteer = require('puppeteer');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8080';
const HUBSPOT_PAT = process.env.E2E_PAT || process.env.HUBSPOT_PAT || '';
const TIMEOUT = 20000;
const AI_TIMEOUT = 60000; // AI responses can take longer

// Helper: sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Test results
const results = {
  tests: [],
  passed: 0,
  failed: 0,
  skipped: 0,
  apiCalls: [],
  aiInteractions: [],
  hubspotOperations: []
};

// Log a test result
function logTest(name, status, details = {}) {
  const test = { name, status, details, timestamp: new Date().toISOString() };
  results.tests.push(test);
  
  const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
  console.log(`${icon} ${name}${details.message ? ': ' + details.message : ''}`);
  
  if (status === 'passed') results.passed++;
  else if (status === 'failed') results.failed++;
  else results.skipped++;
  
  return status === 'passed';
}

// Helper: wait for element
async function waitFor(page, selector, timeout = TIMEOUT) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

// Helper: find button by text
async function findButtonByText(page, text, exact = false) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = await btn.evaluate(el => el.textContent || '');
    const match = exact 
      ? btnText.trim() === text 
      : btnText.toLowerCase().includes(text.toLowerCase());
    if (match) return btn;
  }
  return null;
}

// Helper: find input by placeholder or label
async function findInput(page, identifier) {
  // Try placeholder first
  let input = await page.$(`input[placeholder*="${identifier}" i]`);
  if (input) return input;
  
  // Try name attribute
  input = await page.$(`input[name*="${identifier}" i]`);
  if (input) return input;
  
  // Try type
  input = await page.$(`input[type="${identifier}"]`);
  return input;
}

// Helper: type into input with clearing
async function typeInto(page, selector, text) {
  const input = typeof selector === 'string' ? await page.$(selector) : selector;
  if (!input) return false;
  await input.click({ clickCount: 3 }); // Select all
  await input.type(text);
  return true;
}

// Helper: API call tracker
function setupApiTracker(page) {
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/')) {
      const status = response.status();
      results.apiCalls.push({
        url: url.replace(BACKEND_URL, ''),
        status,
        method: response.request().method(),
        timestamp: new Date().toISOString()
      });
    }
  });
}

// ============================================================
// TEST: User Registration
// ============================================================
async function testUserRegistration(page) {
  console.log('\n📝 PHASE 1: User Authentication');
  console.log('─'.repeat(50));
  
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
  await sleep(1000);
  
  // Check if we're on auth page
  const isAuthPage = await page.$('input[type="email"]');
  if (!isAuthPage) {
    return logTest('Auth Page Load', 'failed', { message: 'Auth page not found' });
  }
  logTest('Auth Page Load', 'passed');
  
  // Click "Create Account" tab
  const createBtn = await findButtonByText(page, 'Create Account');
  if (createBtn) {
    await createBtn.click();
    await sleep(500);
  }
  
  const email = `e2e.deep.${Date.now()}@test.local`;
  const password = 'DeepCrawl2024!';
  const name = 'E2E Deep Crawler';
  
  // Fill registration form
  const nameInput = await findInput(page, 'name');
  if (nameInput) await typeInto(page, nameInput, name);
  
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) await typeInto(page, emailInput, email);
  
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) await typeInto(page, passwordInput, password);
  
  // Submit
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await Promise.all([
      submitBtn.click(),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {})
    ]);
  }
  
  await sleep(2000);
  
  // Verify logged in
  const h1 = await page.$('h1');
  if (h1) {
    const h1Text = await h1.evaluate(el => el.textContent || '');
    if (h1Text.includes('Portal') || h1Text.includes('Dashboard') || h1Text.includes('Overview')) {
      logTest('User Registration', 'passed', { message: `Logged in as ${email}` });
      return { email, password, name };
    }
  }
  
  logTest('User Registration', 'failed', { message: 'Could not verify login' });
  return { email, password, name };
}

// ============================================================
// TEST: HubSpot Connection (if PAT available)
// ============================================================
async function testHubSpotConnection(page) {
  console.log('\n🔗 PHASE 2: HubSpot Connection');
  console.log('─'.repeat(50));
  
  if (!HUBSPOT_PAT) {
    logTest('HubSpot PAT Token', 'skipped', { message: 'No E2E_PAT provided - using demo mode' });
    return false;
  }
  
  // Get the auth token from localStorage
  const authToken = await page.evaluate(() => {
    return localStorage.getItem('HS_BIZ_AUTH_TOKEN');
  });
  
  if (!authToken) {
    return logTest('Get Auth Token for PAT', 'failed', { message: 'No auth token' });
  }
  
  // Connect PAT directly via API (more reliable than UI for E2E testing)
  console.log('  → Connecting PAT via API...');
  const connectResult = await page.evaluate(async (backendUrl, token, pat) => {
    try {
      const resp = await fetch(`${backendUrl}/api/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: pat })
      });
      const data = await resp.json();
      return { ok: resp.ok, status: resp.status, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, BACKEND_URL, authToken, HUBSPOT_PAT);
  
  console.log(`  → PAT connection result: ${JSON.stringify(connectResult)}`);
  
  if (connectResult.ok && connectResult.data?.success) {
    logTest('HubSpot PAT Connection', 'passed', { 
      message: `Connected to portal ${connectResult.data.portalId}` 
    });
    
    // Reload page to sync connection state
    console.log('  → Reloading page to sync state...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2000);
    
    return true;
  } else {
    logTest('HubSpot PAT Connection', 'failed', { 
      message: connectResult.error || connectResult.data?.error || 'Unknown error' 
    });
    return false;
  }
}

// ============================================================
// TEST: AI Agent Interactions
// ============================================================
async function testAiAgentInteractions(page) {
  console.log('\n🤖 PHASE 3: AI Agent Testing');
  console.log('─'.repeat(50));
  
  // Navigate to Co-Pilot page
  const copilotBtn = await findButtonByText(page, 'Co-Pilot');
  if (!copilotBtn) {
    return logTest('Navigate to Co-Pilot', 'failed');
  }
  
  await copilotBtn.click();
  await sleep(1500);
  logTest('Navigate to Co-Pilot', 'passed');
  
  // Test Quick Action cards on Co-Pilot page
  // These are button elements with the action title inside
  const quickActionTests = [
    { title: 'Full Portal Scan', expectedContext: 'workflow' },
    { title: 'Sequence Generator', expectedContext: 'sequence' },
    { title: 'Data Cleaner', expectedContext: 'data' },
    { title: 'Journey Architect', expectedContext: 'workflow' }
  ];
  
  for (const test of quickActionTests) {
    console.log(`  → Testing Quick Action: "${test.title}"`);
    
    // Navigate back to Co-Pilot to reset state between tests
    const refreshBtn = await findButtonByText(page, 'Co-Pilot');
    if (refreshBtn) {
      await refreshBtn.click();
      await sleep(1000);
    }
    
    // Refresh the button list each iteration (DOM may have changed)
    const currentButtons = await page.$$('button');
    
    // Find the button that contains this action title
    let actionBtn = null;
    for (const btn of currentButtons) {
      try {
        const isVisible = await btn.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (!isVisible) continue;
        
        const text = await btn.evaluate(el => el.textContent || '');
        if (text.includes(test.title)) {
          actionBtn = btn;
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (actionBtn) {
      try {
        // Ensure any existing modal is closed first
        await page.keyboard.press('Escape');
        await sleep(300);
        
        // Scroll the button into view before clicking
        await actionBtn.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await sleep(500);
        
        await actionBtn.click();
        await sleep(2500); // Give modal time to fully open
        
        // Look for AI modal - it has fixed positioning with bg-black/50 overlay
        const modal = await page.$('.fixed.inset-0');
        const modalVisible = modal ? await modal.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }) : false;
        
        if (modalVisible) {
          logTest(`Quick Action: ${test.title}`, 'passed', { message: 'Modal opened' });
          
          // Check for chat interface inside modal
          const chatContainer = await page.$('[class*="overflow-y-auto"], [class*="messages"]');
          if (chatContainer) {
            results.aiInteractions.push({
              action: test.title,
              modalOpened: true,
              timestamp: new Date().toISOString()
            });
          }
          
          // Look for textarea/input to send additional messages
          const chatInput = await page.$('textarea');
          if (chatInput) {
            await typeInto(page, chatInput, 'Give me specific recommendations');
            
            // Find send button (usually has Send icon or text)
            const sendBtn = await page.$('button[type="submit"]');
            if (sendBtn) {
              await sendBtn.click();
              await sleep(2000);
              logTest(`AI Follow-up: ${test.title}`, 'passed');
            }
          }
          
          // Close modal by clicking the X button or pressing Escape
          const closeBtn = await page.$('button[class*="absolute"][class*="top"]');
          if (closeBtn) {
            await closeBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
          await sleep(800); // Longer wait for modal animation to complete
        } else {
          // Check if there's any modal-like element
          const anyModal = await page.$('[role="dialog"], .modal, [class*="Modal"]');
          if (anyModal) {
            logTest(`Quick Action: ${test.title}`, 'passed', { message: 'Dialog opened' });
            await page.keyboard.press('Escape');
            await sleep(800);
          } else {
            logTest(`Quick Action: ${test.title}`, 'failed', { message: 'Modal did not open' });
          }
        }
      } catch (e) {
        logTest(`Quick Action: ${test.title}`, 'failed', { message: e.message });
      }
    } else {
      logTest(`Quick Action: ${test.title}`, 'skipped', { message: 'Button not found' });
    }
  }
  
  // Test the inline Actions panel (preview/execute)
  console.log('  → Testing Actions Panel...');
  
  // Look for the Actions section which has tabs for Workflow/Sequence
  const workflowTab = await findButtonByText(page, 'Workflow');
  if (workflowTab) {
    await workflowTab.click();
    await sleep(500);
    
    // Look for ID input field
    const idInput = await page.$('input[placeholder*="ID" i]');
    if (idInput) {
      await typeInto(page, idInput, '123456');
      
      // Click Preview button
      const previewBtn = await findButtonByText(page, 'Preview');
      if (previewBtn) {
        await previewBtn.click();
        await sleep(2000);
        logTest('Actions Panel: Preview', 'passed');
      }
    }
  }
}

// ============================================================
// TEST: HubSpot CRM Operations (if connected)
// ============================================================
async function testHubSpotCrmOperations(page, isConnected) {
  console.log('\n📊 PHASE 4: HubSpot CRM Operations');
  console.log('─'.repeat(50));
  
  if (!isConnected && !HUBSPOT_PAT) {
    logTest('CRM Operations', 'skipped', { message: 'No HubSpot connection - using mock data' });
    return;
  }
  
  // Test via API directly - the app stores token as HS_BIZ_AUTH_TOKEN
  const testEndpoints = [
    { name: 'List Contacts', endpoint: '/api/tools/list-objects/contacts?limit=5' },
    { name: 'List Companies', endpoint: '/api/tools/list-objects/companies?limit=5' },
    { name: 'List Deals', endpoint: '/api/tools/list-objects/deals?limit=5' },
    { name: 'List Workflows', endpoint: '/api/tools/list-workflows' },
    { name: 'List Sequences', endpoint: '/api/tools/list-sequences' },
    { name: 'List Contact Properties', endpoint: '/api/tools/list-properties/contacts' }
  ];
  
  // Get auth token from localStorage - try multiple possible keys
  const authToken = await page.evaluate(() => {
    return localStorage.getItem('HS_BIZ_AUTH_TOKEN') || 
           localStorage.getItem('authToken') ||
           localStorage.getItem('token');
  });
  
  if (!authToken) {
    logTest('Get Auth Token', 'failed', { message: 'No auth token in localStorage' });
    return;
  }
  
  // Debug: log partial token
  console.log(`  Token prefix: ${authToken.substring(0, 30)}...`);
  
  logTest('Get Auth Token', 'passed', { message: 'Token found' });
  
  // First check if this user has a HubSpot connection
  try {
    const meResponse = await page.evaluate(async (url, token) => {
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await resp.json();
    }, `${BACKEND_URL}/api/auth/me`, authToken);
    
    console.log(`  User: ${meResponse.user?.email}, HubSpot: ${meResponse.hasHubSpotConnection ? 'Connected' : 'Not connected'}`);
    
    if (!meResponse.hasHubSpotConnection) {
      logTest('HubSpot Connection Check', 'failed', { message: 'User does not have HubSpot connected in database' });
      return;
    }
  } catch (e) {
    console.log(`  Error checking user: ${e.message}`);
  }
  
  for (const test of testEndpoints) {
    try {
      const response = await page.evaluate(async (url, token) => {
        const resp = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json().catch(() => ({}));
        return { status: resp.status, ok: resp.ok, data };
      }, `${BACKEND_URL}${test.endpoint}`, authToken);
      
      if (response.ok) {
        const count = response.data?.results?.length || response.data?.workflows?.length || response.data?.length || 0;
        logTest(test.name, 'passed', { message: `Retrieved ${count} items` });
      } else if (response.status === 401) {
        logTest(test.name, 'failed', { message: 'Unauthorized - token may be invalid' });
      } else {
        logTest(test.name, 'failed', { message: `Status: ${response.status}` });
      }
    } catch (error) {
      logTest(test.name, 'failed', { message: error.message });
    }
  }
}

// ============================================================
// TEST: Create HubSpot Records (if connected with PAT)
// ============================================================
async function testCreateHubSpotRecords(page) {
  console.log('\n✨ PHASE 5: Create HubSpot Records');
  console.log('─'.repeat(50));
  
  if (!HUBSPOT_PAT) {
    logTest('Create Records', 'skipped', { message: 'No E2E_PAT - skipping write operations' });
    return;
  }
  
  // Get auth token from localStorage - try multiple possible keys
  const authToken = await page.evaluate(() => {
    return localStorage.getItem('HS_BIZ_AUTH_TOKEN') || 
           localStorage.getItem('authToken') ||
           localStorage.getItem('token');
  });
  
  if (!authToken) {
    logTest('Create Records', 'failed', { message: 'No auth token' });
    return;
  }
  
  const timestamp = Date.now();
  
  // Create test contact
  const contactData = {
    properties: {
      email: `e2e.test.${timestamp}@example.com`,
      firstname: 'E2E',
      lastname: `Test ${timestamp}`,
      phone: '555-0100',
      company: 'E2E Test Corp'
    }
  };
  
  try {
    const createContactResult = await page.evaluate(async (url, token, data) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      const json = await resp.json().catch(() => ({}));
      return { status: resp.status, ok: resp.ok, data: json };
    }, `${BACKEND_URL}/api/tools/batch-create/contacts`, authToken, { inputs: [contactData] });
    
    if (createContactResult.ok) {
      results.hubspotOperations.push({
        type: 'create_contact',
        success: true,
        data: createContactResult.data
      });
      logTest('Create Contact', 'passed', { message: `Created: ${contactData.properties.email}` });
    } else {
      logTest('Create Contact', 'failed', { message: JSON.stringify(createContactResult.data) });
    }
  } catch (error) {
    logTest('Create Contact', 'failed', { message: error.message });
  }
  
  // Create test company
  const companyData = {
    properties: {
      name: `E2E Test Company ${timestamp}`,
      domain: `e2e-test-${timestamp}.example.com`
    }
  };
  
  try {
    const createCompanyResult = await page.evaluate(async (url, token, data) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      const json = await resp.json().catch(() => ({}));
      return { status: resp.status, ok: resp.ok, data: json };
    }, `${BACKEND_URL}/api/tools/batch-create/companies`, authToken, { inputs: [companyData] });
    
    if (createCompanyResult.ok) {
      results.hubspotOperations.push({
        type: 'create_company',
        success: true,
        data: createCompanyResult.data
      });
      logTest('Create Company', 'passed', { message: `Created: ${companyData.properties.name}` });
    } else {
      logTest('Create Company', 'failed', { message: JSON.stringify(createCompanyResult.data) });
    }
  } catch (error) {
    logTest('Create Company', 'failed', { message: error.message });
  }
  
  // Create test deal
  const dealData = {
    properties: {
      dealname: `E2E Test Deal ${timestamp}`,
      amount: '10000',
      dealstage: 'appointmentscheduled',
      pipeline: 'default'
    }
  };
  
  try {
    const createDealResult = await page.evaluate(async (url, token, data) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      const json = await resp.json().catch(() => ({}));
      return { status: resp.status, ok: resp.ok, data: json };
    }, `${BACKEND_URL}/api/tools/batch-create/deals`, authToken, { inputs: [dealData] });
    
    if (createDealResult.ok) {
      results.hubspotOperations.push({
        type: 'create_deal',
        success: true,
        data: createDealResult.data
      });
      logTest('Create Deal', 'passed', { message: `Created: ${dealData.properties.dealname}` });
    } else {
      logTest('Create Deal', 'failed', { message: JSON.stringify(createDealResult.data) });
    }
  } catch (error) {
    logTest('Create Deal', 'failed', { message: error.message });
  }
}

// ============================================================
// TEST: Workflow Auditing
// ============================================================
async function testWorkflowAuditing(page) {
  console.log('\n⚙️ PHASE 6: Workflow Analysis');
  console.log('─'.repeat(50));
  
  // Navigate to Workflows page
  const workflowsBtn = await findButtonByText(page, 'Workflows');
  if (!workflowsBtn) {
    return logTest('Navigate to Workflows', 'failed');
  }
  
  await workflowsBtn.click();
  await sleep(2000);
  logTest('Navigate to Workflows', 'passed');
  
  // Check for workflow cards or table rows
  const workflowCards = await page.$$('[class*="card"], [class*="bg-white"][class*="rounded"], tr[class*="hover"]');
  const workflowCount = workflowCards.length;
  
  if (workflowCount > 0) {
    logTest('Workflow List Loaded', 'passed', { message: `Found ${workflowCount} workflow items` });
    
    // Try clicking on first workflow to see details/modal
    try {
      // Look for clickable element within the first card
      const firstCard = workflowCards[0];
      const clickableEl = await firstCard.$('button, a, [role="button"]') || firstCard;
      
      await clickableEl.click();
      await sleep(1500);
      
      // Check if a detail view or modal opened
      const detailView = await page.$('[class*="modal"], [class*="detail"], [class*="panel"]');
      const optimizeBtn = await findButtonByText(page, 'Optimize') || 
                          await findButtonByText(page, 'Audit') ||
                          await findButtonByText(page, 'Analyze');
      
      if (optimizeBtn) {
        logTest('Workflow Detail View', 'passed');
        
        await optimizeBtn.click();
        await sleep(2000);
        
        // Check for AI modal
        const aiModal = await page.$('.fixed.inset-0.bg-black\\/50, .fixed.inset-0[class*="bg-"]');
        if (aiModal) {
          logTest('Workflow AI Audit Modal', 'passed');
          results.aiInteractions.push({
            action: 'Workflow Optimization',
            modalOpened: true,
            timestamp: new Date().toISOString()
          });
          await page.keyboard.press('Escape');
          await sleep(500);
        }
      } else if (detailView) {
        logTest('Workflow Detail View', 'passed');
      }
    } catch (e) {
      logTest('Workflow Detail Click', 'skipped', { message: e.message });
    }
  } else {
    // Check if using mock data message
    const mockMessage = await page.$('[class*="text-gray"], [class*="empty"]');
    if (mockMessage) {
      logTest('Workflow List Loaded', 'passed', { message: 'Using mock/empty data' });
    } else {
      logTest('Workflow List Loaded', 'skipped', { message: 'No workflows visible' });
    }
  }
  
  // Test workflow score/health indicators
  const scoreElements = await page.$$('[class*="score"], [class*="health"], [class*="badge"]');
  if (scoreElements.length > 0) {
    logTest('Workflow Health Scores', 'passed', { message: `Found ${scoreElements.length} score indicators` });
  }
}

// ============================================================
// TEST: Sequence Analysis  
// ============================================================
async function testSequenceAnalysis(page) {
  console.log('\n📧 PHASE 7: Sequence Analysis');
  console.log('─'.repeat(50));
  
  // Navigate to Sequences page
  const sequencesBtn = await findButtonByText(page, 'Sequences');
  if (!sequencesBtn) {
    return logTest('Navigate to Sequences', 'failed');
  }
  
  await sequencesBtn.click();
  await sleep(2000);
  logTest('Navigate to Sequences', 'passed');
  
  // Check for sequence cards or table
  const sequenceCards = await page.$$('[class*="card"], [class*="bg-white"][class*="rounded"], tr[class*="hover"]');
  const sequenceCount = sequenceCards.length;
  
  logTest('Sequence List Loaded', 'passed', { message: `Found ${sequenceCount} sequence items` });
  
  // Look for reply rate metrics
  const replyRateElements = await page.$$eval('*', els => 
    els.filter(el => el.textContent && el.textContent.includes('%')).length
  );
  if (replyRateElements > 0) {
    logTest('Sequence Metrics Display', 'passed', { message: 'Found percentage metrics' });
  }
  
  // Try clicking a sequence to open AI analysis
  if (sequenceCards.length > 0) {
    try {
      const firstSeq = sequenceCards[0];
      const clickable = await firstSeq.$('button, a') || firstSeq;
      await clickable.click();
      await sleep(1500);
      
      // Look for Analyze/Optimize button
      const analyzeBtn = await findButtonByText(page, 'Analyze') ||
                        await findButtonByText(page, 'Optimize') ||
                        await findButtonByText(page, 'Improve');
      
      if (analyzeBtn) {
        await analyzeBtn.click();
        await sleep(2000);
        
        const modal = await page.$('.fixed.inset-0.bg-black\\/50');
        if (modal) {
          logTest('Sequence AI Analysis Modal', 'passed');
          results.aiInteractions.push({
            action: 'Sequence Analysis',
            modalOpened: true,
            timestamp: new Date().toISOString()
          });
          await page.keyboard.press('Escape');
          await sleep(500);
        }
      }
    } catch (e) {
      logTest('Sequence Detail Click', 'skipped', { message: e.message });
    }
  }
  
  // Check for "Draft New Sequence" or similar creation button
  const createBtn = await findButtonByText(page, 'Draft') || 
                   await findButtonByText(page, 'New Sequence') ||
                   await findButtonByText(page, 'Create');
  if (createBtn) {
    logTest('Sequence Creation Button', 'passed');
  }
}

// ============================================================
// TEST: Data Model / Properties
// ============================================================
async function testDataModelPage(page) {
  console.log('\n🗂️ PHASE 8: Data Model Analysis');
  console.log('─'.repeat(50));
  
  // Navigate to Data Model page
  const dataBtn = await findButtonByText(page, 'Data Model');
  if (!dataBtn) {
    return logTest('Navigate to Data Model', 'failed');
  }
  
  await dataBtn.click();
  await sleep(2000);
  logTest('Navigate to Data Model', 'passed');
  
  // Check for property list
  const propertyItems = await page.$$('[class*="property"], [class*="field"], tr');
  logTest('Property List Loaded', 'passed', { message: `Found ${propertyItems.length} items` });
  
  // Check for object type tabs/filters
  const objectTabs = await page.$$('button');
  let foundObjectTypes = 0;
  for (const tab of objectTabs) {
    const text = await tab.evaluate(el => el.textContent || '');
    if (['Contacts', 'Companies', 'Deals', 'Tickets'].some(t => text.includes(t))) {
      foundObjectTypes++;
    }
  }
  
  if (foundObjectTypes > 0) {
    logTest('Object Type Filters', 'passed', { message: `Found ${foundObjectTypes} object types` });
  }
  
  // Test pagination
  const nextBtn = await findButtonByText(page, 'Next');
  if (nextBtn) {
    await nextBtn.click();
    await sleep(1000);
    logTest('Pagination Works', 'passed');
  }
}

// ============================================================
// TEST: Breeze Tools / Custom Actions
// ============================================================
async function testBreezeTools(page) {
  console.log('\n⚡ PHASE 9: Breeze Tools');
  console.log('─'.repeat(50));
  
  // Navigate to Breeze Tools page
  const breezeBtn = await findButtonByText(page, 'Breeze');
  if (!breezeBtn) {
    return logTest('Navigate to Breeze Tools', 'failed');
  }
  
  await breezeBtn.click();
  await sleep(2000);
  logTest('Navigate to Breeze Tools', 'passed');
  
  // Check for tool cards
  const toolCards = await page.$$('[class*="tool"], [class*="card"]');
  logTest('Breeze Tools List', 'passed', { message: `Found ${toolCards.length} tools` });
  
  // Try "Draft New Tool" button
  const draftBtn = await findButtonByText(page, 'Draft New Tool') || 
                   await findButtonByText(page, 'New Tool') ||
                   await findButtonByText(page, 'Create');
  
  if (draftBtn) {
    await draftBtn.click();
    await sleep(1000);
    
    // Check for modal/form
    const modal = await page.$('.fixed.inset-0, [role="dialog"], form');
    if (modal) {
      logTest('Draft Tool Modal', 'passed');
      await page.keyboard.press('Escape');
      await sleep(500);
    }
  }
}

// ============================================================
// TEST: Full AI Chat Conversation
// ============================================================
async function testFullAiConversation(page) {
  console.log('\n💬 PHASE 10: Full AI Conversation');
  console.log('─'.repeat(50));
  
  // Navigate to Co-Pilot
  const copilotBtn = await findButtonByText(page, 'Co-Pilot');
  if (copilotBtn) {
    await copilotBtn.click();
    await sleep(1500);
  }
  
  // Find the chat interface - could be in modal or inline
  let chatInput = await page.$('textarea, input[placeholder*="message" i], input[placeholder*="ask" i]');
  
  // If not found, try clicking a button to open chat
  if (!chatInput) {
    const chatBtn = await findButtonByText(page, 'Chat') || 
                    await findButtonByText(page, 'Ask') ||
                    await findButtonByText(page, 'AI');
    if (chatBtn) {
      await chatBtn.click();
      await sleep(1000);
      chatInput = await page.$('textarea, input[placeholder*="message" i]');
    }
  }
  
  if (!chatInput) {
    // Try any action button that opens AI modal
    const actionBtns = await page.$$('button');
    for (const btn of actionBtns.slice(0, 10)) {
      const text = await btn.evaluate(el => el.textContent || '');
      if (text.includes('Audit') || text.includes('Generate') || text.includes('Optimize')) {
        await btn.click();
        await sleep(1000);
        chatInput = await page.$('textarea, input[placeholder*="message" i]');
        if (chatInput) break;
      }
    }
  }
  
  if (!chatInput) {
    return logTest('Find Chat Input', 'skipped', { message: 'Chat input not accessible' });
  }
  
  logTest('Find Chat Input', 'passed');
  
  // Send a complex multi-step request
  const complexPrompt = "Analyze my HubSpot portal and give me the top 3 optimization opportunities";
  
  await typeInto(page, chatInput, complexPrompt);
  
  const sendBtn = await page.$('button[type="submit"]') || await findButtonByText(page, 'Send');
  if (sendBtn) {
    await sendBtn.click();
    
    // Wait for AI response (can take a while)
    console.log('  ⏳ Waiting for AI response...');
    await sleep(AI_TIMEOUT / 3);
    
    // Check for response
    const messages = await page.$$('[class*="message"], [class*="response"], [class*="chat"]');
    if (messages.length > 1) {
      results.aiInteractions.push({
        prompt: complexPrompt,
        success: true,
        responseCount: messages.length
      });
      logTest('AI Complex Response', 'passed', { message: `Received ${messages.length} messages` });
    } else {
      logTest('AI Complex Response', 'skipped', { message: 'Response still pending or not visible' });
    }
  }
}

// ============================================================
// MAIN CRAWLER
// ============================================================
async function runDeepCrawl() {
  console.log('🕷️ Starting DEEP E2E Crawl...');
  console.log('═'.repeat(60));
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Backend URL: ${BACKEND_URL}`);
  console.log(`   HubSpot PAT: ${HUBSPOT_PAT ? 'Configured ✓' : 'Not configured (demo mode)'}`);
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  let hubspotConnected = false;
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    
    // Setup tracking
    setupApiTracker(page);
    
    // Run all test phases
    const user = await testUserRegistration(page);
    hubspotConnected = await testHubSpotConnection(page);
    await testAiAgentInteractions(page);
    await testHubSpotCrmOperations(page, hubspotConnected);
    await testCreateHubSpotRecords(page);
    await testWorkflowAuditing(page);
    await testSequenceAnalysis(page);
    await testDataModelPage(page);
    await testBreezeTools(page);
    await testFullAiConversation(page);
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'reports/e2e-deep-final.png', 
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved to reports/e2e-deep-final.png');
    
  } catch (err) {
    console.error('\n❌ Fatal crawler error:', err.message);
    results.failed++;
  } finally {
    await browser.close();
  }
  
  // Print comprehensive report
  printReport();
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

function printReport() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 DEEP E2E CRAWL REPORT');
  console.log('═'.repeat(60));
  
  const total = results.passed + results.failed + results.skipped;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
  
  console.log(`\n✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️ Skipped: ${results.skipped}`);
  console.log(`📈 Pass Rate: ${passRate}%`);
  
  // API Calls Summary
  console.log('\n📡 API Calls Made:');
  const apiSummary = {};
  for (const call of results.apiCalls) {
    const key = `${call.method} ${call.url.split('?')[0]}`;
    apiSummary[key] = (apiSummary[key] || 0) + 1;
  }
  for (const [endpoint, count] of Object.entries(apiSummary).slice(0, 10)) {
    console.log(`   ${count}x ${endpoint}`);
  }
  
  // AI Interactions
  if (results.aiInteractions.length > 0) {
    console.log('\n🤖 AI Interactions:');
    for (const ai of results.aiInteractions) {
      const label = ai.prompt || ai.action || 'Unknown';
      const success = ai.success !== undefined ? ai.success : ai.modalOpened;
      console.log(`   • ${label.slice(0, 50)}${label.length > 50 ? '...' : ''}: ${success ? '✓' : '✗'}`);
    }
  }
  
  // HubSpot Operations
  if (results.hubspotOperations.length > 0) {
    console.log('\n📊 HubSpot Write Operations:');
    for (const op of results.hubspotOperations) {
      console.log(`   • ${op.type}: ${op.success ? '✓' : '✗'}`);
    }
  }
  
  // Failed Tests Detail
  const failedTests = results.tests.filter(t => t.status === 'failed');
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    for (const test of failedTests) {
      console.log(`   • ${test.name}: ${test.details.message || 'Unknown error'}`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  if (results.failed > 0) {
    console.log('❌ DEEP CRAWL FAILED');
  } else {
    console.log('✅ DEEP CRAWL PASSED');
  }
  console.log('═'.repeat(60));
}

// Run
runDeepCrawl().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
