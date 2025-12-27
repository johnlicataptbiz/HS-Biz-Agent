# Task: Gemini & HubSpot Alignment

## Status
**Phase**: Planning / Evaluation
**Current Goal**: Evaluate `hubspot-project` against Gemini Best Practices and create an upgrade plan.

## To-Do List
- [x] Fix HubSpot Scopes & Deploy "Base" Version.
- [x] Create `gemini_alignment_audit.md` (Audit Artifact).
- [x] Review `gemini_alignment_audit.md` with User.
- [x] Determine Bundling Strategy for `@google/genai`.
- [x] **Phase 2 Execution**: Upgrade `vibe-check.js` to use Gemini API.
- [ ] **Phase 3**: Project Evaluation & Longevity Analysis.

## Blockers
- **Secrets**: User needs to add `GEMINI_API_KEY` to HubSpot Secrets.
- **Bundling**: HubSpot serverless functions don't run `npm install`. We need a build step (webpack/esbuild) to package the Gemini SDK.

## Context
User has designated `Gemini-API-Documentation-Overview.md` as a secondary Source of Truth.
HubSpot Project is currently successfully deployed but lacks "Real AI".
