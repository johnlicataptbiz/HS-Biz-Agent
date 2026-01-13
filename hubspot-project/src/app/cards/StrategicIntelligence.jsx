import React, { useState, useEffect } from "react";
import { 
  Divider, 
  Button, 
  Text, 
  Box, 
  Flex, 
  Tag, 
  Alert,
  Tile
} from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";

// Define the extension
hubspot.extend(({ context, actions }) => (
  <StrategicIntelligence
    context={context}
    sendAlert={actions.addAlert}
  />
));

const StrategicIntelligence = ({ context, sendAlert }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Your Railway Backend Base URL
  const BACKEND_URL = "https://hubspot-proxy-production.up.railway.app/api";

  const fetchStrategy = () => {
    setLoading(true);
    setError(null);
    setNeedsSync(false);

    // Using hubspot.fetch directly as it's the 2025.2 standard
    if (typeof hubspot.fetch !== 'function') {
      setError("hubspot.fetch is not available in this environment.");
      setLoading(false);
      return;
    }

    hubspot.fetch(`${BACKEND_URL}/agent-bridge`, {
      method: 'POST',
      body: {
        action: 'get_lead_strategy',
        contactId: context.crm.objectId
      }
    })
      .then((resp) => {
        if (resp.ok) {
          setData(resp.body);
        } else {
          const message =
            resp.body?.error || `Strategic Analysis Failed (${resp.status})`;
          if (resp.status === 404) {
            setNeedsSync(true);
          }
          setError(message);
        }
      })
      .catch((err) => setError(`Error reaching Strategic Engine: ${err.message}`))
      .finally(() => setLoading(false));
  };

  const fetchSyncStatus = () => {
    setSyncError(null);
    hubspot.fetch(`${BACKEND_URL}/sync`, { method: 'GET' })
      .then((resp) => {
        if (resp.ok) {
          setSyncStatus(resp.body);
        } else {
          setSyncError(resp.body?.error || `Sync status failed (${resp.status})`);
        }
      })
      .catch((err) => setSyncError(`Sync status error: ${err.message}`));
  };

  const startSync = () => {
    setIsSyncing(true);
    setSyncError(null);
    hubspot.fetch(`${BACKEND_URL}/sync`, { method: 'POST', body: {} })
      .then((resp) => {
        if (resp.ok) {
          setSyncStatus(resp.body);
          sendAlert({ message: "Sync started. Refresh in a moment.", type: "success" });
        } else {
          const message = resp.body?.error || `Sync failed (${resp.status})`;
          setSyncError(message);
          sendAlert({ message, type: "danger" });
        }
      })
      .catch((err) => {
        const message = `Sync error: ${err.message}`;
        setSyncError(message);
        sendAlert({ message, type: "danger" });
      })
      .finally(() => setIsSyncing(false));
  };

  useEffect(() => {
    fetchStrategy();
  }, [context.crm.objectId]);

  const handleStageChange = (targetStage) => {
    setIsUpdating(true);
    hubspot.fetch(`${BACKEND_URL}/agent-bridge`, {
      method: 'POST',
      body: {
        action: 'remediate_lead',
        contactId: context.crm.objectId,
        targetStage: targetStage
      }
    }).then((resp) => {
      if (resp.ok) {
        sendAlert({ message: `Successfully promoted to ${targetStage}`, type: "success" });
        fetchStrategy(); // Refresh local state
      } else {
        sendAlert({ message: resp.body?.error || "Promotion failed.", type: "danger" });
      }
    })
    .catch((err) => sendAlert({ message: "Network error during promotion.", type: "danger" }))
    .finally(() => setIsUpdating(false));
  };

  const handleTagChange = (targetStatus) => {
    setIsTagging(true);
    hubspot.fetch(`${BACKEND_URL}/agent-bridge`, {
      method: 'POST',
      body: {
        action: 'tag_lead',
        contactId: context.crm.objectId,
        status: targetStatus
      }
    }).then((resp) => {
      if (resp.ok) {
        setData((prev) =>
          prev ? { ...prev, leadStatus: resp.body?.label || targetStatus } : prev
        );
        sendAlert({ message: `Tagged as ${targetStatus}`, type: "success" });
      } else {
        sendAlert({ message: resp.body?.error || "Tagging failed.", type: "danger" });
      }
    })
    .catch((err) => sendAlert({ message: "Network error during tagging.", type: "danger" }))
    .finally(() => setIsTagging(false));
  };

  if (loading) return <Text>Analyzing lead health...</Text>;

  if (error) {
    return (
      <Alert title="Engine Offline" variant="danger">
        <Text>{error}</Text>
        <Flex gap="xs" wrap="wrap" padding={{ top: "sm" }}>
          <Button onClick={fetchStrategy} variant="secondary">Retry Connection</Button>
          {needsSync && (
            <Button onClick={startSync} variant="primary" disabled={isSyncing}>
              {isSyncing ? "Syncing..." : "Start Sync"}
            </Button>
          )}
          <Button onClick={fetchSyncStatus} variant="secondary">Check Sync Status</Button>
        </Flex>
        {(syncStatus || syncError) && (
          <Box padding={{ top: "sm" }}>
            {syncStatus && (
              <Text variant="microcopy">
                Sync status: {syncStatus.status} ({syncStatus.count || 0} contacts)
              </Text>
            )}
            {syncError && <Text variant="microcopy">{syncError}</Text>}
          </Box>
        )}
      </Alert>
    );
  }

  const {
    healthScore,
    classification,
    signals,
    context: analysisContext,
    leadStatus,
  } = data || {};

  const TAG_OPTIONS = [
    "Hot",
    "Nurture",
    "Watch",
    "New",
    "Unqualified",
    "Active Client",
    "Past Client",
    "Rejected",
    "Trash",
  ];

  const normalizeTagLabel = (value) => {
    if (!value) return "";
    const match = TAG_OPTIONS.find(
      (opt) => opt.toLowerCase() === String(value).toLowerCase()
    );
    if (match) return match;
    return String(value).replace(/_/g, " ").replace(/-/g, " ");
  };

  const suggestedTag = TAG_OPTIONS.find(
    (opt) => opt.toLowerCase() === String(classification || "").toLowerCase()
  );
  const currentTag = normalizeTagLabel(leadStatus || classification || "");

  return (
    <Flex direction="column" gap="md">
      {/* 1. Health Score Header */}
      <Tile>
        <Flex justify="between" align="center">
          <Text format={{ fontWeight: "bold", fontSize: "small" }} variant="microcopy" uppercase>Strategic Health</Text>
          <Tag variant={healthScore > 70 ? "success" : (healthScore > 30 ? "warning" : "danger")}>
            {classification || "Neutral"}
          </Tag>
        </Flex>
        <Box padding={{ top: "sm" }}>
           <Text variant="title">{healthScore || 0}% Match</Text>
        </Box>
      </Tile>

      {/* 2. AI Intelligence Brief */}
      <Box>
        <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Agent Intelligence</Text>
        <Text format={{ italic: true }}>
          {analysisContext || "No active strategic insights for this contact."}
        </Text>
      </Box>

      {/* 3. Status Tagging */}
      <Box>
        <Flex justify="between" align="center">
          <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Status Tag</Text>
          {currentTag ? <Tag>{currentTag}</Tag> : null}
        </Flex>
        {suggestedTag && (
          <Box padding={{ top: "xs" }}>
            <Text variant="microcopy">Suggested: {suggestedTag}</Text>
          </Box>
        )}
        <Flex gap="xs" direction="row" wrap="wrap" padding={{ top: "sm" }}>
          {TAG_OPTIONS.map((tag) => (
            <Button
              key={tag}
              variant={tag === suggestedTag ? "primary" : "secondary"}
              onClick={() => handleTagChange(tag)}
              disabled={isTagging}
            >
              {tag}
            </Button>
          ))}
        </Flex>
      </Box>

      {/* 4. Signals / Conflict Detection */}
      {signals?.hasConflict && (
        <Alert variant="warning" title="Architectural Debt Detected">
          <Text>This contact is a 'Customer' but has 'Closed Lost' deal history. Data remediation recommended.</Text>
        </Alert>
      )}

      <Divider />

      {/* 5. Action Suite (The Promoter) */}
      <Box>
        <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Quick Promote</Text>
        <Flex gap="xs" direction="row" wrap="wrap" padding={{ top: "sm" }}>
          <Button 
            variant="secondary" 
            onClick={() => handleStageChange('marketingqualifiedlead')}
            disabled={isUpdating}
          >
            MQL
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => handleStageChange('salesqualifiedlead')}
            disabled={isUpdating}
          >
            SQL
          </Button>
          <Button 
            variant="primary" 
            onClick={() => handleStageChange('opportunity')}
            disabled={isUpdating}
          >
            OPP
          </Button>
        </Flex>
      </Box>
    </Flex>
  );
};

export default StrategicIntelligence;
