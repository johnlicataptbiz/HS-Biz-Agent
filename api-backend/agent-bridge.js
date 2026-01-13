const { pool } = await import("../services/backend/dataService.js");

export default async function handler(req, res) {
  // 1. Log the incoming Breeze Agent Request
  console.log("🤖 [Breeze Agent Bridge] Incoming Request:", {
    method: req.method,
    body: req.body,
    headers: req.headers,
  });

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // HubSpot Agent Tools send POST requests
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Breeze Agents must use POST." });
  }

  try {
    const { action, contactId, targetStage, noteText, hubspotToken } = req.body;

    // Note: In a production App, the hubspotToken would ideally come from
    // your app's secure storage based on the portalId (originatingAccountId)
    // sent by HubSpot, but for this bridge we'll support both passed token or internal lookup.

    const token =
      hubspotToken ||
      process.env.HUBSPOT_ACCESS_TOKEN ||
      process.env.PRIVATE_APP_ACCESS_TOKEN;

    // --- Action: Fetch Strategy Info (Tool Type: GET_DATA) ---
    if (action === "get_lead_strategy") {
      if (!contactId)
        return res.status(400).json({ error: "contactId required" });

      const result = await pool.query("SELECT * FROM contacts WHERE id = $1", [
        contactId,
      ]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Contact not found in Strategic Database" });
      }

      const contact = result.rows[0];
      return res.status(200).json({
        healthScore: contact.health_score,
        classification: contact.classification,
        lifecycleStage: contact.lifecyclestage,
        signals: {
          isHot: contact.classification === "Hot",
          isStale:
            contact.last_modified &&
            Date.now() - new Date(contact.last_modified).getTime() >
              90 * 24 * 60 * 60 * 1000,
          hasConflict:
            contact.lifecyclestage === "customer" &&
            /lost/i.test(contact.deal_stage || ""),
        },
        context: `This contact is currently classified as ${contact.classification} with a health score of ${contact.health_score}.`,
      });
    }

    // --- Action: Execute Remediation (Tool Type: ACT_ON_DATA) ---
    if (action === "remediate_lead") {
      if (!token)
        return res
          .status(401)
          .json({ error: "Missing HubSpot Authorization for write actions" });
      if (!contactId || !targetStage) {
        return res
          .status(400)
          .json({ error: "contactId and targetStage required" });
      }

      console.log(
        `🚀 Breeze Agent Execution: Promoting ${contactId} to ${targetStage}`
      );

      const resp = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties: { lifecyclestage: targetStage } }),
        }
      );

      if (resp.ok) {
        return res.status(200).json({
          success: true,
          message: `Successfully promoted contact ${contactId} to ${targetStage} via Breeze Agent.`,
          newStage: targetStage,
        });
      } else {
        const error = await resp.json();
        return res
          .status(resp.status)
          .json({ success: false, error: error.message });
      }
    }

    // --- Action: Generate & Save Note (Tool Type: ACT_ON_DATA) ---
    if (action === "log_agent_insight") {
      if (!token)
        return res
          .status(401)
          .json({ error: "Missing HubSpot Authorization for logging actions" });
      if (!contactId || !noteText) {
        return res
          .status(400)
          .json({ error: "contactId and noteText required" });
      }

      const resp = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            hs_note_body: `🤖 [BREEZE AGENT INSIGHT]: ${noteText}`,
            hs_timestamp: Date.now(),
          },
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: 202,
                },
              ],
            },
          ],
        }),
      });

      if (resp.ok) {
        return res.status(200).json({
          success: true,
          message: "Agent insight logged to contact timeline.",
        });
      } else {
        const error = await resp.json();
        return res
          .status(resp.status)
          .json({ success: false, error: error.message });
      }
    }

    return res.status(404).json({ error: "Agent Capability not implemented" });
  } catch (error) {
    console.error("❌ Agent Bridge Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
