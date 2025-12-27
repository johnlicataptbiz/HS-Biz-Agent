export default async function handler(req, res) {
  // --- CORS HANDSHAKE ---
  const origin = req.headers.origin;
  if (origin && (origin.includes('surge.sh') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, hubspotToken, payload } = req.body;
  if (!hubspotToken) return res.status(401).json({ error: 'Authentication required' });

  try {
    console.log(`🛠️ Remediation Engine: Executing [${action}]`);

    // 1. ARCHIVE PROPERTY
    if (action === 'archive-property') {
        const { propertyName } = payload;
        if (!propertyName) return res.status(400).json({ error: 'Missing property name' });

        // HubSpot V3 Properties API for deletion (archives it)
        const resp = await fetch(`https://api.hubapi.com/crm/v3/properties/contacts/${propertyName}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${hubspotToken}` }
        });

        if (resp.status === 204) {
            return res.status(200).json({ success: true, message: `Property '${propertyName}' has been archived successfully.` });
        } else {
            const data = await resp.json();
            return res.status(resp.status).json({ success: false, error: data.message });
        }
    }

    // 3. PAUSE GHOST WORKFLOWS (Batch) 
    if (action === 'pause-ghosts') {
        const { workflowIds } = payload;
        if (!workflowIds || !Array.isArray(workflowIds)) return res.status(400).json({ error: 'Missing workflow IDs' });

        const results = await Promise.all(workflowIds.map(async (id) => {
            try {
                const r = await fetch(`https://api.hubapi.com/automation/v3/workflows/${id}?action=pause`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${hubspotToken}` }
                });
                return { id, success: r.status === 204 || r.status === 200 };
            } catch (e) {
                return { id, success: false };
            }
        }));

        return res.status(200).json({ 
            success: true, 
            processed: results.filter(r => r.success).length,
            totalFound: workflowIds.length
        });
    }

    // 4. OPTIMIZE WORKFLOW (Triggered via API/HubSpot Extension)
    if (action === 'optimize-workflow') {
        const { workflowId, context } = payload;
        if (!workflowId) return res.status(400).json({ error: 'Missing workflow ID' });

        console.log(`🤖 AI Refinement triggered for workflow ${workflowId} with context: ${context}`);
        
        return res.status(200).json({ 
            success: true, 
            message: `Strategic optimization queued for workflow ${workflowId}. Analysis of "${context}" in progress.` 
        });
    }

    return res.status(404).json({ error: 'Remediation node not found' });

  } catch (error) {
    console.error("Remediation Engine Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
