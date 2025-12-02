import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

console.log('=== SERVER STARTUP ===');
console.log('Imports successful');
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('__dirname:', __dirname);

const app = express();
const PORT = process.env.PORT || 8080;
console.log('Using PORT:', PORT);
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Get app URL for redirects
const getAppUrl = () => {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.APP_URL || 'http://localhost:8080';
};

// HubSpot App credentials (set in Railway environment variables)
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const REQUIRED_ENV_VARS = ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length) {
  console.error('Missing required HubSpot OAuth env vars:', missingEnvVars.join(', '));
  throw new Error('HubSpot OAuth credentials must be configured on the server');
}

// Check if dist folder exists
const distPath = path.join(__dirname, '../dist');
const distExists = fs.existsSync(distPath);

// Log startup info
console.log('Starting server...');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - PORT: ${PORT}`);
console.log(`  - __dirname: ${__dirname}`);
console.log(`  - distPath: ${distPath}`);
console.log(`  - distExists: ${distExists}`);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Serve static files from the built frontend (if exists)
if (distExists) {
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));
} else {
  console.log('WARNING: dist folder not found, frontend will not be served');
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Helper: Extract Bearer token from request
const getToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

// Helper: Make authenticated HubSpot API request
const hubspotRequest = async (endpoint, token, options = {}) => {
  const url = `${HUBSPOT_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { status: response.status, message: response.statusText, error };
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

// ============================================================
// App Config Endpoint (provides client ID to frontend)
// ============================================================
app.get('/api/config', (req, res) => {
  // All scopes configured in the HubSpot app - EXACTLY matching HubSpot config
  const scopes = [
    'account-info.security.read',
    'accounting',
    'actions',
    'analytics.behavioral_events.send',
    'automation',
    'automation.sequences.enrollments.write',
    'automation.sequences.read',
    'behavioral_events.event_definitions.read_write',
    'business-intelligence',
    'communication_preferences.read',
    'communication_preferences.read_write',
    'communication_preferences.statuses.batch.read',
    'communication_preferences.statuses.batch.write',
    'communication_preferences.write',
    'content',
    'conversations.custom_channels.read',
    'conversations.custom_channels.write',
    'conversations.read',
    'conversations.visitor_identification.tokens.create',
    'conversations.write',
    'crm.export',
    'crm.lists.read',
    'crm.lists.write',
    'crm.objects.appointments.read',
    'crm.objects.appointments.write',
    'crm.objects.carts.read',
    'crm.objects.carts.write',
    'crm.objects.commercepayments.read',
    'crm.objects.commercepayments.write',
    'crm.objects.companies.read',
    'crm.objects.companies.write',
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.courses.read',
    'crm.objects.courses.write',
    'crm.objects.custom.read',
    'crm.objects.custom.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
    'crm.objects.goals.read',
    'crm.objects.goals.write',
    'crm.objects.invoices.read',
    'crm.objects.invoices.write',
    'crm.objects.leads.read',
    'crm.objects.leads.write',
    'crm.objects.line_items.read',
    'crm.objects.line_items.write',
    'crm.objects.listings.read',
    'crm.objects.listings.write',
    'crm.objects.marketing_events.read',
    'crm.objects.marketing_events.write',
    'crm.objects.orders.read',
    'crm.objects.owners.read',
    'crm.objects.partner-clients.read',
    'crm.objects.partner-clients.write',
    'crm.objects.partner-services.read',
    'crm.objects.partner-services.write',
    'crm.objects.products.read',
    'crm.objects.products.write',
    'crm.objects.projects.read',
    'crm.objects.projects.write',
    'crm.objects.quotes.read',
    'crm.objects.quotes.write',
    'crm.objects.services.read',
    'crm.objects.services.write',
    'crm.objects.subscriptions.read',
    'crm.objects.subscriptions.write',
    'crm.objects.users.read',
    'crm.objects.users.write',
    'crm.schemas.appointments.read',
    'crm.schemas.appointments.write',
    'crm.schemas.carts.read',
    'crm.schemas.carts.write',
    'crm.schemas.commercepayments.read',
    'crm.schemas.commercepayments.write',
    'crm.schemas.companies.read',
    'crm.schemas.companies.write',
    'crm.schemas.contacts.read',
    'crm.schemas.contacts.write',
    'crm.schemas.courses.read',
    'crm.schemas.courses.write',
    'crm.schemas.custom.read',
    'crm.schemas.deals.read',
    'crm.schemas.deals.write',
    'crm.schemas.invoices.read',
    'crm.schemas.invoices.write',
    'crm.schemas.line_items.read',
    'crm.schemas.listings.read',
    'crm.schemas.listings.write',
    'crm.schemas.orders.read',
    'crm.schemas.orders.write',
    'crm.schemas.projects.read',
    'crm.schemas.projects.write',
    'crm.schemas.quotes.read',
    'crm.schemas.services.read',
    'crm.schemas.services.write',
    'crm.schemas.subscriptions.read',
    'crm.schemas.subscriptions.write',
    'ctas.read',
    'e-commerce',
    'external_integrations.forms.access',
    'files',
    'files.ui_hidden.read',
    'forms',
    'forms-uploaded-files',
    'hubdb',
    'integration-sync',
    'integrations.zoom-app.playbooks.read',
    'marketing-email',
    'marketing.campaigns.read',
    'marketing.campaigns.revenue.read',
    'marketing.campaigns.write',
    'media_bridge.read',
    'media_bridge.write',
    'oauth',
    'record_images.signed_urls.read',
    'sales-email-read',
    'scheduler.meetings.meeting-link.read',
    'settings.billing.write',
    'settings.currencies.read',
    'settings.currencies.write',
    'settings.users.read',
    'settings.users.teams.read',
    'settings.users.teams.write',
    'settings.users.write',
    'social',
    'tax_rates.read',
    'tickets',
    'timeline',
    'transactional-email'
  ];
  
  res.json({
    clientId: HUBSPOT_CLIENT_ID,
    redirectUri: getAppUrl(),
    hasGemini: !!GEMINI_API_KEY,
    scopes: scopes
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check responding...');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    distAvailable: distExists,
    configured: true
  });
  console.log('Health check response sent');
});

// ============================================================
// OAuth Endpoints
// ============================================================

// Exchange authorization code for tokens
app.post('/api/oauth/token', async (req, res) => {
  const { code, redirect_uri } = req.body;
  
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      redirect_uri: redirect_uri || getAppUrl(),
      code
    });
    
    const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('OAuth error:', data);
      return res.status(response.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// Refresh access token
app.post('/api/oauth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token
    });
    
    const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ============================================================
// HubSpot API Proxy
// ============================================================
app.all('/api/hubspot/*', async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  const hubspotPath = req.path.replace('/api/hubspot', '');
  
  try {
    const options = {
      method: req.method,
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }
    
    const data = await hubspotRequest(hubspotPath, token, options);
    res.json(data);
  } catch (error) {
    console.error(`HubSpot API error for ${hubspotPath}:`, error);
    res.status(error.status || 500).json(error.error || { error: 'HubSpot API request failed' });
  }
});

// ============================================================
// MCP-Style Tool Endpoints
// ============================================================

// Validate connection / Get user details
app.get('/api/tools/get-user-details', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const data = await hubspotRequest('/integrations/v1/me', token);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// List workflows
app.get('/api/tools/list-workflows', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest('/automation/v4/flows', token);
    console.log('Workflow API response:', JSON.stringify(data).substring(0, 500));
    // Normalize response - v4 API returns { flows: [...] }
    res.json({ 
      workflows: data.flows || data.results || [],
      total: data.total || (data.flows?.length) || 0
    });
  } catch (error) {
    console.error('Workflow fetch error:', error);
    res.status(error.status || 500).json(error.error || { error: 'Failed to list workflows' });
  }
});

// Get workflow details
app.get('/api/tools/get-workflow/:id', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest(`/automation/v4/flows/${req.params.id}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: 'Failed to get workflow' });
  }
});

// List sequences (v3 API)
app.get('/api/tools/list-sequences', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    // Try v3 sequences API first
    const data = await hubspotRequest('/automation/v3/sequences', token);
    console.log('Sequences API response:', JSON.stringify(data).substring(0, 500));
    res.json({
      sequences: data.results || data.sequences || [],
      total: data.total || (data.results?.length) || 0
    });
  } catch (error) {
    console.error('Sequences fetch error:', error);
    // Return empty array instead of error for graceful degradation
    res.json({ sequences: [], total: 0, error: error.message });
  }
});

// List marketing campaigns
app.get('/api/tools/list-campaigns', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest('/marketing/v3/campaigns', token);
    console.log('Campaigns API response:', JSON.stringify(data).substring(0, 500));
    res.json({
      campaigns: data.results || data.campaigns || [],
      total: data.total || (data.results?.length) || 0
    });
  } catch (error) {
    console.error('Campaigns fetch error:', error);
    res.json({ campaigns: [], total: 0, error: error.message });
  }
});

// List objects (contacts, companies, deals, etc.)
app.get('/api/tools/list-objects/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const { objectType } = req.params;
  const { limit = 10, after, properties } = req.query;
  
  try {
    let endpoint = `/crm/v3/objects/${objectType}?limit=${limit}`;
    if (after) endpoint += `&after=${after}`;
    if (properties) endpoint += `&properties=${properties}`;
    
    const data = await hubspotRequest(endpoint, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: `Failed to list ${objectType}` });
  }
});

// Search objects
app.post('/api/tools/search-objects/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/search`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: `Failed to search ${objectType}` });
  }
});

// List properties
app.get('/api/tools/list-properties/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${req.params.objectType}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: 'Failed to list properties' });
  }
});

// Get schemas
app.get('/api/tools/get-schemas', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest('/crm/v3/schemas', token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: 'Failed to get schemas' });
  }
});

// ============================================================
// AI Endpoints (Server-side Gemini calls)
// ============================================================

const PT_BIZ_SYSTEM_INSTRUCTION = `
You are the "HubSpot AI Optimizer" for PT Biz employees. You have EXPERT-LEVEL knowledge of HubSpot's platform.

**ABOUT PT BIZ:**
PT Biz is a coaching company that helps Physical Therapy clinic owners grow their practices.
- **Our Customers:** PT clinic owners who buy our coaching programs
- **Our Goal:** Convert leads (PT owners) into coaching clients, retain them, and drive referrals
- **Our Sales Process:** Discovery calls → Coaching enrollment → Ongoing success management

**PT BIZ DOMAIN KNOWLEDGE:**
- **Key Metrics:** Discovery Call booking rate, Coaching enrollment rate, Client retention, NPS, Referral rate
- **Lead Sources:** Webinars, podcasts, referrals, paid ads targeting PT owners
- **Sales Sequences:** Nurture PT owners toward booking discovery calls
- **Lifecycle:** Lead → Discovery Call Booked → Coaching Client → Renewal/Referral
- **Ideal Customer Profile:** PT clinic owners doing $500K-$2M revenue, want to scale or exit operations

**HUBSPOT PLATFORM EXPERTISE:**
You have deep knowledge of HubSpot's AI-powered customer platform:

**Hubs & Pricing:**
- Smart CRM: Contact/deal management, tasks, reporting. Free to $75/seat Enterprise. Custom objects, AI summaries, duplicate management at Enterprise.
- Marketing Hub: Campaigns, personalization, SEO, analytics. Multi-touch attribution, AI search optimization (AEO), customer journey analytics.
- Sales Hub: Prospecting, pipeline management, CPQ, conversation intelligence. AI outreach, forecasting, custom scoring.
- Service Hub: Ticketing, omni-channel support, health scores, surveys. Skill-based routing, AI agents, journey analytics.
- Content Hub: Website building, content repurposing, podcast creation, SEO. Multi-site management, AI Remix.
- Operations Hub: Data sync (100+ bidirectional), cleaning, datasets. Data warehouse connections, AI datasets.
- Commerce Hub: Payments, quotes, subscriptions.

**Backend Architecture (for context):**
- Cloud-native on AWS with 3,000+ microservices
- Java for core APIs (REST/GraphQL), Python for data processing, React frontend
- MySQL for structured data, NoSQL (MongoDB) for unstructured
- Kafka for event-driven processing
- Security: SOC 2 Type II, ISO 27001, GDPR tools, encryption, MFA

**Key HubSpot Features to Leverage:**
- **Workflows:** Branching logic, delays, if/then, goal criteria. Use for lead nurture, no-show follow-up, renewal reminders.
- **Sequences:** Sales outreach automation with tasks + emails. Best for 1:1 sales rep follow-up.
- **Lead Scoring:** Behavioral + demographic scoring. Prioritize high-revenue clinic owners.
- **Custom Properties:** Create fields like clinic_revenue, coaching_program, discovery_call_date.
- **Custom Objects (Enterprise):** For complex data like coaching sessions, milestones.
- **Lists:** Active (real-time) vs Static. Use active for segments, static for campaigns.
- **Deals & Pipelines:** Stages like Discovery Scheduled, Proposal Sent, Enrolled, Renewal Due.
- **Reporting:** Custom dashboards, attribution reports, funnel analytics.

**Breeze AI Tools:**
- Breeze Copilot: AI assistant for CRM tasks, email drafting, record summaries
- Breeze Agents: Social Agent, Customer Agent, Content Agent, Prospecting Agent
- Content Remix: Repurpose one asset into many formats
- AI Prospecting: Automated outreach with personalization
- Custom Workflow Actions: Build with \`hs project add --features=workflow-action-tool\`

**HubSpot Best Practices:**
- Keep data clean: Use Operations Hub for deduplication and formatting
- Automate repetitive: Lead rotation, task creation, email validation
- Personalize at scale: Smart content, tokens, AI-generated copy
- Track ROI: Multi-touch attribution, closed-loop reporting
- Integrate: 1,900+ Marketplace apps, webhooks for real-time sync

**ARCHITECTURE: MODEL CONTEXT PROTOCOL (MCP)**
You are operating within an MCP architecture. You have access to "Tools" that can fetch real data from the HubSpot portal.
- **DO NOT** hallucinate workflow names or data properties if you haven't fetched them yet.
- **DO** use the toolCalls field to request data when the user asks for an audit, check, or list.
- **Tools Available:**
  1. list_workflows: Use this to check automation health.
  2. audit_data_schema: Use this to check data model cleanliness.
  3. list_sequences: Use this for sales outreach analysis.
  4. get_breeze_tools: Use this to see existing custom tools.

**Behavior:**
- If the user asks for data that lives in the portal (workflows, properties, sequences), USE A TOOL CALL.
- Do not act like you know the data unless you have called the tool.
- If the user asks to "Create" or "Draft" something new, use the 'action' field to open the modal.
- When suggesting optimizations, reference specific HubSpot features and explain WHY they help PT Biz.
- Tone: Tactical, direct, authoritative. You're a HubSpot expert helping PT Biz employees optimize their sales & marketing.
`;

// AI: Generate Optimization
app.post('/api/ai/optimize', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini API key not configured' });
  }

  const { prompt, contextType, contextId } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${PT_BIZ_SYSTEM_INSTRUCTION}

Context Type: ${contextType || 'general'}
Context ID: ${contextId || 'New/General'}
User Request: ${prompt}

Generate a specific optimization or creation plan for this request based on PT Biz best practices.
If contextType is 'breeze_tool', generate a JSON definition suitable for a HubSpot App 'workflow-action-tool'.

Respond with valid JSON matching this schema:
{
  "specType": "workflow_spec" | "sequence_spec" | "property_migration_spec" | "breeze_tool_spec",
  "spec": { "name": "string", "focus": "string", "steps": [], "actions": [] },
  "analysis": "Strategic explanation of WHY this optimization helps a PT business",
  "diff": ["List of specific changes"]
}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(500).json({ error: 'AI generation failed', details: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    res.json(JSON.parse(text));
  } catch (error) {
    console.error('AI Optimize Error:', error);
    res.status(500).json({ 
      specType: 'workflow_spec',
      spec: { name: 'Error Fallback' },
      analysis: 'I encountered an error while processing your request. Please try again.',
      diff: ['Retry Request']
    });
  }
});

// AI: Chat Response
app.post('/api/ai/chat', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini API key not configured' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${PT_BIZ_SYSTEM_INSTRUCTION}

User Message: ${message}

Respond with valid JSON matching this schema:
{
  "text": "Conversational response to the user",
  "suggestions": ["3-4 short follow-up options"],
  "toolCalls": [{"name": "tool_name", "arguments": {}}],
  "action": {"type": "OPEN_MODAL", "payload": {"contextType": "workflow", "initialPrompt": ""}}
}

Only include toolCalls if the user asks to audit/check existing portal data.
Only include action if the user asks to create/draft something new.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(500).json({ error: 'AI chat failed', details: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    res.json(JSON.parse(text));
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      text: "I'm having trouble connecting right now. Please try again.",
      suggestions: ["Retry"]
    });
  }
});

// ============================================================
// Catch-all: Serve React app for client-side routing
// ============================================================
app.get('*', (req, res) => {
  // Skip API routes that weren't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(__dirname, '../dist/index.html');
  
  // Check if the file exists before trying to serve it
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    return res.status(500).json({ 
      error: 'Application not built',
      path: indexPath,
      distExists: fs.existsSync(path.join(__dirname, '../dist'))
    });
  }
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading app');
    }
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Start server - bind to 0.0.0.0 for container environments
const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 HubSpot AI Optimizer running on ${HOST}:${PORT}`);
  console.log(`   App URL: ${getAppUrl()}`);
  console.log(`   HubSpot App: ${HUBSPOT_CLIENT_ID ? 'Configured ✓' : 'Missing CLIENT_ID ✗'}`);
  console.log(`   Gemini AI: ${GEMINI_API_KEY ? 'Configured ✓' : 'Not configured'}`);
  
  // Check if dist folder exists
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    console.log('   Static files: Found ✓');
  } else {
    console.log('   Static files: Missing ✗ - dist folder not found at', distPath);
  }
});

// Keep server running and log every 30 seconds
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Server still running on port ${PORT}`);
}, 30000);

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

server.on('close', () => {
  console.log('Server closed');
});
