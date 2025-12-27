# Verification Guide

## Lead Magnet data accuracy

This app’s Lead Magnet numbers come from `services/hubspotService.ts` → `HubSpotService.fetchForms()` and are based on HubSpot Forms submission counts.

### Prerequisites

- A valid HubSpot OAuth `access_token` with the `forms` scope (and ideally `business-intelligence`).

### 1) Run the verifier script

Important: treat your HubSpot bearer token as a secret. Avoid pasting it into chat or committing it to files.

```bash
HUBSPOT_ACCESS_TOKEN=... npm run verify:lead-magnets
```

Optional JSON output:

```bash
HUBSPOT_ACCESS_TOKEN=... npm run verify:lead-magnets -- --json
```

Safer option (keeps token out of shell history):

```bash
read -s HUBSPOT_ACCESS_TOKEN && export HUBSPOT_ACCESS_TOKEN
npm run verify:lead-magnets
unset HUBSPOT_ACCESS_TOKEN
```

### 2) Check expected UI behavior

- `pages/Reports.tsx` charts the **top 5 lead magnets with `submissions > 0`**.
- `pages/Campaigns.tsx` shows each detected Lead Magnet’s `Submissions`.

### 3) What “accurate” means here

- If HubSpot has submission history for a form, the verifier should show a non-zero `submissions` count (usually sourced from `analytics/v2` or `forms/v2(deep)`).
- The verifier’s “Top 5 lead magnets” list should match what you see on the **Reports → Top Performing Lead Magnets** chart after reconnecting HubSpot.
