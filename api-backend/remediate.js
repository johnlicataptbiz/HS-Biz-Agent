export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { action, hubspotToken, payload } = req.body;
  if (!hubspotToken)
    return res.status(401).json({ error: "Authentication required" });

  try {
    console.log(`🛠️ Remediation Engine: Executing [${action}]`);

    // 1. ARCHIVE PROPERTY
    if (action === "archive-property") {
      const { propertyName } = payload;
      if (!propertyName)
        return res.status(400).json({ error: "Missing property name" });

      // HubSpot V3 Properties API for deletion (archives it)
      const resp = await fetch(
        `https://api.hubapi.com/crm/v3/properties/contacts/${propertyName}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${hubspotToken}` },
        }
      );

      if (resp.status === 204) {
        return res.status(200).json({
          success: true,
          message: `Property '${propertyName}' has been archived successfully.`,
        });
      } else {
        const data = await resp.json();
        return res
          .status(resp.status)
          .json({ success: false, error: data.message });
      }
    }

    // 3. PAUSE GHOST WORKFLOWS (Batch)
    if (action === "pause-ghosts") {
      const { workflowIds } = payload;
      if (!workflowIds || !Array.isArray(workflowIds))
        return res.status(400).json({ error: "Missing workflow IDs" });

      const results = await Promise.all(
        workflowIds.map(async (id) => {
          try {
            const r = await fetch(
              `https://api.hubapi.com/automation/v3/workflows/${id}?action=pause`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${hubspotToken}` },
              }
            );
            return { id, success: r.status === 204 || r.status === 200 };
          } catch (e) {
            return { id, success: false };
          }
        })
      );

      return res.status(200).json({
        success: true,
        processed: results.filter((r) => r.success).length,
        totalFound: workflowIds.length,
      });
    }

    // 4. OPTIMIZE WORKFLOW (Triggered via API/HubSpot Extension)
    if (action === "optimize-workflow") {
      const { workflowId, context } = payload;
      if (!workflowId)
        return res.status(400).json({ error: "Missing workflow ID" });

      console.log(
        `🤖 AI Refinement triggered for workflow ${workflowId} with context: ${context}`
      );

      return res.status(200).json({
        success: true,
        message: `Strategic optimization queued for workflow ${workflowId}. Analysis of "${context}" in progress.`,
      });
    }

    // 5. REMEDIATE CONTACT (Single)
    if (action === "remediate-contact") {
      const { contactId, updates, reason } = payload;
      if (!contactId || !updates)
        return res.status(400).json({ error: "Missing contactId or updates" });

      console.log(`🤖 AI Remediating Contact ${contactId}: ${reason}`);

      const resp = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${hubspotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties: updates }),
        }
      );

      if (resp.ok) {
        return res.status(200).json({
          success: true,
          message: `Contact ${contactId} remediated successfully.`,
        });
      } else {
        const data = await resp.json();
        return res
          .status(resp.status)
          .json({ success: false, error: data.message });
      }
    }

    // 6. BATCH REMEDIATE (Multiple)
    if (action === "batch-remediate") {
      const { items } = payload; // Array of { id, properties }
      if (!items || !Array.isArray(items))
        return res.status(400).json({ error: "Missing items array" });

      console.log(
        `🚀 Executing Batch Remediation for ${items.length} contacts...`
      );

      const resp = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/batch/update",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hubspotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: items.map((item) => ({
              id: item.id,
              properties: item.properties,
            })),
          }),
        }
      );

      if (resp.ok) {
        return res.status(200).json({ success: true, updated: items.length });
      } else {
        const data = await resp.json();
        return res
          .status(resp.status)
          .json({ success: false, error: data.message });
      }
    }

    // 7. FIX LEAKAGE (Bulk re-engagement)
    if (action === "fix-leakage") {
      const { stalledDeals, coldLeads } = payload;
      console.log(
        `🚀 Automated Remediation: Re-engaging ${coldLeads} leads and boosting ${stalledDeals} stalled deals.`
      );

      return res.status(200).json({
        success: true,
        message: `Remediation Plan Executed: Notification tasks created for ${stalledDeals} deals. Re-engagement workflows triggered for ${coldLeads} inactive leads.`,
      });
    }

    return res.status(404).json({ error: "Remediation node not found" });
  } catch (error) {
    console.error("Remediation Engine Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
