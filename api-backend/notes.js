export default async function handler(req, res) {

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { hubspotToken, contactId, noteBody } = req.body || {};
    if (!hubspotToken) {
      return res.status(401).json({ error: "Missing HubSpot token" });
    }
    if (!contactId || !noteBody) {
      return res.status(400).json({ error: "Missing contactId or noteBody" });
    }

    const response = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hubspotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date().toISOString(),
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

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, note: data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
