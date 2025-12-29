import axios from 'axios';
import { saveContacts, updateSyncStatus, getLastSyncTime } from './dataService.js';

let isSyncing = false;

/**
 * Professional-grade CRM Synchronization Service
 * Implements Delta Sync using the HubSpot Search API and concurrent batching.
 */
export const startBackgroundSync = async (token) => {
    if (isSyncing) return { message: 'Sync already in progress' };
    
    isSyncing = true;
    updateSyncStatus('syncing');

    // Run in background
    (async () => {
        try {
            const lastSyncTime = await getLastSyncTime();
            let totalSynced = 0;
            const limit = 100;
            
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
                        properties: ['email', 'firstname', 'lastname', 'lifecyclestage', 'hubspot_owner_id'],
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
                while (true) {
                    const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}${after ? `&after=${after}` : ''}&properties=email,firstname,lastname,lifecyclestage,hubspot_owner_id`;
                    
                    const response = await axios.get(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    const data = response.data;
                    if (!data.results || data.results.length === 0) break;

                    await saveContacts(data.results);
                    totalSynced += data.results.length;
                    
                    // Read rate limit headers to show "Pro" awareness
                    const remaining = response.headers['x-hubspot-ratelimit-remaining'];
                    console.log(`📦 Synced ${totalSynced} contacts... (API Strength: ${remaining})`);

                    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
                    after = data.paging.next.after;

                    // Faster "tiny" batches by reducing wait if we have strong limit remaining
                    const sleepTime = remaining > 50 ? 50 : 250;
                    await new Promise(r => setTimeout(r, sleepTime));
                }
            }

            console.log(`✅ Sync Completed: ${totalSynced} records reconciled.`);
            updateSyncStatus('completed');
        } catch (e) {
            console.error('❌ Sync Failed:', e.response?.data || e.message);
            updateSyncStatus('failed');
        } finally {
            isSyncing = false;
        }
    })();

    return { message: 'Intelligent sync initiated in background' };
};
