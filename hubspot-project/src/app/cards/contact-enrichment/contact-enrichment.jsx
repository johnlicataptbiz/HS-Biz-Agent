import React, { useState, useEffect } from 'react';
import {
  hubspot,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  Link,
  Text,
  LoadingSpinner,
  Tag,
  Tabs,
  List
} from '@hubspot/ui-extensions';

const EnrichmentCard = ({ context, runServerless }) => {
  const contactId = context?.crmObjectId;
  const portalId = context?.portalId;
  
  const [selectedTab, setSelectedTab] = useState(0);

  // Enrichment State
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Workflow State
  const [wfStatus, setWfStatus] = useState('idle');
  const [workflows, setWorkflows] = useState([]);

  // --- ENRICHMENT LOGIC ---
  const runEnrichment = async () => {
    if (!contactId) return setError('No contact ID found.');
    setError('');
    setStatus('loading');
    setShowConfirm(false);

    try {
      const resp = await runServerless({ name: 'enrich', parameters: { contactId, portalId } });
      if (resp.status !== 'SUCCESS') throw new Error(resp.message || 'Enrichment failed');
      setResult(resp.response);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e?.message || 'Enrichment failed.');
    }
  };

  const applyUpdates = async () => {
    if (!result) return;
    setStatus('applying');
    setError('');
    try {
      const resp = await runServerless({ 
          name: 'enrich-apply', 
          parameters: {
              contactId: result.contactId,
              companyId: result.companyId,
              contactUpdates: result.contactUpdates || {},
              companyUpdates: result.companyUpdates || {},
              noteBody: result.noteBody
          } 
      });
      if (resp.status !== 'SUCCESS') throw new Error(resp.message || 'Apply failed');
      setStatus('applied');
      setShowConfirm(false);
    } catch (e) {
      setStatus('error');
      setError(e?.message || 'Apply failed.');
    }
  };

  // --- WORKFLOW LOGIC ---
  const loadWorkflows = async () => {
    setWfStatus('loading');
    try {
      const resp = await runServerless({ name: 'contact-workflows.js', parameters: { contactId } });
      if (resp.status !== 'SUCCESS') throw new Error(resp.message || 'Workflow scan failed');
      
      const data = resp.response;
      setWorkflows(data.workflows || []);
      setWfStatus('success');
    } catch (e) {
      setWfStatus('error');
      console.error(e);
    }
  };
  
  // Auto-load workflows when tab is selected
  useEffect(() => {
      if (selectedTab === 1 && wfStatus === 'idle') {
          loadWorkflows();
      }
  }, [selectedTab]);

  const contactUpdates = result?.contactUpdates || {};
  const companyUpdates = result?.companyUpdates || {};
  const sources = result?.sources || [];

  return (
    <Box>
      <Tabs selected={selectedTab} onSelect={setSelectedTab}>
          <Tabs.Tab label="Enrichment" />
          <Tabs.Tab label="Active Workflows" />
      </Tabs>

      <Box>
        {selectedTab === 0 && (
          <Flex direction="column" gap="small">
             <Box>
                <Text size="small" muted>
                  Enrich contact details using Google Custom Search with review before applying updates.
                </Text>
             </Box>
             <Divider />
             
             {status === 'idle' && (
                <Button onClick={runEnrichment} variant="primary">Run Enrichment</Button>
             )}

             {status === 'loading' && <LoadingSpinner label="Running enrichment..." />}
             {status === 'applying' && <LoadingSpinner label="Applying updates..." />}

             {status === 'error' && (
               <Box>
                 <Text variant="error">{error || 'Something went wrong.'}</Text>
                 <Button onClick={runEnrichment} variant="secondary">Retry</Button>
               </Box>
             )}

             {status === 'applied' && (
               <Box>
                 <Text>Enrichment applied successfully.</Text>
                 <Button onClick={runEnrichment} variant="secondary">Run Again</Button>
               </Box>
             )}

             {status === 'ready' && result && (
               <Flex direction="column" gap="medium">
                 <Box>
                   <Heading size="small">Updates Found</Heading>
                   {Object.keys(contactUpdates).length === 0 && Object.keys(companyUpdates).length === 0 ? (
                       <Text>No clear updates found.</Text>
                   ) : (
                       <Flex direction="column" gap="xs">
                           {Object.entries(contactUpdates).map(([k, v]) => <Tag key={k} variant="success">Contact {k}: {String(v)}</Tag>)}
                           {Object.entries(companyUpdates).map(([k, v]) => <Tag key={k} variant="info">Company {k}: {String(v)}</Tag>)}
                       </Flex>
                   )}
                 </Box>

                 <Box>
                   <Heading size="small">Sources</Heading>
                   {sources.map((s, i) => (
                       <Link key={i} href={s.link} target="_blank">{s.title || 'Link'}</Link>
                   ))}
                 </Box>

                 {!showConfirm ? (
                   <Button onClick={() => setShowConfirm(true)} variant="primary">Review & Apply</Button>
                 ) : (
                   <Flex direction="column" gap="small">
                       <Text size="small">Confirming will update properties and add a research note.</Text>
                       <Flex gap="small">
                           <Button onClick={applyUpdates} variant="primary">Confirm</Button>
                           <Button onClick={() => setShowConfirm(false)} variant="secondary">Cancel</Button>
                       </Flex>
                   </Flex>
                 )}
               </Flex>
             )}
          </Flex>
        )}

        {selectedTab === 1 && (
            <Flex direction="column" gap="medium">
                {wfStatus === 'loading' && <LoadingSpinner label="Scanning workflows..." />}
                {wfStatus === 'error' && (
                    <Box>
                        <Text variant="error">Failed to load workflows.</Text>
                        <Button onClick={loadWorkflows} variant="secondary">Retry</Button>
                    </Box>
                )}
                {wfStatus === 'success' && workflows.length === 0 && (
                    <Text>This contact is not enrolled in any workflows.</Text>
                )}
                {wfStatus === 'success' && workflows.length > 0 && (
                    <Box>
                        <Text muted size="small" className="mb-2">{workflows.length} active enrollments</Text>
                        <Divider />
                        <Flex direction="column" gap="small">
                            {workflows.map(wf => (
                                <Box key={wf.id} direction="row" justify="between" align="center">
                                    <Text format={{ fontWeight: 'bold' }}>{wf.name}</Text>
                                    <Tag>Active</Tag>
                                </Box>
                            ))}
                        </Flex>
                    </Box>
                )}
            </Flex>
        )}
      </Box>
    </Box>
  );
};
hubspot.extend(({ context, runServerlessFunction, actions }) => <EnrichmentCard context={context} runServerless={runServerlessFunction} />);
