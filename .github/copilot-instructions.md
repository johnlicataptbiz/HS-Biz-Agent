# Copilot Instructions for HS-Biz-Agent

## Project Overview

HubSpot AI Optimizer is a React + TypeScript SPA with an Express backend that audits and optimizes HubSpot portals for Physical Therapy (PT) clinics. It uses **Gemini AI** for conversational assistance and implements an **MCP (Model Context Protocol)** pattern for tool-based data fetching.

## Architecture

### Core Layers
```
├── App.tsx                 # Root: routing, global modal state, OAuth callback
├── pages/                  # Feature views (Dashboard, Workflows, Sequences, etc.)
├── components/             # Shared UI (Sidebar, AiChat, AiModal, SettingsModal)
├── services/
│   ├── aiService.ts        # Gemini integration with structured output schemas
│   ├── hubspotService.ts   # Frontend HubSpot client (routes via backend proxy)
│   └── mockService.ts      # Demo data fallback when not connected
├── types.ts                # All TypeScript interfaces
└── server/                 # Express backend (HubSpot API proxy)
    └── index.js            # OAuth proxy + MCP-style tool endpoints
```

### Backend Proxy Pattern
The Express server in `server/` proxies all HubSpot API calls to avoid CORS issues:
- **OAuth endpoints**: `/api/oauth/token`, `/api/oauth/refresh`
- **MCP-style tools**: `/api/tools/list-workflows`, `/api/tools/list-objects/:type`, etc.
- **Generic proxy**: `/api/hubspot/*` for any HubSpot API path

Frontend → Backend Proxy → HubSpot API

### AI Integration Pattern
- **aiService.ts** uses `@google/genai` with JSON schema-constrained responses (`OPTIMIZATION_SCHEMA`, `CHAT_SCHEMA`)
- Two AI modes:
  1. `generateChatResponse()` - Conversational with tool calls (MCP pattern)
  2. `generateOptimization()` - Structured spec generation for workflows/sequences/data/breeze tools
- Tool calls defined in `MCP_TOOLS_DEF` array; AI returns `toolCalls` in response, executed client-side via `AiChat.executeToolCall()`

### Data Flow
1. User sends message → `AiChat` → `generateChatResponse()`
2. AI returns `ChatResponse` with optional `toolCalls[]` or `action`
3. Tool calls trigger `hubSpotService` → Backend proxy → HubSpot API
4. Results displayed inline; `action.type: 'OPEN_MODAL'` triggers `AiModal`

## Development Commands

```bash
npm install              # Install all dependencies (frontend + server)
npm run dev              # Start Vite dev server (port 3000)
npm run dev:server       # Start backend proxy server (port 3001)
npm run dev:all          # Start both frontend and backend
npm run build            # Production build
```

## Environment Configuration

### Frontend (`.env.local`)
```
GEMINI_API_KEY=your-gemini-key
VITE_SERVER_URL=http://localhost:3001
```

### Backend (`server/.env`)
```
FRONTEND_URL=http://localhost:3000
PORT=3001
```

## Key Patterns & Conventions

### Backend Proxy Endpoints
When adding new HubSpot API features, add endpoints to `server/index.js`:
```javascript
app.get('/api/tools/my-new-tool', async (req, res) => {
  const token = getToken(req);
  const data = await hubspotRequest('/crm/v3/...', token);
  res.json(data);
});
```

### AI Schema Pattern
When adding new AI capabilities, follow the existing schema pattern in `aiService.ts`:
```typescript
const MY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { /* ... */ },
  required: ["field1", "field2"]
};
```

### Adding MCP Tools
1. Add tool definition to `MCP_TOOLS_DEF` array in `aiService.ts`
2. Add execution handler in `AiChat.tsx` `executeToolCall()` switch
3. Add backend endpoint in `server/index.js`
4. Add frontend method in `hubspotService.ts`

### Demo/Live Data Toggle
All pages check `hubSpotService.getToken()` to decide data source:
```typescript
const token = hubSpotService.getToken();
if (token) {
  // Fetch from HubSpot via backend proxy
} else {
  // Use mockService fallback
}
```

## HubSpot Integration

### OAuth Flow (PKCE)
1. User clicks "Connect" → `hubSpotService.initiateOAuth()` opens popup
2. User authorizes → Popup redirects with code
3. `App.tsx` catches code via postMessage → calls `exchangeCodeForToken()`
4. Token exchange happens via backend proxy (`/api/oauth/token`)
5. Tokens stored in localStorage

### Authentication Options
- **OAuth PKCE**: Full portal access with user consent
- **Private App Token (PAT)**: Direct entry in Settings modal (`pat-...` prefix)

### Token Refresh
OAuth tokens expire after 30 minutes. The service automatically refreshes tokens:
- `ensureValidToken()` checks expiry and refreshes if needed (5-minute buffer)
- All API methods call this before making requests
- PAT tokens don't expire and skip refresh logic

### Available MCP Tools
The backend exposes these tool endpoints (matching HubSpot's MCP patterns):

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Objects** | `/api/tools/list-objects/:type` | GET | List CRM records with pagination |
| **Objects** | `/api/tools/search-objects/:type` | POST | Search with filters |
| **Objects** | `/api/tools/batch-create/:type` | POST | Batch create records |
| **Objects** | `/api/tools/batch-update/:type` | POST | Batch update records |
| **Objects** | `/api/tools/batch-read/:type` | POST | Batch read by IDs |
| **Properties** | `/api/tools/list-properties/:type` | GET | List object properties |
| **Properties** | `/api/tools/get-property/:type/:name` | GET | Get property details |
| **Properties** | `/api/tools/create-property/:type` | POST | Create property |
| **Properties** | `/api/tools/update-property/:type/:name` | PATCH | Update property |
| **Associations** | `/api/tools/list-associations/:from/:id/:to` | GET | List associations |
| **Associations** | `/api/tools/create-association` | POST | Create association |
| **Associations** | `/api/tools/batch-create-associations/:from/:to` | POST | Batch create |
| **Engagements** | `/api/tools/create-engagement` | POST | Create note/task/etc |
| **Engagements** | `/api/tools/get-engagement/:type/:id` | GET | Get engagement |
| **Engagements** | `/api/tools/update-engagement/:type/:id` | PATCH | Update engagement |
| **Workflows** | `/api/tools/list-workflows` | GET | List workflows |
| **Workflows** | `/api/tools/get-workflow/:id` | GET | Get workflow details |
| **Other** | `/api/tools/get-schemas` | GET | Get custom object schemas |
| **Other** | `/api/tools/get-portal-link` | GET | Generate HubSpot UI URLs |

### Relation to HubSpot's Official MCP Server
HubSpot provides an official MCP server (`@hubspot/mcp-server`) for AI clients. See [HubSpot MCP docs](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-hubspot-mcp-server).

**Key differences from this project:**

| Aspect | This Project | HubSpot MCP Server |
|--------|-------------|-------------------|
| Execution | Browser + Express proxy | Node.js stdio server |
| Auth | OAuth PKCE flow | Private App Access Token |
| AI | Gemini with custom schemas | Any MCP-compatible client |
| Transport | HTTP/JSON | stdio (Model Context Protocol) |

**When adding new tools, consider adopting HubSpot's conventions:**
- Tool naming: `hubspot-list-objects`, `hubspot-search-objects`
- Rich descriptions with `🎯 Purpose:`, `📦 Returns:`, `🧭 Usage Guidance:` sections
- Supported object types: `contacts`, `companies`, `deals`, `tickets`, etc.
- Filter operators: `EQ`, `NEQ`, `LT`, `GT`, `CONTAINS_TOKEN`, `IN`, etc.

## Domain Context

The system prompt in `PT_BIZ_SYSTEM_INSTRUCTION` encodes domain knowledge for PT clinics:
- Focus metrics: Revenue per Visit, NPS, Discovery Call conversion
- Key automations: New Lead Nurture, Reactivation campaigns
- Personas: "Owner-Operator" → "CEO" transformation

When modifying AI behavior, preserve this domain context in the system instruction.

## UI Framework
- **Tailwind CSS** for styling (utility classes inline)
- **Lucide React** for icons
- **Recharts** for data visualization (Dashboard charts)
