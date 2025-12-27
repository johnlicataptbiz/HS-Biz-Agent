# Gemini & HubSpot AI Alignment Audit

## Executive Summary
This document evaluates the current state of the `hubspot-project` against the **HubSpot Developer Platform Source of Truth** and the **Gemini API Technical Reference**.

**Status**: ⚠️ **Partial Alignment**
The project successfully deploys to HubSpot, but the "AI" components are currently placeholders or use legacy/external patterns. Deep integration with the Gemini ecosystem (as defined in `Gemini-API-Documentation-Overview.md`) is required to achieve the "Agentic" capabilities requested.

---

## 1. HubSpot Architecture Alignment (Foundation)

| Component | Status | Source of Truth Ref | findings |
| :--- | :--- | :--- | :--- |
| **Directory Structure** | ✅ **Aligned** | Section 1.1.1 | Correctly uses `src/app/cards`, `src/app/functions`, `src/app/app-hsmeta.json`. |
| **Manifests** | ✅ **Aligned** | Section 1.1 | All manifests renamed to `*-hsmeta.json` and syntax validated. |
| **Scopes** | ✅ **Aligned** | Section 3.2 | Scopes in `hubspot-ai-optimizer-hsmeta.json` were reverted to standard scopes to pass build (temporary compromise, moving to granular is a future goal). |
| **Serverless Config** | ⚠️ **Misaligned** | Section 7.3 | Build Warning: `serverless.json` is ignored in platform `2025.2`. **Action Required**: Verify if functions work or if config must move to `hsproject.json` or `app.json`. coverage. |
| **Secrets** | ⚠️ **Pending** | Section 7.3 | User needs to manually add `PRIVATE_APP_ACCESS_TOKEN`, `GOOGLE_SEARCH_KEY`, `GOOGLE_CX`, and **`GEMINI_API_KEY`**. |

---

## 2. Gemini Ecosystem Alignment (Intelligence)

The current codebase uses basic heuristic logic (if/else statements) in `vibe-check.js` and `audit-tool.js`. The goal is to replace this with the **Gemini 2.5/3.0** ecosystem.

### 2.1 Model Selection & SDK
*   **Current State**: No AI SDK installed in `hubspot-project`. `vibe-check.js` is pure JS logic.
*   **Gemini Best Practice** (Section 2.2): Use **Gemini 2.5 Flash** for high-volume, low-latency tasks like "Vibe Checks".
*   **Gemini Best Practice** (Section 8.1): Use the new `google-genai` (Node.js `@google/genai`) SDK.
*   **Action**:
    1.  Add `@google/genai` to `package.json` (requires checking if HubSpot Serverless supports npm dependencies—**Critical Check**: HubSpot Serverless allows extensive dependencies, but package size limits apply).
    2.  Set `GEMINI_API_KEY` as a HubSpot Secret.

### 2.2 System Instructions (Persona)
*   **Current State**: Hardcoded "Strategic Advisor" string in React frontend (previous Vercel implementation).
*   **Gemini Best Practice** (Section 6.1): Define immutable system instructions ("Constitution") in the API call.
*   **Action**: Define a rigorous System Instruction for the Lead Analyst Persona:
    > "You are Antigravity, a ruthless Private Equity Analyst. You evaluate HubSpot contacts for ROI potential. You do not be polite; you be precise."

### 2.3 Structured Outputs (JSON Mode)
*   **Current State**: `vibe-check.js` returns a hardcoded object.
*   **Gemini Best Practice** (Section 6.2): Use `response_json_schema` to strictly enforce the output format.
*   **Action**: Define the `VibeCheckSchema` using OpenAPI 3.0 standard within the serverless function to guarantee the Frontend (React card) never breaks.

### 2.4 Grounding & Tool Use
*   **Current State**: `enrich.js` manually calls Google Custom Search.
*   **Gemini Best Practice** (Section 4.3): Use **Grounding with Google Search** directly in the model call to verify facts, OR use **Function Calling** (Section 4.1) to let the Agent decide *when* to search.
*   **Action**:
    *   **Phase 1**: Keep manual `enrich.js` for deterministic control.
    *   **Phase 2**: Upgrade `breeze-agent.js` to use "Tool Use" where it can call `enrich.js` as a tool.

---

## 3. Implementation Plan (Phase 2)

### Step 1: dependencies
- [ ] Create `src/app/functions/package.json` (if supported) or bundle dependencies using webpack/rollup if HubSpot doesn't auto-install.
- [ ] *Correction*: HubSpot Serverless Runtimes **do not** support `npm install` at runtime. We must **bundle** the `@google/genai` SDK into the single JS file or `node_modules` folder before upload.
    - **Strategy**: Use `esbuild` or `webpack` to bundle `vibe-check.js` + `@google/genai` into a single artifact `dist/vibe-check.js`.

### Step 2: `vibe-check.js` Upgrade
- [ ] Import bundled `GoogleGenerativeAI`.
- [ ] Implement `gemini-2.5-flash` model.
- [ ] Paste `System Instructions`.
- [ ] Paste `JSON Schema`.
- [ ] Map `PRIVATE_APP_ACCESS_TOKEN` for CRM data fetching (Context) -> Pass to Gemini (Analysis).

### Step 3: `breeze-agent.js` Upgrade
- [ ] Convert this "Workflow Action" into a true Agent.
- [ ] Give it access to `search` and `crm` tools via Function Calling.

## 4. Verification Checklist
- [ ] `hs secrets list` confirms keys are present.
- [ ] `vibe-check` card displays confident "AI" output, not heuristic scores.
- [ ] Build process handles the bundling of the Google GenAI SDK.
