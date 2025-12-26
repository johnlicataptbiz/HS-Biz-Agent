export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri, client_id } = req.body;

  console.log("Token API called with:", { 
    hasCode: !!code, 
    redirect_uri, 
    provided_client_id: client_id 
  });

  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  // Determine which client ID to use (Default to Standard App if not provided)
  const defaultClientId = process.env.HUBSPOT_CLIENT_ID || process.env.VITE_HUBSPOT_CLIENT_ID || '7e3c1887-4c26-47a8-b750-9f215ed818f1';
  const clientId = client_id || defaultClientId;
  
  // Select the correct secret based on the client ID
  let clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  let secretSource = "Standard";

  // If this is the MCP App Client ID, we should ideally use the MCP Secret
  if (clientId === '9d7c3c51-862a-4604-9668-cad9bf5aed93') {
      console.log("Detected MCP Client ID.");
      if (process.env.HUBSPOT_MCP_CLIENT_SECRET) {
          clientSecret = process.env.HUBSPOT_MCP_CLIENT_SECRET;
          secretSource = "MCP_Env_Var";
      } else {
          console.error("CRITICAL: MCP Client ID used but HUBSPOT_MCP_CLIENT_SECRET is missing!");
          secretSource = "MISSING_MCP_SECRET";
      }
  }

  console.log(`Using Client ID: ${clientId}`);
  console.log(`Secret Source: ${secretSource}`);
  console.log(`Secret Length: ${clientSecret ? clientSecret.length : 0}`);

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'HubSpot credentials not configured on server' });
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('redirect_uri', redirect_uri);
  params.append('code', code);

  try {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: params
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('HubSpot Token Error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Internal Token Exchange error:', error);
    return res.status(500).json({ error: 'Internal server error during token handshake' });
  }
}
