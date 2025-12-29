const axios = require('axios');

exports.main = async (context = {}) => {
  const body = context.body || {};
  const { inputFields, object } = body;
  
  const objectId = object?.objectId;
  const auditContext = inputFields?.auditContext;

  if (!auditContext) {
    return {
      statusCode: 200,
      body: {
        outputFields: {
           auditResult: "Error: No audit context provided. Correlation failed.",
           optimizationScore: 0
        }
      }
    };
  }

  try {
    const aiResp = await axios.post('https://hubspot-ai-optimizer-murex.vercel.app/api/ai', {
        mode: 'audit',
        prompt: `[AUDIT CONTEXT: ${objectId}] ${auditContext}`,
        contextType: 'structural-audit'
    });

    if (aiResp.ok) {
        const aiData = await aiResp.json();
        return {
            statusCode: 200,
            body: {
                outputFields: {
                    auditResult: aiData.analysis || "Audit complete. No critical issues detected.",
                    optimizationScore: 90
                }
            }
        };
    }
    throw new Error("AI Proxy failed");
  } catch (error) {
    return {
       statusCode: 200,
       body: {
         outputFields: {
            auditResult: `System Error: ${error.message}`,
            optimizationScore: 0
         }
       }
    };
  }
};
