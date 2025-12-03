# HubSpot AI Optimizer (SaaS)

![HubSpot AI Optimizer Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

AI-powered optimization engine for HubSpot portals, now supporting multi-user SaaS logins and live HubSpot OAuth connections.

## Features

- 🤖 **AI Co-Pilot Chat** - Gemini-powered conversational interface with MCP-style tool calls
- 📊 **Portal Dashboard** - Real-time health scores for workflows, sequences, and data model
- ⚙️ **Workflow Analysis** - Audit and optimize automation logic
- 📧 **Sequence Builder** - AI-assisted sales sequence creation
- 🗄️ **Data Model Audit** - Identify redundant properties and suggest cleanup
- 🔧 **Breeze Tools** - Custom action definitions for HubSpot Agent Builder
 - 👥 **Multi-User SaaS Auth** - Users register/login to the app, connect their own HubSpot OAuth or PAT, and collaborate on the same portal
 - 🔐 **Secure Token Handling** - HubSpot OAuth/PAT tokens stored server-side per user with auto-refresh
 - 🔀 **Demo vs Live Mode** - Toggle demo data on/off in Settings (per-user)
 - 🧪 **E2E Tests** - Puppeteer script to simulate multi-user flows

## Quick Start

### Prerequisites

- Node.js 18+
- A [Gemini API Key](https://ai.google.dev/)
- HubSpot Developer Account (for OAuth) or Private App Token

### Installation

```bash
npm install
```

### Environment Setup

Copy the example env files:

```bash
cp .env.example .env.local
cp server/.env.example server/.env
```

Add your Gemini API key to `.env.local`:

```text
GEMINI_API_KEY=your-gemini-api-key
VITE_SERVER_URL=http://localhost:8080

Update `server/.env` with your HubSpot OAuth app and secrets:

```
HUBSPOT_CLIENT_ID=your-client-id
HUBSPOT_CLIENT_SECRET=your-client-secret
JWT_SECRET=please-change-me
# Optional: Gemini or OpenAI
GEMINI_API_KEY=your-gemini-api-key
# OPENAI_API_KEY=sk-...
```
```

### Running the App

Start both frontend and backend:

```bash
npm run dev:all
```

Or run them separately:

```bash
# Terminal 1: Backend server (port 8080)
npm run dev:server

# Terminal 2: Frontend (port 3000)
npm run dev
```

### Connecting to HubSpot

#### Option A: OAuth (Recommended)

1. Create an app in your [HubSpot Developer Account](https://developers.hubspot.com/)
2. Add `http://localhost:3000` as a redirect URI
3. Copy Client ID and Secret to the Settings modal in the app
4. Click "Connect" to authorize

#### Option B: Private App Token

1. Create a [Private App](https://knowledge.hubspot.com/integrations/private-apps) in your HubSpot portal
2. Enter the token (starts with `pat-...`) in the Settings modal

You can also enable "Demo Mode" in Settings to visualize without connecting to HubSpot.

## Architecture

```text
Frontend (Vite + React)     Backend (Express)         HubSpot API
       │                          │                        │
       │  ──── API calls ────►    │  ──── Proxy ────►      │
       │                          │                        │
       │  ◄─── JSON response ─── │  ◄─── Response ───     │
```

The Express backend proxies all HubSpot API calls to avoid CORS issues and handles OAuth token exchange.

Authentication and multi-user model:
- Users register/login to the app (JWT stored in localStorage)
- Each user can connect their own HubSpot OAuth/PAT; tokens are stored server-side in SQLite
- All API calls use the logged-in user's token, so multiple team members can collaborate safely

### MCP-Style Tool Endpoints

The backend implements HubSpot MCP server patterns:

| Tool | Endpoint | Description |
|------|----------|-------------|
| List Objects | `GET /api/tools/list-objects/:type` | Paginated list of CRM records |
| Search Objects | `POST /api/tools/search-objects/:type` | Filter-based search |
| Batch Create | `POST /api/tools/batch-create/:type` | Create multiple records |
| Batch Update | `POST /api/tools/batch-update/:type` | Update multiple records |
| List Properties | `GET /api/tools/list-properties/:type` | Object schema properties |
| Create Property | `POST /api/tools/create-property/:type` | Define new property |
| List Associations | `GET /api/tools/list-associations/:from/:id/:to` | Record relationships |
| Create Engagement | `POST /api/tools/create-engagement` | Notes, tasks, etc. |
| List Workflows | `GET /api/tools/list-workflows` | Automation workflows |
| Get Portal Link | `GET /api/tools/get-portal-link` | Generate HubSpot URLs |

### Token Management

- **OAuth tokens** auto-refresh before expiration (5-minute buffer)
- **PAT tokens** don't expire and skip refresh logic
- All API methods call `ensureValidToken()` automatically

## SaaS & Ops

- Roles: server stores `role` per user (`member` by default)
- Usage tracking: POST `/api/usage/track` logs simple events per user
- Security: set `JWT_SECRET` in production and NEVER commit `.env` files

## Railway Deployment

- Service: build with Dockerfile (builds frontend and serves via Express)
- Required env vars (Railway service):
  - `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `JWT_SECRET`
  - `FRONTEND_URL` set to your Railway domain (e.g., https://your-app.up.railway.app)
  - One of `GEMINI_API_KEY` or `OPENAI_API_KEY`
- Optional: `DATABASE_PATH` (defaults to `server/data/app.db`)

### Deploy Steps

1. Set env vars in Railway
2. Deploy using this repo (Dockerfile builds and runs `node server/server.js`)
3. Open the app, register a user, and connect HubSpot from Settings

## E2E Testing (multi-user)

Install dev deps (locally):

```
npm install
```

Run dev servers:

```
npm run dev:all
```

Run the test in a new terminal:

```
# Optional: provide a PAT to test live connection
E2E_BASE_URL=http://localhost:3000 \
E2E_HUBSPOT_PAT=pat-na1-xxxxx \
npm run e2e
```

The test registers two users, opens Settings, connects via PAT if provided (or toggles Demo Mode), and navigates to Workflows/Sequences.

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend only |
| `npm run dev:server` | Start backend only |
| `npm run dev:all` | Start both |
| `npm run build` | Production build |

## License

MIT
