export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, refresh_token, redirect_uri, client_id, code_verifier, state } =
    req.body;

  console.log("Token API called with:", {
    hasCode: !!code,
    hasRefreshToken: !!refresh_token,
    redirect_uri,
    provided_client_id: client_id,
  });

  if (!code && !refresh_token) {
    return res.status(400).json({ error: "Code or refresh_token is required" });
  }

  // Determine which client ID to use (Default to Standard App if not provided)
  const defaultClientId =
    process.env.HUBSPOT_CLIENT_ID ||
    process.env.VITE_HUBSPOT_CLIENT_ID ||
    "7e3c1887-4c26-47a8-b750-9f215ed818f1";
  let clientId = (client_id || defaultClientId).trim();

  // Select the correct secret based on the client ID
  let clientSecret = process.env.HUBSPOT_CLIENT_SECRET
    ? process.env.HUBSPOT_CLIENT_SECRET.trim()
    : "";
  let secretSource = "Standard";

  // If this is the MCP App Client ID, we should ideally use the MCP Secret
  if (clientId === "9d7c3c51-862a-4604-9668-cad9bf5aed93") {
    console.log("Detected MCP Client ID.");
    if (process.env.HUBSPOT_MCP_CLIENT_SECRET) {
      clientSecret = process.env.HUBSPOT_MCP_CLIENT_SECRET.trim();
      secretSource = "MCP_Env_Var";
    } else {
      console.error(
        "CRITICAL: MCP Client ID used but HUBSPOT_MCP_CLIENT_SECRET is missing!"
      );
      secretSource = "MISSING_MCP_SECRET";
    }
  }

  console.log(`Using Client ID: ${clientId}`);
  console.log(`Secret Source: ${secretSource}`);

  if (!clientId || !clientSecret) {
    return res
      .status(500)
      .json({ error: "HubSpot credentials not configured on server" });
  }

  // If a state was provided, validate it against the server-side map (to prevent CSRF)
  if (state) {
    if (!global.__oauthStateMap || !global.__oauthStateMap[state]) {
      console.error(
        "Invalid or expired OAuth state provided in token exchange"
      );
      return res.status(400).json({ error: "Invalid or expired OAuth state" });
    }
    // Optionally remove it now to prevent replay
    delete global.__oauthStateMap[state];
  }

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  if (refresh_token) {
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refresh_token);
  } else {
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", redirect_uri);
    params.append("code", code);
    // If the client provided a code_verifier (PKCE), pass it through
    if (code_verifier) {
      params.append("code_verifier", code_verifier);
    }
  }

  try {
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("===========================================");
      console.error("❌ HubSpot OAuth Token Exchange Failed");
      console.error("Status:", response.status);
      console.error("Client ID Used:", clientId);
      console.error(
        "Redirect URI Used:",
        redirect_uri || "N/A (refresh token)"
      );
      console.error("HubSpot Error Response:", JSON.stringify(data, null, 2));
      console.error("===========================================");
      return res.status(response.status).json(data);
    }

    console.log("✅ OAuth Token Exchange Successful");
    return res.status(200).json(data);
  } catch (error) {
    console.error("Internal Token Exchange error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during token handshake" });
  }
}
