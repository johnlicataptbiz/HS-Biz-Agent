import axios from 'axios';
import { saveContacts, updateSyncStatus, getLastSyncTime } from './dataService.js';

let isSyncing = false;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRIABLE_CODES = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNABORTED',
    'EAI_AGAIN',
    'ENOTFOUND',
]);
const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestWithRetry = async (requestFn, label, retries = 3) => {
    let attempt = 0;
    let lastError;
    while (attempt <= retries) {
        try {
            return await requestFn();
        } catch (e) {
            lastError = e;
            const status = e.response?.status;
            const code = e.code;
            const retriable =
                RETRIABLE_CODES.has(code) ||
                RETRIABLE_STATUS.has(status);
            if (!retriable || attempt === retries) {
                break;
            }
            const backoff = 500 * Math.pow(2, attempt);
            console.warn(`⚠️ ${label} failed (${code || status || 'unknown'}). Retrying in ${backoff}ms...`);
            await sleep(backoff);
            attempt += 1;
        }
    }
    throw lastError;
};

/**
 * Professional-grade CRM Synchronization Service
 * Implements Delta Sync using the HubSpot Search API and concurrent batching.
 */
export const startBackgroundSync = async (token) => {
    if (isSyncing) {
        console.log('⚠️ Sync already in progress, skipping...');
        return { message: 'Sync already in progress' };
    }
    
    isSyncing = true;
    updateSyncStatus('syncing');
    console.log('🎬 SYNC INITIATED - Starting background process...');

    // Run in background
    (async () => {
        try {
            const lastSyncTime = await getLastSyncTime();
            const lastSyncMs = lastSyncTime ? new Date(lastSyncTime).getTime() : null;
            let totalSynced = 0;
            const limit = 100;
            let batchCount = 0;
            
            const canDeltaSync = Number.isFinite(lastSyncMs);
            if (lastSyncTime && !canDeltaSync) {
                console.warn(`⚠️ Invalid last sync timestamp (${lastSyncTime}); falling back to full sync.`);
            }
            console.log(canDeltaSync
                ? `🔄 Starting Delta Sync (Last Sync: ${lastSyncTime})`
                : '🚀 Starting Full CRM Deep Sync...'
            );

            let needsFullSync = !canDeltaSync;
            if (canDeltaSync) {
                try {
                    let after = null;
                    while (true) {
                        const searchUrl = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
                        const payload = {
                            filterGroups: [
                                {
                                    filters: [
                                        {
                                            propertyName: 'lastmodifieddate',
                                            operator: 'GT',
                                            value: String(lastSyncMs)
                                        }
                                    ]
                                }
                            ],
                            properties: [
                                'email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle',
                                'lifecyclestage', 'hubspot_owner_id', 'hs_lead_status',
                                'hs_analytics_source', 'hs_analytics_source_data_1', 'hs_analytics_source_data_2',
                                'hs_analytics_first_conversion_event_name',
                                'hs_analytics_num_page_views', 'hs_analytics_num_visits', 'hs_analytics_last_visit_timestamp',
                                'num_associated_deals', 'notes_last_updated', 'hs_email_last_open_date',
                                'hs_email_bounce', 'num_conversion_events', 'associatedcompanyid',
                                'createdate', 'lastmodifieddate'
                            ],
                            limit: limit
                        };

                        if (after) {
                            payload.after = after;
                        }

                        const response = await requestWithRetry(
                            () => axios.post(searchUrl, payload, {
                                headers: { 'Authorization': `Bearer ${token}` },
                                timeout: REQUEST_TIMEOUT_MS,
                            }),
                            'Search contacts'
                        );

                        const data = response.data;
                        if (!data.results || data.results.length === 0) break;

                        await saveContacts(data.results);
                        totalSynced += data.results.length;
                        console.log(`📦 Synced ${totalSynced} changed records (Search API)...`);

                        if (!data.paging || !data.paging.next || !data.paging.next.after) break;
                        after = data.paging.next.after;

                        // Throttle to respect rate limits
                        await new Promise(r => setTimeout(r, 100));
                    }
                } catch (e) {
                    const status = e.response?.status;
                    const code = e.code;
                    const shouldFallback =
                        status === 400 ||
                        RETRIABLE_STATUS.has(status) ||
                        RETRIABLE_CODES.has(code);
                    if (shouldFallback) {
                        console.warn(
                            `⚠️ Delta sync Search API failed (${code || status || 'unknown'}). Falling back to full sync.`
                        );
                        needsFullSync = true;
                    } else {
                        throw e;
                    }
                }
            }

            if (needsFullSync) {
                // Full Sync using standard pagination (more reliable for first pull or search failures)
                let after = null;
                // Dynamic Property Discovery: Fetch all available property names from HubSpot
                let properties;
                try {
                    const propsResp = await requestWithRetry(
                        () => axios.get('https://api.hubapi.com/crm/v3/properties/contacts', {
                            headers: { 'Authorization': `Bearer ${token}` },
                            timeout: REQUEST_TIMEOUT_MS,
                        }),
                        'Discover contact properties'
                    );
                    const discovered = propsResp.data.results.map(p => p.name);
                    const coreProps = new Set([
                        'email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle',
                        'lifecyclestage', 'hubspot_owner_id', 'hs_lead_status',
                        'hs_analytics_source', 'hs_analytics_source_data_1', 'hs_analytics_source_data_2',
                        'hs_analytics_first_conversion_event_name',
                        'hs_analytics_num_page_views', 'hs_analytics_num_visits', 'hs_analytics_last_visit_timestamp',
                        'num_associated_deals', 'notes_last_updated', 'hs_email_last_open_date',
                        'hs_email_bounce', 'num_conversion_events', 'associatedcompanyid',
                        'createdate', 'lastmodifieddate',
                        'membership_type', 'membership_status', 'hs_email_open_count', 'hs_email_click_count'
                    ]);
                    // Keep only known-safe or present core props to avoid 400s on too-long URLs
                    properties = discovered.filter((name) => coreProps.has(name)).join(',');
                    console.log(`📋 Synced ${properties.split(',').length} core properties for discovery.`);
                } catch (e) {
                    console.warn('⚠️ Property discovery failed, falling back to core set:', e.message);
                    properties = [
                        'email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle',
                        'lifecyclestage', 'hubspot_owner_id', 'hs_lead_status',
                        'hs_analytics_source', 'hs_analytics_source_data_1', 'hs_analytics_source_data_2',
                        'hs_analytics_first_conversion_event_name',
                        'hs_analytics_num_page_views', 'hs_analytics_num_visits', 'hs_analytics_last_visit_timestamp',
                        'num_associated_deals', 'notes_last_updated', 'hs_email_last_open_date',
                        'hs_email_bounce', 'num_conversion_events', 'associatedcompanyid',
                        'createdate', 'lastmodifieddate',
                        'membership_type', 'membership_status', 'hs_email_open_count', 'hs_email_click_count'
                    ].join(',');
                }

                while (true) {
                    batchCount++;
                    const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}${after ? `&after=${after}` : ''}&properties=${properties}`;
                    
                    console.log(`📡 Batch ${batchCount}: Fetching ${limit} contacts${after ? ` (after: ${after})` : ' (initial)'}...`);
                    
                    const response = await requestWithRetry(
                        () => axios.get(url, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            timeout: REQUEST_TIMEOUT_MS,
                        }),
                        'Fetch contacts'
                    );

                    const data = response.data;
                    console.log(`📥 Received ${data.results?.length || 0} contacts, hasNext: ${!!data.paging?.next}`);
                    
                    if (!data.results || data.results.length === 0) {
                        console.log('✋ No more results, breaking pagination loop');
                        break;
                    }

                    await saveContacts(data.results);
                    totalSynced += data.results.length;
                    
                    // Read rate limit headers to show "Pro" awareness
                    const remaining = response.headers['x-hubspot-ratelimit-remaining'];
                    console.log(`📦 Batch ${batchCount} saved: ${totalSynced} total contacts synced (API Strength: ${remaining})`);

                    if (!data.paging || !data.paging.next || !data.paging.next.after) {
                        console.log('✋ No paging.next.after, pagination complete');
                        break;
                    }
                    after = data.paging.next.after;
                    console.log(`➡️ Next cursor: ${after}`);

                    // Faster "tiny" batches by reducing wait if we have strong limit remaining
                    const sleepTime = remaining > 50 ? 50 : 250;
                    await new Promise(r => setTimeout(r, sleepTime));
                }
            }

            console.log(`✅ ========================================`);
            console.log(`✅ CONTACT SYNC COMPLETED: ${totalSynced} records reconciled`);
            console.log(`✅ ========================================`);
            updateSyncStatus('completed', '');

            // --- DEAL SYNC PHASE ---
            console.log('💰 STARTING DEAL SYNC...');
            let totalDealsSynced = 0;
            let dealBatchCount = 0;
            let dealAfter = null;

            while (true) {
                dealBatchCount++;
                // Fetch deals with contact associations and attribution fields
                const dealUrl = `https://api.hubapi.com/crm/v3/objects/deals?limit=100&associations=contacts&properties=dealname,amount,dealstage,pipeline,closedate,createdate,hs_analytics_source,hs_analytics_source_data_1,hs_analytics_source_data_2,dealtype,description,hs_lastmodifieddate,hs_is_closed,hs_is_closed_won,hs_is_closed_lost`;
                const url = dealAfter ? `${dealUrl}&after=${dealAfter}` : dealUrl;

                console.log(`📡 Deal Batch ${dealBatchCount}: Fetching deals...`);
                
                const response = await requestWithRetry(
                    () => axios.get(url, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        timeout: REQUEST_TIMEOUT_MS,
                    }),
                    'Fetch deals'
                );

                const data = response.data;
                const deals = (data.results || []).map(d => {
                    // Extract primary associated contact ID
                    const contactId = d.associations?.contacts?.results?.[0]?.id || null;
                    return {
                        id: d.id,
                        dealname: d.properties.dealname,
                        amount: d.properties.amount,
                        dealstage: d.properties.dealstage,
                        pipeline: d.properties.pipeline,
                        closedate: d.properties.closedate,
                        last_modified: d.properties.hs_lastmodifieddate, // Mapped for ghost detection
                        contactId: contactId, // Direct ID for saveDeals
                        // Fallback fields if no contact association
                        leadSource: d.properties.hs_analytics_source,
                        firstForm: d.properties.hs_analytics_source_data_2,
                        properties: d.properties
                    };
                });

                if (deals.length > 0) {
                    const { saveDeals } = await import('./dataService.js');
                    await saveDeals(deals);
                    totalDealsSynced += deals.length;
                    console.log(`💰 Saved ${deals.length} deals (Total: ${totalDealsSynced})`);
                }

                if (!data.paging || !data.paging.next || !data.paging.next.after) {
                    break;
                }
                dealAfter = data.paging.next.after;
                await new Promise(r => setTimeout(r, 100));
            }
            
            console.log(`✅ DEAL SYNC COMPLETED: ${totalDealsSynced} deals synced`);
            updateSyncStatus('completed', '');
        } catch (e) {
            const responseData = e.response?.data;
            const status = e.response?.status;
            const statusText = e.response?.statusText;
            const code = e.code;
            const url = e.config?.url;
            const errorParts = [];
            if (status) errorParts.push(`HTTP ${status}`);
            if (statusText) errorParts.push(statusText);
            if (code) errorParts.push(`code=${code}`);
            if (url) errorParts.push(`url=${url}`);
            if (responseData?.message) errorParts.push(responseData.message);
            if (responseData?.error) errorParts.push(responseData.error);
            if (responseData?.correlationId) errorParts.push(`correlationId=${responseData.correlationId}`);
            if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
                errorParts.push(`details=${responseData.errors.map(err => err.message || JSON.stringify(err)).join(' | ')}`);
            }
            const errorMessage = errorParts.length > 0
                ? errorParts.join(' · ')
                : (e.message || 'Unknown sync error');
            console.error('❌ ========================================');
            console.error('❌ SYNC FAILED:');
            console.error('❌ Error:', errorMessage);
            console.error('❌ Response:', e.response?.data);
            updateSyncStatus('failed', errorMessage);
        } finally {
            console.log(`🏁 Sync process ended. Setting isSyncing = false`);
            isSyncing = false;
        }
    })();

    return { message: 'Intelligent sync initiated in background' };
};
