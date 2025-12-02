# HubSpot AI Optimizer

![HubSpot AI Optimizer Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

AI-powered optimization engine for HubSpot portals, focused on Physical Therapy clinic automation.

## Features

- 🤖 **AI Co-Pilot Chat** - Gemini-powered conversational interface with MCP-style tool calls
- 📊 **Portal Dashboard** - Real-time health scores for workflows, sequences, and data model
- ⚙️ **Workflow Analysis** - Audit and optimize automation logic
- 📧 **Sequence Builder** - AI-assisted sales sequence creation
- 🗄️ **Data Model Audit** - Identify redundant properties and suggest cleanup
- 🔧 **Breeze Tools** - Custom action definitions for HubSpot Agent Builder

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

## Architecture

```text
Frontend (Vite + React)     Backend (Express)         HubSpot API
       │                          │                        │
       │  ──── API calls ────►    │  ──── Proxy ────►      │
       │                          │                        │
       │  ◄─── JSON response ─── │  ◄─── Response ───     │
```

The Express backend proxies all HubSpot API calls to avoid CORS issues and handles OAuth token exchange.

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

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend only |
| `npm run dev:server` | Start backend only |
| `npm run dev:all` | Start both |
| `npm run build` | Production build |

## License

MIT
