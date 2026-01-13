import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { getApiUrl } from '../services/config';
import { hubSpotService } from '../services/hubspotService';

const SyncStatus: React.FC = () => {
    const [status, setStatus] = useState<{ count: number, status: string }>({ count: 0, status: 'idle' });
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const lastStatusRef = useRef<string>('idle');

    const checkStatus = async () => {
        try {
            const apiUrl = getApiUrl('/api/sync/status');
            console.log('🔍 Checking sync status at:', apiUrl);
            const resp = await fetch(apiUrl);
            if (resp.ok) {
                const data = await resp.json();
                setStatus(data);
                setIsSyncing(data.status === 'syncing');
                setHasFailed(data.status === 'failed');
                setErrorMessage(data.error || '');
                if (lastStatusRef.current === 'syncing' && data.status === 'completed') {
                    window.dispatchEvent(new CustomEvent('lead_mirror_synced'));
                }
                if (lastStatusRef.current === 'syncing' && data.status === 'failed') {
                    window.dispatchEvent(new CustomEvent('lead_mirror_synced'));
                }
                lastStatusRef.current = data.status;
            }
        } catch (e) {
            console.error("Sync status check failed", e);
        }
    };

    const startSync = async () => {
        let token = localStorage.getItem('hubspot_access_token') || '';
        const expiresAt = Number(localStorage.getItem('hubspot_expires_at') || 0);
        const isExpiring = expiresAt > 0 && Date.now() > expiresAt - 60_000;

        if (!token || isExpiring) {
            const refreshed = await hubSpotService.refreshAccessToken();
            token = localStorage.getItem('hubspot_access_token') || '';
            if (!refreshed || !token) {
                token = '';
            }
        }

        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
            const resp = await fetch(getApiUrl('/api/sync/start'), {
                method: 'POST',
                headers
            });
            if (!resp.ok && resp.status === 401) {
                const refreshed = await hubSpotService.refreshAccessToken();
                token = localStorage.getItem('hubspot_access_token') || '';
                if (refreshed && token) {
                    const retry = await fetch(getApiUrl('/api/sync/start'), {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!retry.ok) {
                        const message = await retry.text();
                        console.error("Sync start failed:", message);
                        setHasFailed(true);
                        setErrorMessage(message || 'Sync start failed.');
                        return;
                    }
                } else {
                    const retry = await fetch(getApiUrl('/api/sync/start'), {
                        method: 'POST'
                    });
                    if (!retry.ok) {
                        const message = await retry.text();
                        console.error("Sync start failed:", message);
                        setHasFailed(true);
                        setErrorMessage(message || 'Sync start failed.');
                        return;
                    }
                }
            } else if (!resp.ok) {
                const message = await resp.text();
                console.error("Sync start failed:", message);
                setHasFailed(true);
                setErrorMessage(message || 'Sync start failed.');
                return;
            }
            setIsSyncing(true);
            setHasFailed(false);
            setErrorMessage('');
            window.dispatchEvent(new CustomEvent('lead_mirror_sync_started'));
        } catch (e) {
            console.error("Sync start failed", e);
            setHasFailed(true);
            setErrorMessage('Network error starting sync.');
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, isSyncing ? 2000 : 30000);
        return () => clearInterval(interval);
    }, [isSyncing]);

    return (
        <div className="p-4 glass-card bg-slate-100 border-slate-200 mx-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Database size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Lead Mirror</span>
                </div>
                {isSyncing ? (
                    <div className="flex items-center gap-2">
                        <RefreshCw size={12} className="text-indigo-400 animate-spin" />
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">Syncing</span>
                    </div>
                ) : status.status === 'completed' ? (
                    <CheckCircle2 size={12} className="text-emerald-400" />
                ) : status.status === 'failed' || hasFailed ? (
                    <AlertTriangle size={12} className="text-rose-500" />
                ) : (
                    <AlertTriangle size={12} className="text-amber-400" />
                )}
            </div>

            <div className="space-y-2">
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ${isSyncing ? 'animate-pulse bg-indigo-500' : status.status === 'failed' || hasFailed ? 'bg-rose-400' : 'bg-indigo-500'}`}
                        style={{ width: `${status.status === 'completed' ? 100 : isSyncing ? 40 : status.status === 'failed' || hasFailed ? 100 : 10}%` }}
                    ></div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-bold">
                        {status.count.toLocaleString()} Leads Cached
                        {status.status === 'failed' || hasFailed ? ' · Sync failed' : ''}
                    </span>
                    <button 
                        onClick={startSync}
                        disabled={isSyncing}
                        className="text-[9px] font-black text-indigo-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
                    >
                        {isSyncing ? 'Syncing...' : 'Deep Refresh'}
                    </button>
                </div>
                {hasFailed && errorMessage && (
                    <div className="text-[9px] text-rose-500 font-bold uppercase tracking-widest">
                        {errorMessage}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SyncStatus;
