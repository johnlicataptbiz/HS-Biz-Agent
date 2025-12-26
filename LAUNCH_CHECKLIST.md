# 🚀 Launch Checklist: HubSpot AI Optimizer (Vercel Free Domain)

This document tracks the final steps required to deploy **HubSpot AI Optimizer** to your free Vercel domain.

## 1. Hosting (Vercel)

- [ ] **Deploy Project**: Push this code to a GitHub repository and import it into Vercel.
- [ ] **Identifying your Domain**: Once deployed, Vercel will assign you a URL like `hubspot-ai-optimizer.vercel.app`. Note this exact URL.

## 2. HubSpot Developer App Configuration (CRITICAL)

- [ ] **Update Redirect URLs**:
  - Log in to the [HubSpot Developer Portal](https://developers.hubspot.com/).
  - Open your App > **Auth**.
  - Add your Vercel URL (e.g., `https://hubspot-ai-optimizer.vercel.app`) to the **Redirect URLs** list.
  - *Note: If you don't do this, the login/connection will fail.*

## 3. Production Environment Variables

- [ ] **Vercel Env Vars**: Add the following in the Vercel Dashboard (Settings > Environment Variables):
  - `GEMINI_API_KEY`: Your live production API key from Google AI Studio.
  - `HUBSPOT_CLIENT_ID`: `7e3c1887-4c26-47a8-b750-9f215ed818f1` (Standard App)
  - `HUBSPOT_CLIENT_SECRET`: [Your Standard App Secret]
  - `HUBSPOT_MCP_CLIENT_SECRET`: [Your MCP App Secret]
  - `VITE_HUBSPOT_CLIENT_ID`: `7e3c1887-4c26-47a8-b750-9f215ed818f1` (Used for frontend)

## 4. Final Production Smoke Test

- [ ] **Deployment Build**: The build command is `npm run build` and the output directory is `dist`.
- [ ] **OAuth Flow**: Verify that the "Connect HubSpot" popup opens, authenticates, and redirects correctly to the `.vercel.app` domain.
- [ ] **Live Data Fetching**: Verify that Workflow and Sequence data populates correctly from a real HubSpot portal.

---

### Created by Antigravity AI Assistant - 2025
