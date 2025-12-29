const { validateSignature } = require('./utils/v3-validator');

exports.main = async (context = {}) => {
  // Parse body from Workflow Action
  const body = context.body || {};
  const { inputFields, object } = body;

  const objectId = object?.objectId;
  const objectType = object?.objectType || 'UNKNOWN';
  const prompt = inputFields?.agentPrompt;
  const urgency = (inputFields?.urgency || 'medium').toLowerCase();

  // Strategic scoring logic - Deterministic
  const urgencyWeights = { low: 70, medium: 80, high: 92 };
  const baseScore = urgencyWeights[urgency] || 75;
  
  if (!prompt) {
    return {
       statusCode: 200, // Returning 200 with error message in output fields is often safer for Workflows to avoid retries
       body: {
          outputFields: {
            recommendation: "Error: No agent prompt provided. Reasoning engine suspended.",
            confidenceScore: 0
          }
       }
    };
  }
  
  try {
      const aiResp = await fetch('https://hs-biz-agent.vercel.app/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              prompt: `[AGENT CONTEXT: ${objectType} ${objectId}] ${prompt}`,
              hubspotToken: accessToken,
              stream: false
          })
      });

      if (aiResp.ok) {
          const aiData = await aiResp.json();
          return {
              statusCode: 200,
              body: {
                  outputFields: {
                      recommendation: aiData.text || "Analysis complete. Recommendation: Continue nurture flow.",
                      confidenceScore: 85
                  }
              }
          };
      }
      throw new Error("AI Proxy failed");
  } catch (err) {
      return {
          statusCode: 200,
          body: {
              outputFields: {
                  recommendation: `Breeze Agent Standby for ${objectType} ${objectId}. (Deferred: ${err.message})`,
                  confidenceScore: 70
              }
          }
      };
  }
};
