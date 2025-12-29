import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

const SyncStatus: React.FC = () => {
    const [status, setStatus] = useState<{ count: number, status: string }>({ count: 0, status: 'idle' });
    const [isSyncing, setIsSyncing] = useState(false);

    const checkStatus = async () => {
        try {
            const resp = await fetch('/api/sync');
            if (resp.ok) {
                const data = await resp.json();
                setStatus(data);
                setIsSyncing(data.status === 'syncing');
            }
        } catch (e) {
            console.error("Sync status check failed", e);
        }
    };

    const startSync = async () => {
        const token = localStorage.getItem('hubspot_access_token');
        if (!token) return;

        try {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setIsSyncing(true);
        } catch (e) {
            console.error("Sync start failed", e);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, isSyncing ? 2000 : 30000);
        return () => clearInterval(interval);
    }, [isSyncing]);

    return (
        <div className="p-4 glass-card bg-white/5 border-white/5 mx-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Database size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Lead Mirror</span>
                </div>
                {isSyncing ? (
                    <div className="flex items-center gap-2">
                        <RefreshCw size={12} className="text-indigo-400 animate-spin" />
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">Syncing</span>
                    </div>
                ) : status.status === 'completed' ? (
                    <CheckCircle2 size={12} className="text-emerald-400" />
                ) : (
                    <AlertTriangle size={12} className="text-amber-400" />
                )}
            </div>

            <div className="space-y-2">
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full bg-indigo-500 transition-all duration-1000 ${isSyncing ? 'animate-pulse' : ''}`}
                        style={{ width: `${status.status === 'completed' ? 100 : isSyncing ? 40 : 10}%` }}
                    ></div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-bold">{status.count.toLocaleString()} Leads Cached</span>
                    <button 
                        onClick={startSync}
                        disabled={isSyncing}
                        className="text-[9px] font-black text-indigo-400 hover:text-white uppercase tracking-widest transition-colors"
                    >
                        {isSyncing ? 'Syncing...' : 'Deep Refresh'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SyncStatus;
