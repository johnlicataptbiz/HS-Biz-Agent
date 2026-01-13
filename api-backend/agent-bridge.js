const { pool } = await import("../services/backend/dataService.js");

export default async function handler(req, res) {
  const redact = (value) => (value ? "[REDACTED]" : value);
  const safeHeaders = { ...req.headers };
  if ("authorization" in safeHeaders)
    safeHeaders.authorization = redact(safeHeaders.authorization);
  if ("x-hubspot-authorization" in safeHeaders)
    safeHeaders["x-hubspot-authorization"] = redact(
      safeHeaders["x-hubspot-authorization"]
    );
  if ("cookie" in safeHeaders) safeHeaders.cookie = redact(safeHeaders.cookie);
  const safeBody =
    req.body && typeof req.body === "object"
      ? {
          ...req.body,
          hubspotToken: redact(req.body.hubspotToken),
        }
      : req.body;

  // 1. Log the incoming Breeze Agent Request (redacted)
  console.log("🤖 [Breeze Agent Bridge] Incoming Request:", {
    method: req.method,
    body: safeBody,
    headers: safeHeaders,
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
    const { action, contactId, targetStage, noteText, hubspotToken, status } =
      req.body;

    const extractBearer = (value) => {
      if (!value || typeof value !== "string") return null;
      const match = value.match(/^Bearer\s+(.+)$/i);
      const token = (match ? match[1] : value).trim();
      if (!token || token === "undefined" || token === "null") return null;
      return token;
    };
    const headerToken =
      extractBearer(req.headers.authorization) ||
      extractBearer(req.headers["x-hubspot-authorization"]);

    // Note: In a production App, the hubspotToken would ideally come from
    // your app's secure storage based on the portalId (originatingAccountId)
    // sent by HubSpot, but for this bridge we'll support both passed token or internal lookup.

    const envToken =
      process.env.HUBSPOT_ACCESS_TOKEN ||
      process.env.PRIVATE_APP_ACCESS_TOKEN ||
      process.env.HUBSPOT_TOKEN;
    const token = envToken || headerToken || hubspotToken;
    const tokenSource = envToken
      ? "env"
      : headerToken
        ? "header"
        : hubspotToken
          ? "body"
          : "none";
    console.log("🤖 [Breeze Agent Bridge] Auth source:", tokenSource);

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
      const leadStatus =
        contact?.raw_data?.properties?.hs_lead_status || null;
      const storedScore =
        contact.health_score === null || contact.health_score === undefined
          ? null
          : Number(contact.health_score);
      const healthScore = Number.isFinite(storedScore) ? storedScore : null;
      let scoreBreakdown = [];
      let rawContact = contact.raw_data;
      if (typeof rawContact === "string") {
        try {
          rawContact = JSON.parse(rawContact);
        } catch (err) {
          rawContact = null;
        }
      }
      const scoreFormula = [
        { label: "Base score", points: 5 },
        { label: "Engagement intent (page views, visits, conversions)", points: "up to 24" },
        { label: "Commercial velocity (deals, lifecycle stage)", points: "up to 18" },
        { label: "Create-date recency", points: "up to 10" },
        { label: "Activity recency (last visit, email open)", points: "up to 16" },
        { label: "Email interaction depth", points: "up to 11" },
        { label: "Sales intensity (recent CRM notes)", points: "up to 8" },
        { label: "Intent & fit signals (status, owner, phone, job, company, source)", points: "up to 19" },
        { label: "Penalties (bounce, disqualified, stale, no activity)", points: "down to -100" },
        { label: "Tie-break jitter", points: "up to +0.9" },
        { label: "Cap: 90+ requires 3+ strong signals", points: "" },
      ];
      const scoreSummary =
        "Base 5 + engagement + commercial + recency + activity + sales intensity + intent/fit - penalties. 90+ requires 3+ strong signals; slight jitter prevents ties.";

      try {
        const { calculateHealthScore } = await import(
          "../services/backend/healthScoreService.js"
        );
        const { breakdown } = calculateHealthScore(rawContact || {});
        scoreBreakdown = Array.isArray(breakdown) ? breakdown : [];
      } catch (err) {
        console.warn("Score breakdown unavailable:", err.message);
      }
      return res.status(200).json({
        healthScore,
        classification: contact.classification,
        lifecycleStage: contact.lifecyclestage,
        leadStatus,
        scoreSummary,
        scoreBreakdown,
        scoreFormula,
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

    // --- Action: Tag Lead Status (Tool Type: ACT_ON_DATA) ---
    if (action === "tag_lead") {
      if (!token)
        return res
          .status(401)
          .json({ error: "Missing HubSpot Authorization for tagging actions" });
      if (!contactId || !status) {
        return res
          .status(400)
          .json({ error: "contactId and status required" });
      }

      const STATUS_MAP = {
        Hot: "HOT",
        Nurture: "NURTURE",
        Watch: "WATCH",
        New: "NEW",
        Unqualified: "UNQUALIFIED",
        "Active Client": "ACTIVE_CLIENT",
        "Past Client": "PAST_CLIENT",
        Rejected: "REJECTED",
        Trash: "TRASH",
        Employee: "EMPLOYEE",
      };
      const normalized = String(status).trim();
      const statusKey = Object.keys(STATUS_MAP).find(
        (key) => key.toLowerCase() === normalized.toLowerCase()
      );
      const hubspotValue = statusKey
        ? STATUS_MAP[statusKey]
        : Object.values(STATUS_MAP).includes(normalized.toUpperCase())
          ? normalized.toUpperCase()
          : null;

      if (!hubspotValue) {
        return res.status(400).json({
          error: `Unsupported status: ${status}`,
        });
      }

      const resp = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: { hs_lead_status: hubspotValue },
          }),
        }
      );

      if (resp.ok) {
        return res.status(200).json({
          success: true,
          status: hubspotValue,
          label: statusKey || normalized,
        });
      }

      const error = await resp.json();
      return res.status(resp.status).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(404).json({ error: "Agent Capability not implemented" });
  } catch (error) {
    console.error("❌ Agent Bridge Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
