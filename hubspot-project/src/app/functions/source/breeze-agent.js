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
  
  // NOTE: In production, this node could fetch from your /api/ai endpoint or run internal logic.
  return {
    statusCode: 200,
    body: {
        outputFields: {
          recommendation: `Breeze Agent Standby for ${objectType} ${objectId}. Requesting Real-Time Optimization for: "${prompt.substring(0, 50)}..."`,
          confidenceScore: baseScore
        }
    }
  };
};
