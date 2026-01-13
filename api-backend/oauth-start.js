export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { useMcp, client_id, code_challenge, redirect_uri } = req.body || {};

  // Generate server-side state and store minimal session info in a global map.
  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch (e) {
    // Node polyfill
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  const serverState = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Initialize global map if not present
  if (!global.__oauthStateMap) global.__oauthStateMap = {};
  global.__oauthStateMap[serverState] = {
    clientId:
      client_id ||
      process.env.HUBSPOT_CLIENT_ID ||
      process.env.VITE_HUBSPOT_CLIENT_ID ||
      "7e3c1887-4c26-47a8-b750-9f215ed818f1",
    createdAt: Date.now(),
    redirectUri: redirect_uri || req.headers.origin || "",
  };

  // Build the HubSpot auth URL server-side for consistency
  const clientIdToUse = global.__oauthStateMap[serverState].clientId;
  const redirectUriFinal =
    redirect_uri || (req.headers.origin ? `${req.headers.origin}/` : "");
  const scopes = useMcp
    ? [
        "crm.objects.contacts.read",
        "crm.schemas.contacts.write",
        "crm.objects.companies.read",
        "crm.objects.deals.read",
        "oauth",
      ]
    : [
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.schemas.contacts.write",
        "crm.objects.companies.read",
        "crm.objects.companies.write",
        "crm.objects.deals.read",
        "crm.objects.deals.write",
        "crm.objects.owners.read",
        "crm.lists.read",
        "automation",
        "automation.sequences.read",
        "content",
        "forms",
        "marketing.campaigns.read",
        "business-intelligence",
        "oauth",
      ];

  const authUrl = `https://app.hubspot.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientIdToUse)}&redirect_uri=${encodeURIComponent(redirectUriFinal)}&scope=${encodeURIComponent(scopes.join(" "))}&state=${encodeURIComponent(serverState)}${code_challenge ? `&code_challenge=${encodeURIComponent(code_challenge)}&code_challenge_method=S256` : ""}`;

  return res.status(200).json({ authUrl, state: serverState });
}
