const axios = require("axios");

exports.main = async (context = {}) => {
  const { action, contactId, payload } = context.parameters || {};
  const token = process.env["PRIVATE_APP_ACCESS_TOKEN"];

  // Base URL of your deployed backend
  const BACKEND_URL = "https://hubspot-proxy-production.up.railway.app/api";

  try {
    // 1. Fetch Strategic Data from your Database
    if (action === "get-status") {
      console.log(`🔍 Fetching strategic context for contact: ${contactId}`);

      // We call your backend's agent-bridge logic to get the same data the AI agents see
      const resp = await axios.post(`${BACKEND_URL}/agent-bridge`, {
        action: "get_lead_strategy",
        contactId: contactId,
        hubspotToken: token, // Pass the token so the backend can verify if needed
      });

      return {
        status: "SUCCESS",
        response: resp.data,
      };
    }

    // 2. Perform Promotion (Write Operation)
    if (action === "promote") {
      const { targetStage } = payload;
      console.log(`🚀 Promoting contact ${contactId} to ${targetStage}`);

      const resp = await axios.post(`${BACKEND_URL}/agent-bridge`, {
        action: "remediate_lead",
        contactId: contactId,
        targetStage: targetStage,
        hubspotToken: token,
      });

      return {
        status: "SUCCESS",
        response: resp.data,
      };
    }

    return {
      status: "ERROR",
      message: "Unknown action requested by CRM Card",
    };
  } catch (error) {
    console.error("Strategic Card Engine Failure:", error.message);
    return {
      status: "ERROR",
      message: error.response?.data?.error || error.message,
    };
  }
};
