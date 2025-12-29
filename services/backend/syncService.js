import axios from 'axios';
import { saveContacts, updateSyncStatus, getLastSyncTime } from './dataService.js';

let isSyncing = false;

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
            let totalSynced = 0;
            const limit = 100;
            let batchCount = 0;
            
            console.log(lastSyncTime 
                ? `🔄 Starting Delta Sync (Last Sync: ${lastSyncTime})` 
                : '🚀 Starting Full CRM Deep Sync...'
            );

            // Use Search API for Delta Sync if possible
            if (lastSyncTime) {
                let after = null;
                while (true) {
                    const searchUrl = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
                    const response = await axios.post(searchUrl, {
                        filterGroups: [
                            {
                                filters: [
                                    {
                                        propertyName: 'lastmodifieddate',
                                        operator: 'GT',
                                        value: new Date(lastSyncTime).getTime()
                                    }
                                ]
                            }
                        ],
                        properties: [
                            'email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle',
                            'lifecyclestage', 'hubspot_owner_id', 'hs_lead_status',
                            'hs_analytics_source', 'hs_analytics_source_data_1', 'hs_analytics_source_data_2',
                            'hs_analytics_num_page_views', 'hs_analytics_num_visits', 'hs_analytics_last_visit_timestamp',
                            'num_associated_deals', 'notes_last_updated', 'hs_email_last_open_date',
                            'hs_email_bounce', 'num_conversion_events', 'associatedcompanyid',
                            'createdate', 'lastmodifieddate'
                        ],
                        limit: limit,
                        after: after
                    }, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

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
            } else {
                // Initial Full Sync using standard pagination (more reliable for first pull)
                let after = null;
                const properties = [
                    'email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle',
                    'lifecyclestage', 'hubspot_owner_id', 'hs_lead_status',
                    'hs_analytics_source', 'hs_analytics_source_data_1', 'hs_analytics_source_data_2',
                    'hs_analytics_num_page_views', 'hs_analytics_num_visits', 'hs_analytics_last_visit_timestamp',
                    'num_associated_deals', 'notes_last_updated', 'hs_email_last_open_date',
                    'hs_email_bounce', 'num_conversion_events', 'associatedcompanyid',
                    'createdate', 'lastmodifieddate'
                ].join(',');
                
                while (true) {
                    batchCount++;
                    const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}${after ? `&after=${after}` : ''}&properties=${properties}`;
                    
                    console.log(`📡 Batch ${batchCount}: Fetching ${limit} contacts${after ? ` (after: ${after})` : ' (initial)'}...`);
                    
                    const response = await axios.get(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

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
            console.log(`✅ SYNC COMPLETED: ${totalSynced} records reconciled in ${batchCount} batches`);
            console.log(`✅ ========================================`);
            updateSyncStatus('completed');
        } catch (e) {
            console.error('❌ ========================================');
            console.error('❌ SYNC FAILED:');
            console.error('❌ Error:', e.message);
            console.error('❌ Response:', e.response?.data);
            console.error('❌ Stack:', e.stack);
            console.error('❌ ========================================');
            updateSyncStatus('failed');
        } finally {
            console.log(`🏁 Sync process ended. Setting isSyncing = false`);
            isSyncing = false;
        }
    })();

    return { message: 'Intelligent sync initiated in background' };
};
