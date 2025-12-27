const axios = require('axios');

exports.main = async (context = {}) => {
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  if (!token) throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN');

  const { contactId } = context.parameters || {};
  if (!contactId) return { statusCode: 400, body: { error: 'Missing contactId' } };

  try {
    // 1. Fetch Contact Enrollments (Legacy V2 is standard for this specific view)
    const enrollResp = await axios.get(`https://api.hubapi.com/automation/v2/workflows/enrollments/contacts/${contactId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        validateStatus: () => true
    });

    if (enrollResp.status === 404) return { statusCode: 200, body: { workflows: [] } };
    if (enrollResp.status !== 200) return { statusCode: enrollResp.status, body: { error: 'Failed to fetch enrollments' } };

    const enrolledData = enrollResp.data || [];
    if (enrolledData.length === 0) return { statusCode: 200, body: { workflows: [] } };

    // 2. Fetch Workflow Definitions to get Names
    const wfResp = await axios.get('https://api.hubapi.com/automation/v3/workflows', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const wfMap = {};
    if (wfResp.data && wfResp.data.workflows) {
      wfResp.data.workflows.forEach(w => {
        wfMap[w.id] = w.name;
      });
    }

    // 3. Map Results
    const results = enrolledData.map(enrollment => ({
      id: enrollment.workflowId,
      name: wfMap[enrollment.workflowId] || `Workflow ${enrollment.workflowId}`,
      enrolledAt: enrollment.portalEnteredCreatedAt ? new Date(enrollment.portalEnteredCreatedAt).toISOString() : null
    }));

    return { statusCode: 200, body: { workflows: results } };

  } catch (error) {
    console.error('Contact workflows error:', error);
    return { statusCode: 500, body: { error: error.message } };
  }
};
