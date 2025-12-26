import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Campaign } from '../types';
import { Megaphone, RefreshCw, Sparkles, ShieldCheck, TrendingUp, DollarSign, Users } from 'lucide-react';
import AiModal from '../components/AiModal';

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    loadData();
    window.addEventListener('hubspot_connection_changed', loadData);
    return () => window.removeEventListener('hubspot_connection_changed', loadData);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);
    
    if (validation.success) {
      try {
        const data = await hubSpotService.fetchCampaigns();
        setCampaigns(data);
      } catch (e) {
        console.error("Campaign fetch error:", e);
        setCampaigns([]);
      }
    } else {
      setCampaigns([]);
    }
    setIsLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'PAUSED': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'COMPLETED': return 'text-slate-400 bg-white/5 border-white/10';
      default: return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.3em]">Marketing Intelligence</span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Campaign <span className="gradient-text">Focus.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Monitor campaign performance and ROI across your marketing stack.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={loadData}
            className="p-3 glass-button border-white/5 text-slate-400 hover:text-white transition-all active:scale-90"
            title="Refresh Campaigns"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAi(true)}
            className="px-8 py-3 premium-gradient text-white rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Plan New Campaign
          </button>
        </div>
      </div>

      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                 <ShieldCheck className="text-rose-400" size={32} />
             </div>
             <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-white uppercase tracking-wider">Marketing Hub Required</h3>
                 <p className="text-slate-400 mt-2 font-medium">Connect your HubSpot instance with Marketing Hub to view campaigns.</p>
             </div>
         </div>
      )}

      {/* Summary Stats */}
      {isConnected && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-white">{campaigns.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Total Campaigns</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-emerald-400">
              {campaigns.filter(c => c.status?.toUpperCase() === 'ACTIVE').length}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Active</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-amber-400">
              {Math.round(campaigns.reduce((acc, c) => acc + c.aiScore, 0) / campaigns.length)}%
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Avg Score</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-rose-400">
              {campaigns.filter(c => c.status?.toUpperCase() === 'COMPLETED').length}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Completed</p>
          </div>
        </div>
      )}

      {isConnected && campaigns.length === 0 && !isLoading && (
        <div className="glass-card p-20 text-center space-y-6">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                <Megaphone className="text-slate-400" size={40} />
            </div>
            <div className="max-w-md mx-auto">
                <h3 className="text-2xl font-bold text-white tracking-tight">No Campaigns Found</h3>
                <p className="text-slate-400 mt-3 font-medium text-sm leading-relaxed">
                  No marketing campaigns were detected. Create campaigns in HubSpot Marketing Hub to see them here.
                </p>
            </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {campaigns.map((camp) => (
            <div key={camp.id} className="glass-card p-8 group hover:-translate-y-1 transition-all duration-500 border-white/5 hover:border-rose-500/20">
               <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                       <Megaphone size={24} />
                   </div>
                   <div>
                       <h3 className="text-lg font-bold text-white group-hover:text-rose-400 transition-colors">{camp.name}</h3>
                       <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">ID: {camp.id}</p>
                   </div>
                 </div>
               </div>

               <div className="space-y-4 mb-6">
                 <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Status</span>
                    <span className={`px-3 py-1 rounded-lg border ${getStatusColor(camp.status)}`}>{camp.status || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">AI Score</span>
                    <span className="text-white">{camp.aiScore}%</span>
                 </div>
               </div>

               <div className="pt-6 border-t border-white/5">
                 <button className="w-full py-3 glass-button text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-500/10 transition-all">
                   <TrendingUp size={14} />
                   View Analytics
                 </button>
               </div>
            </div>
          ))}
        </div>
      )}

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="workflow"
        contextName="Marketing Campaigns"
      />
    </div>
  );
};

export default Campaigns;
