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
  const objectType = object?.objectType || "UNKNOWN";
  const prompt = inputFields?.agentPrompt;
  const urgency = (inputFields?.urgency || "medium").toLowerCase();
  const urgencyWeights = { low: 70, medium: 80, high: 92 };
  const baseScore = urgencyWeights[urgency] || 75;
  if (!prompt) {
    return {
      statusCode: 200,
      // Returning 200 with error message in output fields is often safer for Workflows to avoid retries
      body: {
        outputFields: {
          recommendation: "Error: No agent prompt provided. Reasoning engine suspended.",
          confidenceScore: 0
        }
      }
    };
  }
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
