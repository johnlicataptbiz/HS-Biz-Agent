import 'dotenv/config';

const DEFAULT_BASE = process.env.BREEZE_BASE_URL || 'https://api.hubapi.com';
const AGENT_ID = process.env.BREEZE_AGENT_ID || '';

export async function runAgentWithUserToken(userAccessToken, { prompt, context = {}, dryRun = true }) {
  if (!AGENT_ID) {
    return { ok: false, status: 501, error: 'Breeze agent not configured' };
  }

  // NOTE: Endpoint path is a placeholder. Update to match HubSpot Breeze API once available.
  const url = `${DEFAULT_BASE}/ai/agents/v1/agents/${encodeURIComponent(AGENT_ID)}/runs`;
  const body = {
    input: prompt,
    context,
    dryRun
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

export async function upsertKnowledgeDoc(userAccessToken, { title, text, tags = [] }) {
  // NOTE: Endpoint path is a placeholder. Update to match Knowledge Vault API once available.
  const url = `${DEFAULT_BASE}/ai/knowledge/v1/documents`;
  const body = { title, text, tags };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

