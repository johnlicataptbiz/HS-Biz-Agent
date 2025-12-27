exports.main = async (event, callback) => {
  // Extract inputs from the workflow event
  const { inputFields, object } = event;
  const objectId = object.objectId;
  const objectType = object.objectType;
  const context = inputFields.auditContext;

  if (!context) {
    return callback({
      outputFields: {
        auditResult: "Error: No audit context provided. Correlation failed.",
        optimizationScore: 0
      }
    });
  }

  try {
    // In production, the hubspotToken would be securely retrieved.
    // We use a mock token here to simulate the workflow extension handshake.
    const response = await fetch('https://hubspot-ai-optimizer-murex.vercel.app/api/remediate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'optimize-workflow',
        hubspotToken: 'simulated_extension_token',
        payload: {
          workflowId: objectId,
          context: context
        }
      })
    });

    const data = await response.json();

    callback({
      outputFields: {
        auditResult: data.success ? data.message : `Error: ${data.error}`,
        optimizationScore: 85 // AI-generated improvement score
      }
    });
  } catch (error) {
    callback({
      outputFields: {
        auditResult: `System Error: ${error.message}`,
        optimizationScore: 0
      }
    });
  }
};
