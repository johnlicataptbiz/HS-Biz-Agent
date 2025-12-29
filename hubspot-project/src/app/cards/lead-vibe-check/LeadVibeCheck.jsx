import React, { useState, useEffect } from "react";
import { Divider, Link, Button, Text, Box, Flex, Tag, Loading, Alert } from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";

// Define the extension
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <LeadVibeCheck
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

const LeadVibeCheck = ({ context, runServerless, sendAlert }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draft, setDraft] = useState(null);

  const fetchData = () => {
    setLoading(true);
    runServerless({ name: "vibe-check", parameters: { contactId: context.crm.objectId } })
      .then((resp) => {
        if (resp.status === 'SUCCESS') {
            setData(resp.response);
        } else {
            setError(resp.message || "Analysis Failed");
        }
      })
      .catch((err) => setError("Network error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    const noteBody = `Strategic Vibe Check Synthesis:\nPersona: ${data.persona}\nVibe Score: ${data.vibeScore}\nSummary: ${data.summary}\nStrategic Advice: ${data.strategicAdvice}`;
    
    runServerless({ 
        name: "vibe-check", 
        parameters: { 
            contactId: context.crm.objectId, 
            action: 'save-note',
            payload: { noteBody }
        } 
    }).then((resp) => {
        if (resp.status === 'SUCCESS') sendAlert({ message: "Strategic analysis synced to timeline.", type: "success" });
        else sendAlert({ message: "Failed to save note.", type: "danger" });
    }).finally(() => setIsSaving(false));
  };

  const handleDraft = () => {
    setIsDrafting(true);
    runServerless({
        name: "vibe-check",
        parameters: {
            contactId: context.crm.objectId,
            action: 'draft-outreach',
            payload: { 
                persona: data.persona, 
                summary: data.summary, 
                conversationStarters: data.conversationStarters 
            }
        }
    }).then((resp) => {
        if (resp.status === 'SUCCESS') setDraft(resp.response);
        else sendAlert({ message: "Drafting failed.", type: "danger" });
    }).finally(() => setIsDrafting(false));
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
        <Alert title="Vibe Check Failed" variant="danger">
            {error}
            <Button onClick={fetchData} variant="secondary">Retry</Button>
        </Alert>
    );
  }

  const { vibeScore, persona, summary, strategicAdvice, riskFactors, conversationStarters } = data || {};

  return (
    <Flex direction="column" gap="md">
      <Box variant="card" padding="md">
        <Flex justify="between" align="center">
            <Text format={{ fontWeight: "bold", fontSize: "small" }} variant="microcopy" uppercase>Fit Persona</Text>
            <Tag variant={vibeScore > 80 ? "success" : (vibeScore > 50 ? "warning" : "danger")}>
               {vibeScore}/100
            </Tag>
        </Flex>
        <Text variant="title" format={{ fontSize: "large", fontWeight: "bold" }}>{persona || "Analyzing..."}</Text>
      </Box>
      
      <Box>
         <Text format={{ italic: true }}>"{summary}"</Text>
      </Box>

      <Divider />

      <Box>
        <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Strategic Advice</Text>
        <Alert variant="info" title="Expert Tactic">
            {strategicAdvice}
        </Alert>
      </Box>

      <Box>
        <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Action Suite</Text>
        <Flex gap="sm" direction="row">
            <Button variant="secondary" onClick={handleDraft} loading={isDrafting}>
                {isDrafting ? "Drafting..." : "Draft Outreach"}
            </Button>
            <Button 
                variant="primary"
                onClick={handleSave}
                loading={isSaving}
            >
                {isSaving ? "Syncing..." : "Save to Timeline"}
            </Button>
        </Flex>
      </Box>

      {draft && (
          <Box padding="md" variant="card">
              <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>AI Draft: {draft.subject}</Text>
              <Divider />
              <Box padding={{ top: "sm" }}>
                <Text>{draft.body}</Text>
              </Box>
              <Flex justify="end" padding={{ top: "sm" }}>
                  <Button variant="secondary" onClick={() => setDraft(null)}>Dismiss</Button>
              </Flex>
          </Box>
      )}

      <Divider />

      <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Risk Factors</Text>
      <Flex direction="row" gap="sm" wrap="wrap">
          {riskFactors && riskFactors.map((risk, idx) => (
              <Tag key={idx} variant="error">{risk}</Tag>
          ))}
          {!riskFactors?.length && <Text>No major risks detected.</Text>}
      </Flex>
    </Flex>
  );
};

export default LeadVibeCheck;
