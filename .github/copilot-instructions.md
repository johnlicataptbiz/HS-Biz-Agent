# Copilot Instructions for HS-Biz-Agent

## Absolute Source of Truth
- **Always consult [`HubSpot-Dev-Features-for-AI-Agents.md`](../HubSpot-Dev-Features-for-AI-Agents.md) first.** This file overrides all other documentation and governs architecture, workflows, and debugging.

## Project Architecture
- **Projects are defined by `hsproject.json` (root manifest) and `src/app/hubspot-ai-optimizer-hsmeta.json` (app config).**
- **All functional code and config must reside under the `src/app/` directory.**
- **Custom objects, UI extensions, and serverless functions are defined in subfolders (`app-objects/`, `cards/`, `functions/`).**
- **React components for UI Extensions must use HubSpot's approved SDK and component library.**

## Developer Workflows
- **Local development:**
  - Install dependencies: `npm install`
  - Set `GEMINI_API_KEY` in `.env.local` (not committed)
  - Start app: `npm run dev`
- **HubSpot CLI (`@hubspot/cli`) is required for project operations:**
  - Install globally: `npm install -g @hubspot/cli`
  - Authenticate: `hs auth` (uses Personal Access Key)
  - Switch accounts: `hs accounts use <name>`
  - Run local proxy for UI Extensions: `hs project dev`
  - Deploy: `hs project upload`
- **Configuration changes (e.g., `app-hsmeta.json`) require restarting local proxy.**

## Key Patterns and Conventions
- **Configuration as Code:** All app features, schema, and UI are defined in JSON and React files, not via the web portal.
- **Custom object properties are immutable after creation.** Misspelled keys must be archived and recreated.
- **OAuth 2.0 is mandatory for multi-tenant apps. Redirect URIs must match those in `app-hsmeta.json`.**
- **Granular scopes:** Only request the minimum required scopes in OAuth and config.
- **Webhooks and workflow actions must validate requests using Signature v3.**
- **Secrets (API keys, DB credentials) are managed via CLI and injected at runtime, never committed.**

## Data Access
- **REST API:** Use `/crm/v3/objects/{object}/search` for queries. Hard limit: 5 req/sec/account, 10k results max.
- **GraphQL API:** Use for complex, relational queries. Watch for complexity limits (30,000 points/query).

## UI Extensions
- **Cards are defined in `app/cards/*-hsmeta.json` and registered via SDK.**
- **Use only approved HubSpot React components.**
- **Actions (e.g., `actions.refreshObjectProperties`, `actions.addAlert`) are available via SDK.**

## Automation
- **Custom Workflow Actions:** Defined in JSON, executed via external endpoints. Must respond quickly; use async callbacks for long-running logic.
- **Webhooks:** Subscribe to events, batch notifications, validate payloads.
- **Serverless Functions:** Place logic in `app/functions/`, map endpoints in `serverless.json`.

## Operational Limits
- **API rate limits and association limits are strictly enforced.**
- **GraphQL queries must be paginated if complexity or node limits are exceeded.**

## Support
- For app support, see `support` section in `app-hsmeta.json`.

---
**Example: To add a new CRM card, create a JSON definition in `app/cards/`, implement the React component using the SDK, and register via CLI.**

---
For full details, see [`HubSpot-Dev-Features-for-AI-Agents.md`](../HubSpot-Dev-Features-for-AI-Agents.md).
