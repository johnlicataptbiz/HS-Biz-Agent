# Copilot Instructions for HS-Biz-Agent

## Architecture Overview

Multi-tenant React + TypeScript SPA (Vite) with Express backend that audits HubSpot portals using Gemini AI. Built for PT Biz, a coaching company serving Physical Therapy clinic owners.

```
Frontend (Vite :3000)          Backend (Express :8080)         Database (SQLite)
     │                               │                              │
     ├─ AuthContext.tsx ────────────►├─ /api/auth/* ───────────────►│ users table
     ├─ services/authService.ts ────►│                              │ hubspot_connections
     ├─ services/hubspotService.ts ─►├─ /api/tools/* ──────────────►│      ↓
     ├─ services/aiService.ts ──────►├─ /api/ai/* (Gemini)          │  HubSpot API
     └─ services/mockService.ts      │                              │
        (fallback for demo)          └─ server/db.js (SQLite layer) │
```

**Critical Files:**
- `server/db.js` - SQLite database layer for users and HubSpot connections
- `server/index.js` - Dev server (API only, uses `--watch`)
- `server/server.js` - Production (serves static files + API)
- **index.js and server.js MUST stay in sync!**

## Authentication Flow

1. User registers/logs in via `AuthPage.tsx` → `/api/auth/register` or `/api/auth/login`
2. Server creates JWT token stored in localStorage
3. All API calls include JWT in Authorization header via `authService.apiRequest()`
4. HubSpot OAuth tokens stored server-side in SQLite per user
5. `db.authMiddleware` validates JWT on protected routes

## Quick Start

```bash
npm run dev:all          # Frontend (3000) + Backend (8080) together
npm run dev:server       # Backend only (uses server/index.js with --watch)
npm run build && npm start  # Production mode (server/server.js)
```

**Environment Setup:**
1. Copy `.env.example` → `.env.local` (root) - needs `GEMINI_API_KEY`
2. Copy `server/.env.example` → `server/.env` - needs:
   - `HUBSPOT_CLIENT_ID`
   - `HUBSPOT_CLIENT_SECRET`
   - `JWT_SECRET` (optional, defaults to random on start)

## Database Schema (SQLite)

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- HubSpot connections (one per user)
CREATE TABLE hubspot_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER,
  portal_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Key Files

| File | Purpose |
|------|---------|
| `server/db.js` | SQLite database operations: createUser, authenticateUser, saveHubSpotConnection, authMiddleware |
| `services/authService.ts` | Frontend auth: login, register, logout, apiRequest (adds JWT to headers) |
| `components/AuthContext.tsx` | React context: user, isLoggedIn, hasHubSpotConnection, login, logout, refreshAuth |
| `pages/AuthPage.tsx` | Login/register form |
| `services/hubspotService.ts` | HubSpot API calls via `authService.apiRequest()` |

## HubSpot MCP Tools

All MCP tool endpoints require authentication via `db.authMiddleware`:

| Tool | Endpoint | Description |
|------|----------|-------------|
| `hubspot_list_objects` | `/api/tools/list-objects/:type` | Paginated CRM records |
| `hubspot_search_objects` | `/api/tools/search-objects/:type` | Filter-based search |
| `hubspot_batch_create` | `/api/tools/batch-create/:type` | Create multiple records |
| `hubspot_batch_update` | `/api/tools/batch-update/:type` | Update multiple records |
| `hubspot_list_properties` | `/api/tools/list-properties/:type` | Object schema properties |
| `hubspot_list_associations` | `/api/tools/list-associations/:from/:id/:to` | Record relationships |
| `hubspot_create_engagement` | `/api/tools/create-engagement` | Notes, tasks, etc. |
| `hubspot_list_workflows` | `/api/tools/list-workflows` | Automation workflows (v4 API) |
| `hubspot_list_sequences` | `/api/tools/list-sequences` | Sales sequences |
| `hubspot_list_campaigns` | `/api/tools/list-campaigns` | Marketing campaigns |
| `hubspot_get_portal_link` | `/api/tools/get-portal-link` | Generate HubSpot URLs |

## Adding New HubSpot Tool Endpoints

When adding a new MCP-style tool:

1. **`server/index.js` AND `server/server.js`** - Add endpoint with auth:
   ```javascript
   app.get('/api/tools/my-endpoint', db.authMiddleware, async (req, res) => {
     const token = await getHubSpotToken(req);
     if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
     const data = await hubspotRequest('/crm/v3/...', token);
     res.json(data);
   });
   ```

2. **`services/hubspotService.ts`** - Add client method:
   ```typescript
   async myEndpoint(): Promise<...> {
     const response = await authService.apiRequest('/api/tools/my-endpoint');
     return response.json();
   }
   ```

3. **`components/AiChat.tsx`** - Add to `executeToolCall()` switch if AI should invoke it

4. **`services/mockService.ts`** - Add mock data for demo mode

## Demo/Live Data Pattern

Pages check `authService.isAuthenticated()` to decide data source:
```typescript
const data = authService.isAuthenticated()
  ? await hubSpotService.fetchWorkflows()
  : await mockService.getWorkflows();
```

## AI Integration

- AI endpoints: `/api/ai/optimize` and `/api/ai/chat`
- System prompt `PT_BIZ_SYSTEM_INSTRUCTION` contains domain knowledge
- AI uses tool calls (`toolCalls` array) to request real data
- Tool calls available: `list_workflows`, `audit_data_schema`, `list_sequences`, `get_breeze_tools`

## Domain Context (PT Biz)

- **Business:** Coaching company for Physical Therapy clinic owners
- **Contacts = PT clinic owners** (prospects or clients)
- **Lifecycle:** Lead → Discovery Call → Coaching Client → Renewal/Referral
- **Metrics:** Discovery Call booking rate, enrollment rate, retention, NPS

## HubSpot API Notes

- **Workflows:** v4 API (`/automation/v4/flows`), returns `{ flows: [...] }`
- **Sequences:** v3 API (`/automation/v3/sequences`)
- **Campaigns:** v3 API (`/marketing/v3/campaigns`)
- **OAuth tokens:** Stored in SQLite, auto-refresh via `getHubSpotToken()`
- **PAT tokens:** Start with `pat-`, no refresh needed
- **Scopes:** Full list in `/api/config` endpoint

## Page Components

Pages in `pages/` directory:
- `AuthPage.tsx` - Login/Register form
- `Dashboard.tsx` - Portal health overview
- `DataModel.tsx` - Property audit and cleanup
- `BreezeTools.tsx` - Custom workflow actions
- `CoPilot.tsx` - Quick action buttons → AI modal
- `Workflows.tsx` - Workflow list with AI optimization
- `Sequences.tsx` - Sequence analysis with reply rates
- `Campaigns.tsx` - Campaign management

## Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | JWT expired or invalid - re-login |
| No HubSpot connection | User hasn't connected HubSpot via Settings |
| Workflows empty | Check HubSpot app has `automation` scope |
| CORS errors | Never call HubSpot API from frontend - use backend proxy |

## Deployment

Production uses `server/server.js` which serves `dist/` static files + API on port 8080.
SQLite database file (`hs_biz.db`) created in `server/` directory.
Supports Railway (`railway.json`), Render, Docker.
