# HubSpot MCP Server: Usage Walkthrough

You have successfully connected the **HubSpot AI Optimizer (MCP)** server! This integration allows AI models (like Claude, ChatGPT, or local agents) to securely access your HubSpot CRM data using the Model Context Protocol.

## 1. Quick Test with MCP Inspector

The easiest way to verify the connection is live is using HubSpot's recommended inspector tool.

1. **Generate a Bearer Token**: Since you just completed the OAuth flow, ensure your application has stored the `access_token`.
2. **Open MCP Inspector**: [MCP Inspector (Web)](https://modelcontextprotocol.io/inspector) or run it locally.
3. **Configure Connection**:
   - **Transport Type**: `Streamable HTTP`
   - **URL**: `https://mcp.hubspot.com/`
   - **Bearer Token**: [Your Access Token]
   - **Client ID**: `9d7c3c51-862a-4604-9668-cad9bf5aed93`
4. **Run a Tool**: Select `get_user_details` and click **Run Tool**. It should return your HubSpot user info and account details.

## 2. Using with AI Clients (Claude Desktop, etc.)

To use this with a desktop AI client, you can configure it as a remote server:

### For Claude Desktop (`config.json`)

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "npx",
      "args": ["-y", "@hubspot/mcp-server"],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

## 3. Supported Capabilities

The CURRENT beta version of the HubSpot MCP server supports:

- **Contacts**: `get_contact`, `search_contacts`, `list_contacts`
- **Companies**: `get_company`, `search_companies`
- **Deals**: `get_deal`, `search_deals`
- **Owners**: `get_owner`
- **User Info**: `get_user_details`

> [!NOTE]
> **Read-Only**: As per current HubSpot docs, this is a read-only integration. Write operations (create/update) are not yet supported via MCP.

## 4. Troubleshooting & Known Issues

- **Tool 404/403 Errors**: In the Beta, some endpoints (like `list_contacts`) may fail due to account-level restrictions. Use `search_contacts` or `get_contact` with an explicit ID instead.
- **Token Expiration**: HubSpot access tokens expire after 30 minutes. If Claude returns an "Unauthorized" or "401" error, you need to refresh the token.
- **Claude Connection Failed**: Ensure you have restarted Claude Desktop after updating the `config.json`. Ensure the token is pasted **exactly** as shown in the "Diagnostics" section without brackets or quotes if using the `env` object.

## 5. Refreshing the Connection

To refresh your session:

1. Open the **Secure Tunnel** (Settings) in this app.
2. Click **Force User-Level Auth (MCP)**.
3. Expand **Diagnostics** and copy the new **Bearer Token**.
4. Update your `claude_desktop_config.json` and **Restart Claude**.

## Next Steps

Now that the pipe is built, would you like me to:

- **Wire up the Dashboard UI** to use these tokens and show live stats?
- **Enhance the Breeze Agent** tool we built earlier to call external services?
- **Add a "Copy for Claude" button** that formats the JSON config for you?
