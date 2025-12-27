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

  const { vibeScore, summary, riskFactors, fitType } = data || {};

  return (
    <Flex direction="column" gap="md">
      <Flex justify="between" align="center">
          <Text format={{ fontWeight: "bold" }}>Fit Score</Text>
          <Tag variant={vibeScore > 80 ? "success" : (vibeScore > 50 ? "warning" : "danger")}>
             {vibeScore}/100
          </Tag>
      </Flex>
      
      <Box>
         <Text>{summary}</Text>
      </Box>

      <Divider />

      <Text format={{ fontWeight: "bold" }}>Risk Factors</Text>
      <Flex direction="column" gap="sm">
          {riskFactors && riskFactors.map((risk, idx) => (
              <Tag key={idx} variant="info">{risk}</Tag>
          ))}
          {!riskFactors?.length && <Text>No major risks detected.</Text>}
      </Flex>
      
      <Flex justify="end">
         <Button onClick={() => sendAlert({ message: "Note saved to timeline!", type: "success" })}>
            Save Analysis
         </Button>
      </Flex>
    </Flex>
  );
};
