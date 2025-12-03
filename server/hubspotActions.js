// Direct HubSpot API calls for workflows, sequences, properties
// NOTE: API versions per Nov 2025 guidance
// - Workflows: /automation/v3/workflows
// - Sequences (beta): /automation/v4/sequences
// - Properties: /crm/v3/properties/{objectType}

import 'dotenv/config';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

async function hsRequest(path, token, init = {}) {
  const resp = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data?.message || `HubSpot API error: ${resp.status}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------------- Workflows (v3) ----------------
export async function getWorkflow(token, workflowId) {
  return hsRequest(`/automation/v3/workflows/${encodeURIComponent(workflowId)}`, token);
}

export async function listWorkflows(token, params = {}) {
  const usp = new URLSearchParams();
  if (params.limit) usp.set('limit', String(params.limit));
  if (params.after) usp.set('after', params.after);
  const qs = usp.toString() ? `?${usp.toString()}` : '';
  return hsRequest(`/automation/v3/workflows${qs}`, token);
}

export async function patchWorkflow(token, workflowId, updates) {
  return hsRequest(`/automation/v3/workflows/${encodeURIComponent(workflowId)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function createWorkflow(token, payload) {
  return hsRequest(`/automation/v3/workflows`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// ---------------- Sequences (v4 beta) ----------------
export async function getSequence(token, sequenceId) {
  return hsRequest(`/automation/v4/sequences/${encodeURIComponent(sequenceId)}`, token);
}

export async function listSequences(token, params = {}) {
  const usp = new URLSearchParams();
  if (params.limit) usp.set('limit', String(params.limit));
  if (params.after) usp.set('after', params.after);
  const qs = usp.toString() ? `?${usp.toString()}` : '';
  return hsRequest(`/automation/v4/sequences${qs}`, token);
}

export async function patchSequence(token, sequenceId, updates) {
  return hsRequest(`/automation/v4/sequences/${encodeURIComponent(sequenceId)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function createSequence(token, payload) {
  return hsRequest(`/automation/v4/sequences`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// ---------------- Properties (v3) ----------------
export async function getProperty(token, objectType, propertyName) {
  return hsRequest(`/crm/v3/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(propertyName)}`, token);
}

export async function listProperties(token, objectType) {
  return hsRequest(`/crm/v3/properties/${encodeURIComponent(objectType)}`, token);
}

export async function patchProperty(token, objectType, propertyName, updates) {
  return hsRequest(`/crm/v3/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(propertyName)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function createProperty(token, objectType, payload) {
  return hsRequest(`/crm/v3/properties/${encodeURIComponent(objectType)}`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// ---------------- Lists (segments) ----------------
export async function listStaticLists(token) {
  // Legacy Lists API for segments
  return hsRequest(`/contacts/v1/lists`, token);
}

// ---------------- Diffs ----------------
export function buildPreview(beforeObj, proposedUpdates) {
  // Return a simple preview with before/proposed; diffing can be handled client-side if needed
  const proposed = { ...beforeObj, ...proposedUpdates };
  return { before: beforeObj, proposed };
}

