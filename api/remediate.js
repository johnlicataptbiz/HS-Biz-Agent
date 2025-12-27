export default async function handler(req, res) {
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

    // 2. CONSOLIDATE LISTS (Placeholder for sequence of moves)
    if (action === 'merge-lists') {
        return res.status(501).json({ 
            success: false, 
            error: 'Consolidation logic (merge-lists) is not yet implemented for production. Please use HubSpot UI.' 
        });
    }

    // 3. PAUSE GHOST WORKFLOWS (Consolidated from cleanup.js)
    if (action === 'pause-ghosts') {
        const { workflowIds } = payload;
        const results = await Promise.all((workflowIds || []).map(async (id) => {
            const resp = await fetch(`https://api.hubapi.com/automation/v3/workflows/${id}?action=pause`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${hubspotToken}` }
            });
            return { id, success: resp.ok };
        }));

        return res.status(200).json({ 
            success: true, 
            processed: results.filter(r => r.success).length,
            totalFound: workflowIds.length
        });
    }

    return res.status(404).json({ error: 'Remediation node not found' });

  } catch (error) {
    console.error("Remediation Engine Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
