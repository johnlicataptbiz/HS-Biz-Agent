import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Workflow } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, MoreHorizontal, RefreshCw, GitFork, Zap, Activity, ShieldCheck, Database } from 'lucide-react';
import AiModal from '../components/AiModal';

const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWf, setSelectedWf] = useState<Workflow | null>(null);
  const [showGeneralAi, setShowGeneralAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

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
        const realData = await hubSpotService.fetchWorkflows();
        setWorkflows(realData);
      } catch (e) {
        console.error("Workflow fetch error:", e);
        setWorkflows([]);
      }
    } else {
      setWorkflows([]);
    }
    setIsLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (score === 0) return 'text-slate-400 bg-white/5 border-white/10';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Operational Logic</span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Automation <span className="gradient-text">Workflows.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Architectural oversight of your business logic. identifies stall points and unoptimized branch paths.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            id="refresh-logic-btn"
            onClick={loadData}
            className="p-3 glass-button border-white/5 text-slate-400 hover:text-white transition-all active:scale-90"
            title="Refresh Logic Sync"
            aria-label="Refresh workflows from HubSpot"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button 
            id="architect-flow-btn"
            onClick={() => setShowGeneralAi(true)}
            aria-label="Architect new flow with AI"
            className="px-8 py-3 premium-gradient text-white rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Architect New Flow
          </button>
        </div>
      </div>

      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
                <ShieldCheck className="text-indigo-400" size={32} />
            </div>
            <div className="max-w-md mx-auto">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider">Sync Required</h3>
                <p className="text-slate-400 mt-2 font-medium">Connect your HubSpot instance to visualize and optimize your active automation workflows.</p>
            </div>
         </div>
      )}

      {isConnected && workflows.length === 0 && !isLoading && (
        <div className="glass-card p-20 text-center space-y-6">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                <GitFork className="text-slate-400" size={40} />
            </div>
            <div className="max-w-md mx-auto">
                <h3 className="text-2xl font-bold text-white tracking-tight">Zero Logic Detected</h3>
                <p className="text-slate-400 mt-3 font-medium text-sm leading-relaxed">
                  We scanned for workflows but found an empty registry. Check your HubSpot App permissions for <span className="text-indigo-400 font-bold uppercase tracking-widest text-[10px]">automation</span> scopes.
                </p>
                <div className="pt-8">
                   <button onClick={loadData} className="px-6 py-2 glass-button text-xs font-bold text-slate-300 hover:text-white">Heuristic Rerun</button>
                </div>
            </div>
        </div>
      )}

      {workflows.length > 0 && (
        <div className="glass-card overflow-hidden border-white/5 shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase text-slate-400 font-extrabold tracking-[0.2em]">
                <th className="px-8 py-6">Architectural Node</th>
                <th className="px-8 py-6">Object Model</th>
                <th className="px-8 py-6">Volume</th>
                <th className="px-8 py-6 text-center">AI Audit</th>
                <th className="px-8 py-6">Operational Status</th>
                <th className="px-8 py-6 text-right">Optimization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-white group-hover:text-indigo-400 transition-colors text-base tracking-tight">{wf.name}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-bold tracking-widest uppercase">Node ID: {wf.id}</div>
                  </td>
                  <td className="px-8 py-6">
                      <div className="flex items-center gap-2 py-1.5 px-3 bg-white/5 rounded-xl border border-white/5 w-fit">
                        <Database size={12} className="text-indigo-400" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-widest">
                            {wf.objectType}
                        </span>
                      </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-bold text-slate-300 tracking-tight">
                    <div className="flex items-center gap-2">
                        <Activity size={12} className="text-slate-400" />
                        {wf.enrolledCount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest ${getScoreColor(wf.aiScore)} shadow-sm`}>
                          {wf.aiScore === 0 ? <RefreshCw size={14} className="text-slate-400" /> : (wf.aiScore < 80 ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />)}
                          {wf.aiScore === 0 ? 'PENDING' : `${wf.aiScore}%`}
                        </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${wf.enabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}></div>
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${wf.enabled ? 'text-white' : 'text-slate-400'}`}>
                            {wf.enabled ? 'Active Logic' : 'Standby'}
                          </span>
                      </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                          onClick={() => setSelectedWf(wf)}
                          className="px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all text-[10px] font-extrabold uppercase tracking-widest border border-indigo-500/20 active:scale-95 flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20"
                      >
                          <Sparkles size={14} />
                          Analyze
                      </button>
                      <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors" title="More Options">
                          <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AiModal 
        isOpen={!!selectedWf} 
        onClose={() => setSelectedWf(null)} 
        contextType="workflow"
        contextId={selectedWf?.id}
        contextName={selectedWf?.name}
      />
      
      <AiModal 
        isOpen={showGeneralAi} 
        onClose={() => setShowGeneralAi(false)} 
        contextType="workflow"
        contextName="All Workflows"
      />
    </div>
  );
};

export default Workflows;