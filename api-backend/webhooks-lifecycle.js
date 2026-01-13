import { getPool } from "./contacts.js";

export default async function handler(req, res) {
  // 1. Log Webhook Event
  console.log("📬 [HubSpot Webhook] Received Event:", {
    timestamp: new Date().toISOString(),
    events: req.body,
  });

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Webhooks are always POST from HubSpot
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const pool = getPool();

    for (const event of events) {
      const {
        subscriptionType,
        objectId,
        propertyName,
        propertyValue,
        portalId,
      } = event;

      // Handle Lifecycle Stage Change
      if (
        subscriptionType === "contact.propertyChange" &&
        propertyName === "lifecyclestage"
      ) {
        console.log(
          `🔄 Syncing Lifecycle Stage for Contact ${objectId} to ${propertyValue}`
        );

        // Update local cache/database
        await pool.query(
          "UPDATE contacts SET lifecyclestage = $1, last_modified = NOW() WHERE id = $2",
          [propertyValue, String(objectId)]
        );
      }

      // Handle New Contact Creation
      if (
        subscriptionType === "contact.creation" ||
        subscriptionType === "object.creation"
      ) {
        console.log(
          `🆕 New Contact Detected: ${objectId}. Triggering full strategic sync...`
        );
        // In a real app, you'd trigger a fetch to HubSpot to get all properties for this new ID
        // For now, we seed a placeholder and wait for the next heavy sync
        await pool.query(
          "INSERT INTO contacts (id, lifecyclestage, last_modified) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING",
          [String(objectId), "subscriber"]
        );
      }
    }

    // HubSpot expects a 200/204 response within 3 seconds
    return res.status(200).json({ success: true, processed: events.length });
  } catch (error) {
    console.error("❌ Webhook Processing Error:", error);
    // Even on error, we usually want to return a 200 to prevent HubSpot from retrying indefinitely
    // unless we actually want a retry.
    return res.status(200).json({ error: error.message });
  }
}
