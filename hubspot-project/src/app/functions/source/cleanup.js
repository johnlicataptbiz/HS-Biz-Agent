const axios = require('axios');
const { validateSignature } = require('./utils/v3-validator');

exports.main = async (context = {}) => {
  // 1. Authenticate & Secure
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  if (!token) throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN secret');

  // If this endpoint is publicly addressable (actionUrl), validate signature or internal token.
  // const inputs = context.body || {}; 
  // if (inputs.actionUrl) validateSignature(context.request, process.env['CLIENT_SECRET']);

  // 2. Parse Inputs
  const inputs = context.body;
  const { action } = inputs;

  console.log(`🧹 Intelligence Engine: Executing [${action}]`);

  try {
    // 1. GHOST WORKFLOWS
    if (action === 'ghost-workflows') {
        const wfResp = await axios.get('https://api.hubapi.com/automation/v3/workflows', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const ghosts = (wfResp.data.workflows || []).filter((w) => w.enabled && (w.contactCounts?.enrolled || 0) === 0);
        
        // Pause first 5
        const results = await Promise.all(ghosts.slice(0, 5).map(async (wf) => {
             return axios.post(`https://api.hubapi.com/automation/v3/workflows/${wf.id}?action=pause`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }));

        return { 
            statusCode: 200,
            body: {
                success: true, 
                message: `Architectural Scan: Paused ${results.length} ghost automations to reduce API clutter.` 
            }
        };
    }

    // 2. STALLED WORKFLOWS
    if (action === 'stalled-workflows') {
         const wfResp = await axios.get('https://api.hubapi.com/automation/v3/workflows', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stalled = (wfResp.data.workflows || []).filter((w) => !w.enabled && (w.contactCounts?.active || 0) > 0);
        
        return { 
            statusCode: 200,
            body: { 
                success: true, 
                message: `System Audit: Identified ${stalled.length} stalled workflows containing active contacts. Recommended manual flush.` 
            }
        };
    }

    // 3. PROPERTY MERGE HEURISTIC (GraphQL Optimization)
    if (action === 'properties') {
        // We use GraphQL schema fetching if possible, or fallback to V3 Property API
        const propResp = await axios.get('https://api.hubapi.com/crm/v3/properties/contacts', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const redundant = (propResp.data.results || []).filter(p => {
             const n = p.name.toLowerCase();
             return n.includes('_old') || n.includes('legacy') || n.includes('deprecated');
        });

        return { 
            statusCode: 200,
            body: { 
                success: true, 
                message: `Data Logic: Found ${redundant.length} legacy fields. Use the 'Property Migrator' tool.` 
            }
        };
    }

    return { statusCode: 404, body: { error: 'Process node not found' } };

  } catch (error) {
    console.error("Intelligence Script Failure:", error);
    return { statusCode: 500, body: { error: error.message } };
  }
}
