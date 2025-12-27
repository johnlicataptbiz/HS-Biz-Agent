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

  useEffect(() => {
    // Initial fetch to the serverless function
    // We pass the contact ID or email to the backend
    runServerless({ name: "vibeCheck", parameters: { contactId: context.crm.objectId } })
      .then((resp) => {
        if (resp.status === 'SUCCESS') {
            setData(resp.response);
        } else {
            setError(resp.message || "Analysis Failed");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Network error");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
        <Alert title="Vibe Check Failed" variant="danger">
            {error}
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
        <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Conversation Starters</Text>
        <Flex direction="column" gap="xs">
            {conversationStarters && conversationStarters.map((starter, idx) => (
                <Text key={idx} variant="microcopy">• {starter}</Text>
            ))}
        </Flex>
      </Box>

      <Divider />

      <Text format={{ fontWeight: "bold" }} variant="microcopy" uppercase>Risk Factors</Text>
      <Flex direction="row" gap="sm" wrap="wrap">
          {riskFactors && riskFactors.map((risk, idx) => (
              <Tag key={idx} variant="error">{risk}</Tag>
          ))}
          {!riskFactors?.length && <Text>No major risks detected.</Text>}
      </Flex>
      
      <Flex justify="end">
         <Button 
            variant="primary"
            onClick={() => sendAlert({ message: "Strategic analysis synced to timeline.", type: "success" })}
         >
            Save Analysis
         </Button>
      </Flex>
    </Flex>
  );
};

export default LeadVibeCheck;
