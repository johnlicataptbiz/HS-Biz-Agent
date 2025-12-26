import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Segment } from '../types';
import { Users, RefreshCw, Sparkles, ShieldCheck, List, UserCheck, UserX, Clock } from 'lucide-react';
import AiModal from '../components/AiModal';

const Contacts: React.FC = () => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [contactHealth, setContactHealth] = useState({
    totalScanned: 0,
    unclassified: 0,
    unassigned: 0,
    inactive: 0,
    healthScore: 0
  });
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
        const [segmentData, healthData] = await Promise.all([
          hubSpotService.fetchSegments(),
          hubSpotService.scanContactOrganization()
        ]);
        setSegments(segmentData);
        setContactHealth(healthData);
      } catch (e) {
        console.error("Data fetch error:", e);
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.3em]">Organization Engine</span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Lists & <span className="gradient-text">Contacts.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Audit your contact database health and segment organization.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={loadData}
            className="p-3 glass-button border-white/5 text-slate-400 hover:text-white transition-all active:scale-90"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAi(true)}
            className="px-8 py-3 premium-gradient text-white rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Clean Up Contacts
          </button>
        </div>
      </div>

      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                 <ShieldCheck className="text-amber-400" size={32} />
             </div>
             <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-white uppercase tracking-wider">Connect Required</h3>
                 <p className="text-slate-400 mt-2 font-medium">Connect your HubSpot instance to analyze your contact database.</p>
             </div>
         </div>
      )}

      {/* Contact Health Summary */}
      {isConnected && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">Contact Health Scan</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="glass-card p-6 text-center border-2 border-amber-500/20">
              <p className="text-4xl font-extrabold text-amber-400">{contactHealth.healthScore}%</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Health Score</p>
            </div>
            <div className="glass-card p-6 text-center">
              <p className="text-3xl font-extrabold text-white">{contactHealth.totalScanned}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Scanned</p>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <UserX size={20} className="text-rose-400" />
                <p className="text-3xl font-extrabold text-rose-400">{contactHealth.unclassified}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">No Lifecycle</p>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <UserCheck size={20} className="text-amber-400" />
                <p className="text-3xl font-extrabold text-amber-400">{contactHealth.unassigned}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">No Owner</p>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock size={20} className="text-slate-400" />
                <p className="text-3xl font-extrabold text-slate-400">{contactHealth.inactive}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Inactive 6mo+</p>
            </div>
          </div>
        </div>
      )}

      {/* Lists/Segments */}
      {isConnected && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Active Lists</h2>
            <span className="text-sm text-slate-400">{segments.length} lists found</span>
          </div>
          
          {segments.length === 0 && !isLoading && (
            <div className="glass-card p-12 text-center">
              <List className="mx-auto text-slate-400 mb-4" size={40} />
              <p className="text-slate-400">No lists found in your portal.</p>
            </div>
          )}

          {segments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {segments.slice(0, 12).map((seg) => (
                <div key={seg.id} className="glass-card p-6 hover:-translate-y-1 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <List size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate group-hover:text-indigo-400 transition-colors">{seg.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{seg.contactCount.toLocaleString()} contacts</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          seg.isDynamic ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                        }`}>
                          {seg.isDynamic ? 'Dynamic' : 'Static'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {segments.length > 12 && (
            <p className="text-center text-slate-400 text-sm">
              Showing 12 of {segments.length} lists
            </p>
          )}
        </div>
      )}

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="workflow"
        contextName="Contact Organization"
      />
    </div>
  );
};

export default Contacts;
