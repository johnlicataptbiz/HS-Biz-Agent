# Copilot Instructions for HS-Biz-Agent

## Architecture Overview

React + TypeScript SPA with Express backend that audits HubSpot portals for Physical Therapy clinics using Gemini AI.

```
Frontend (Vite :3000)          Backend (Express :8080)         HubSpot API
     │                               │                              │
     ├─ services/hubspotService.ts ─►├─ /api/tools/* ──────────────►│
     ├─ services/aiService.ts ──────►│  (proxies all HubSpot calls) │
     └─ services/mockService.ts      │                              │
        (fallback when disconnected) │                              │
```

**Key insight:** Two server files exist - `server/server.js` (production, serves static + API) and `server/index.js` (dev, API only). Both use port 8080.

## Development

```bash
npm run dev:all          # Frontend (3000) + Backend (8080) together
npm run dev              # Frontend only
npm run dev:server       # Backend only (uses server/index.js)
npm run build && npm start  # Production mode
```

**Environment:** Copy `.env.example` to `.env.local`. Required: `GEMINI_API_KEY`. The Vite config maps it to `process.env.API_KEY`.

## Current Functionality Status

| Page | Status | Notes |
|------|--------|-------|
| **Dashboard** | ✅ Works | Stat cards are clickable → navigate to relevant pages |
| **Data Model** | ✅ Works | Fetches real properties, shows usage/redundancy |
| **Workflows** | ✅ Works | Uses v4 flows API; "Optimize" pre-fills AI with workflow data |
| **Sequences** | ⚠️ Partial | Depends on sequence permissions; "Optimize" pre-fills context |
| **Breeze Tools** | 🔶 Mock + CLI | Shows `hs project add --features=workflow-action-tool` setup |
| **Co-Pilot** | ✅ Works | Quick actions open AiModal with pre-filled prompts |

## Critical Patterns

### Adding MCP Tools (4-file checklist)
1. `services/aiService.ts` → Add to `MCP_TOOLS_DEF` array with name, description, parameters
2. `components/AiChat.tsx` → Add case in `executeToolCall()` switch
3. `server/index.js` AND `server/server.js` → Add `/api/tools/...` endpoint (keep both in sync!)
4. `services/hubspotService.ts` → Add method that calls `${SERVER_URL}/api/tools/...`

### AI Schema Pattern
All AI responses use `@google/genai` with schema constraints. See `CHAT_SCHEMA` and `OPTIMIZATION_SCHEMA` in `aiService.ts`. New schemas must use `Type.OBJECT/STRING/ARRAY` from the library.

### Demo/Live Data Toggle
All pages check `hubSpotService.getToken()` to switch between live API and `mockService.ts`:
```typescript
const token = hubSpotService.getToken();
const data = token ? await hubSpotService.fetch...() : getMock...();
```

### Server URL Detection (`hubspotService.ts`)
- Production (Railway/Render): uses relative URLs (same origin)
- GitHub Codespaces: replaces port 3000→8080 in origin
- Local: uses `VITE_SERVER_URL` env var or falls back to `localhost:8080`

## HubSpot OAuth

Tokens stored in localStorage. OAuth flow handled in `App.tsx` via `postMessage` between popup and parent window. Token refresh is automatic via `ensureValidToken()` (5-min buffer before 30-min expiry). PAT tokens (`pat-...` prefix) skip refresh logic.

## Domain Context

The AI system prompt (`PT_BIZ_SYSTEM_INSTRUCTION` in `aiService.ts`) encodes PT clinic domain knowledge. When modifying AI behavior, preserve:
- Focus metrics: Revenue per Visit, NPS, Discovery Call conversion
- Key automations: New Lead Nurture, Reactivation campaigns

## Deployment

Uses Docker (`Dockerfile`) or Railway (`railway.json`). Production runs single server on port 8080 serving both static files and API. The `start.sh` script handles Railway-specific startup.

## Common Issues

- **Workflows showing empty:** Check HubSpot app has `automation` scope. API moved from v3 to v4.
- **Server sync:** When adding endpoints, update BOTH `server/index.js` and `server/server.js`.
- **CORS errors:** Backend proxy exists to avoid these - never call HubSpot API directly from frontend.
- **Breeze Tools:** Not exposed via standard HubSpot API. Use CLI: `hs project add --features=workflow-action-tool`
