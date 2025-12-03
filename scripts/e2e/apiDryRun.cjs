/* eslint-disable no-console */
const fetch = require('node-fetch');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const TOKEN = process.env.E2E_JWT || '';

async function main() {
  if (!TOKEN) throw new Error('Set E2E_JWT to a valid user JWT');
  // Preview (allowed to members)
  let resp = await fetch(`${BASE}/api/actions/workflows/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ workflowId: '12345', updates: { name: 'New Name (dry-run)' } })
  });
  console.log('preview status:', resp.status);
  console.log('preview body:', await resp.text());

  // Execute (should be 403 for members)
  resp = await fetch(`${BASE}/api/actions/workflows/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ workflowId: '12345', updates: { name: 'New Name' } })
  });
  console.log('execute status:', resp.status);
  console.log('execute body:', await resp.text());
}

main().catch((e) => { console.error(e); process.exit(1); });

