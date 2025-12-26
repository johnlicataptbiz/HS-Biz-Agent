# HubSpot API Reference for AI Optimizer

This document serves as the source of truth for API endpoints used in the application, specifically targeting the "Premium Portal Intelligence" features.

## 1. Automation & Workflows

### **List Workflows (Dashboard Data)**
*   **Endpoint**: `GET /automation/v3/workflows`
*   **Purpose**: Retrieves a list of all automation workflows (Contact, Company, Deal, etc.) to calculate heuristic scores.
*   **Version**: **V3** (Standard for listing operational flows).
*   **Scopes**: `automation`
*   **Response**:
    ```json
    {
      "workflows": [
        { "id": 123, "name": "Nurture Flow", "enabled": true, "enrolledCount": 50 }
      ]
    }
    ```

### **Custom Code Actions (Breeze Tools)**
*   **Endpoint**: `GET /automation/v4/actions/{appId}`
*   **Purpose**: Retrieves custom workflow actions (extensions) created by this app.
*   **Version**: **V4** (Modern logic extensions).
*   **Scopes**: `automation.actions.read`

---

## 2. Sequences (Sales Hub)

### **List Sequences**
*   **Endpoint**: `GET /automation/v4/sequences`
*   **Purpose**: Retrieves sales email sequences for the "Market Sequences" dashboard.
*   **Version**: **V4** (Modern architecture).
*   **Scopes**: `automation.sequences.read`, `sales-email-read`
*   **Note**: Requires **Sales Hub Professional** or **Enterprise**. Returns 404/403 if tier is missing.

---

## 3. Data Model (Properties)

### **List Contact Properties**
*   **Endpoint**: `GET /crm/v3/properties/contacts`
*   **Purpose**: Audits the CRM schema for redundancy (e.g., "duplicate_name", "unused_field").
*   **Version**: **V3** (Current CRM standard).
*   **Scopes**: `crm.schemas.contacts.read` (or `crm.objects.contacts.read`)

---

## 4. MCP / CRM Search

### **Search Objects**
*   **Endpoint**: `POST /crm/v3/objects/{objectType}/search`
*   **Purpose**: High-speed lookup for Agents and Co-Pilot tools.
*   **Version**: **V3**
*   **Scopes**: `crm.objects.contacts.read`, `crm.objects.companies.read`

## Status Codes Guide
*   **200**: Success.
*   **401**: Unauthorized (Token expired or invalid).
*   **403**: Forbidden (Missing Scope or **Missing Hub Tier** e.g. Sales Hub Starter trying to access Sequences).
*   **404**: Not Found (Wrong Endpoint OR Feature disabled in portal).
