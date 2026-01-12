const HUBSPOT_API_BASE = "https://api.hubapi.com";

async function hubspotFetch(path, token) {
  const resp = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return { ok: false, status: resp.status };
  return { ok: true, data: await resp.json() };
}

export default async function handler(req, res) {

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { contactId } = req.body || {};
  if (!contactId) return res.status(400).json({ error: "Missing contactId" });

  const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!hubspotToken) {
    return res.status(503).json({ error: "Missing HubSpot credentials" });
  }

  try {
    // 1. Fetch Contact Enrollments (Legacy V2 is standard for this specific view)
    // Note: V3 usually focuses on definitions. V2 workflows/enrollments/contacts/:id is the specific "what is this contact in" endpoint.
    const enrollResp = await hubspotFetch(
      `/automation/v2/workflows/enrollments/contacts/${contactId}`,
      hubspotToken
    );

    if (!enrollResp.ok) {
      // If 404, maybe no enrollments or just empty
      if (enrollResp.status === 404)
        return res.status(200).json({ workflows: [] });
      return res
        .status(enrollResp.status)
        .json({ error: "Failed to fetch enrollments" });
    }

    const enrolledData = enrollResp.data || [];
    // enrolledData is usually Array<{ workflowId: number, ... }>

    if (enrolledData.length === 0) {
      return res.status(200).json({ workflows: [] });
    }

    // 2. Fetch Workflow Definitions to get Names
    // We only fetch if we have enrollments.
    // Optimization: We could fetch specific IDs if there was a batch endpoint, but usually getting all is easier/cached.
    const wfResp = await hubspotFetch("/automation/v3/workflows", hubspotToken);

    const wfMap = {};
    if (wfResp.ok && wfResp.data.workflows) {
      wfResp.data.workflows.forEach((w) => {
        wfMap[w.id] = w.name;
      });
    }

    // 3. Map Results
    const results = enrolledData.map((enrollment) => ({
      id: enrollment.workflowId,
      name: wfMap[enrollment.workflowId] || `Workflow ${enrollment.workflowId}`,
      enrolledAt: enrollment.portalEnteredCreatedAt
        ? new Date(enrollment.portalEnteredCreatedAt).toISOString()
        : null,
    }));

    return res.status(200).json({ workflows: results });
  } catch (error) {
    console.error("Contact workflows error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
