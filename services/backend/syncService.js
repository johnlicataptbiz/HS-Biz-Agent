import axios from 'axios';
import { saveContacts, updateSyncStatus } from './dataService.js';

let isSyncing = false;

export const startBackgroundSync = async (token) => {
    if (isSyncing) return { message: 'Sync already in progress' };
    
    isSyncing = true;
    updateSyncStatus('syncing');

    // Run in background
    (async () => {
        try {
            let after = null;
            let totalSynced = 0;
            const limit = 100;

            console.log('🚀 Starting CRM Deep Sync...');

            while (true) {
                const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}${after ? `&after=${after}` : ''}&properties=email,firstname,lastname,lifecyclestage,hubspot_owner_id`;
                
                const response = await axios.get(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = response.data;
                if (!data.results || data.results.length === 0) break;

                await saveContacts(data.results);
                totalSynced += data.results.length;
                console.log(`📦 Synced ${totalSynced} contacts...`);

                if (!data.paging || !data.paging.next || !data.paging.next.after) {
                    break;
                }
                after = data.paging.next.after;

                // Simple rate limiting safety
                await new Promise(r => setTimeout(r, 200));
            }

            console.log(`✅ Deep Sync Completed: ${totalSynced} contacts added/updated.`);
            updateSyncStatus('completed');
        } catch (e) {
            console.error('❌ Sync Failed:', e.message);
            updateSyncStatus('failed');
        } finally {
            isSyncing = false;
        }
    })();

    return { message: 'Deep sync initiated in background' };
};
