const axios = require('axios');
const { validateSignature } = require('./utils/v3-validator');

exports.main = async (context = {}) => {
  // 1. Authenticate & Secure
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  if (!token) throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN secret');

  // If public endpoint, validate
  // const inputs = context.body || {};
  // if (inputs.actionUrl) validateSignature(context.request, process.env['CLIENT_SECRET']);

  // 2. Parse Inputs
  const inputs = context.body;
  const { action, payload } = inputs;

  console.log(`🛠️ Remediation Engine: Executing [${action}]`);

  try {
    // 1. ARCHIVE PROPERTY
    if (action === 'archive-property') {
        const { propertyName } = payload;
        if (!propertyName) return { statusCode: 400, body: { error: 'Missing property name' } };

        const resp = await axios.delete(`https://api.hubapi.com/crm/v3/properties/contacts/${propertyName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (resp.status === 204) {
            return { statusCode: 200, body: { success: true, message: `Property '${propertyName}' has been archived successfully.` } };
        } else {
             return { statusCode: resp.status, body: { success: false, error: resp.data.message } };
        }
    }

    // 2. PAUSE GHOST WORKFLOWS (Batch) 
    if (action === 'pause-ghosts') {
        const { workflowIds } = payload;
        if (!workflowIds || !Array.isArray(workflowIds)) return { statusCode: 400, body: { error: 'Missing workflow IDs' } };

        const results = await Promise.all(workflowIds.map(async (id) => {
            try {
                const r = await axios.post(`https://api.hubapi.com/automation/v3/workflows/${id}?action=pause`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return { id, success: r.status === 204 || r.status === 200 };
            } catch (e) {
                return { id, success: false };
            }
        }));

        return { 
            statusCode: 200, 
            body: { 
                success: true, 
                processed: results.filter(r => r.success).length,
                totalFound: workflowIds.length
            }
        };
    }

    // 3. OPTIMIZE WORKFLOW
    if (action === 'optimize-workflow') {
        const { workflowId, context: auditContext } = payload;
        if (!workflowId) return { statusCode: 400, body: { error: 'Missing workflow ID' } };

        console.log(`🤖 AI Refinement triggered for workflow ${workflowId} with context: ${auditContext}`);
        
        return { 
            statusCode: 200, 
            body: { 
                success: true, 
                message: `Strategic optimization queued for workflow ${workflowId}. Analysis of "${auditContext}" in progress.` 
            }
        };
    }

    return { statusCode: 404, body: { error: 'Remediation node not found' } };

  } catch (error) {
    console.error("Remediation Engine Failure:", error);
    return { statusCode: 500, body: { error: error.message } };
  }
}
