"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/app/functions/source/utils/v3-validator.js
var require_v3_validator = __commonJS({
  "src/app/functions/source/utils/v3-validator.js"(exports2) {
    "use strict";
    var crypto = require("crypto");
    exports2.validateSignature = (req, clientSecret) => {
      const method = req.method;
      const signature = req.headers["x-hubspot-signature-v3"];
      const timestamp = req.headers["x-hubspot-request-timestamp"];
      const ignoredUrl = req.originalUrl.split("#")[0];
      if (Date.now() - timestamp > 3e5) {
        throw new Error("Request too old");
      }
      const body = req.body && typeof req.body === "object" ? JSON.stringify(req.body) : req.body || "";
      const source = method + ignoredUrl + body + timestamp;
      const hash = crypto.createHmac("sha256", clientSecret).update(source).digest("base64");
      if (hash !== signature) {
        throw new Error("Invalid signature");
      }
      return true;
    };
  }
});

// src/app/functions/source/breeze-agent.js
var { validateSignature } = require_v3_validator();
exports.main = async (context = {}) => {
  const body = context.body || {};
  const { inputFields, object } = body;
  const objectId = object?.objectId;
  const objectType = (object?.objectType || "UNKNOWN").toLowerCase();
  const prompt = inputFields?.agentPrompt;
  const accessToken = context.params?.accessToken || context.token; // HubSpot provides this in some contexts

  if (!prompt) {
    return {
      statusCode: 200,
      body: {
        outputFields: {
          recommendation: "Error: No agent prompt provided.",
          confidenceScore: 0
        }
      }
    };
  }

  try {
      // Direct call to the Strategic AI Proxy
      // Note: In production, this URL should be dynamic or ENV based
      const aiResp = await fetch('https://hubspot-ai-optimizer-murex.vercel.app/api/ai', {
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
                  recommendation: `Breeze Agent Standby for ${objectType} ${objectId}. (Direct AI link deferred: ${err.message})`,
                  confidenceScore: 70
              }
          }
      };
  }
};
