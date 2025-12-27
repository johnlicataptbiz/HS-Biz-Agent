import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Pipeline, Lead, LeadStatus } from '../types';
import { RefreshCw, TrendingUp, AlertTriangle, ArrowRight, GitCommit, Target, Sparkles, ShieldCheck } from 'lucide-react';
import AiModal from '../components/AiModal';

const Pipelines: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [leadStatusBreakdown, setLeadStatusBreakdown] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [auditPrompt, setAuditPrompt] = useState('');

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
        const [pipelineData, leadData, dealData, contactScan] = await Promise.all([
            hubSpotService.fetchPipelines('deals'),
            hubSpotService.fetchLeads(),
            hubSpotService.fetchDeals(),
            hubSpotService.scanContactOrganization()
        ]);
        setPipelines(pipelineData);
        setLeads(leadData);
        setDeals(dealData);
        setLeadStatusBreakdown(contactScan.statusBreakdown as any);
      } catch (e) {
        console.error("Journey fetch error:", e);
      }
    }
    setIsLoading(false);
  };

  const activeLeads = leads.filter(l => l.stage !== 'Disqualified' && l.stage !== 'Qualified').length;
  
  // Calculate conversion proxy (simple heuristic)
  const totalContacts = Object.values(leadStatusBreakdown).reduce((a, b) => a + b, 0);
  const hotLeads = leadStatusBreakdown['Hot'] || 0;
  const leadConversionRate = hotLeads > 0 ? Math.round((activeLeads / hotLeads) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-slate-500'}`}></div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.3em]">Revenue Architecture</span>
            </div>
            <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
                Customer <span className="gradient-text">Journey.</span>
            </h1>
            <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
                Visualize the complete path from anonymous contact to closed revenue. Identify drop-offs and architectural weaknesses.
            </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={loadData}
            className="p-3 glass-button border-white/5 text-slate-400 hover:text-white transition-all active:scale-90"
            title="Refresh Journey Data"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
          <button 
            onClick={() => {
                setAuditPrompt(
                    `Analyze this Sales Journey for efficiency:\n\n` +
                    `1. TOP OF FUNNEL: ${leadStatusBreakdown['New']} New Contacts, ${leadStatusBreakdown['Hot']} Hot Leads.\n` +
                    `2. MID FUNNEL (Prospecting): ${leads.length} Active Leads in Prospecting Workspace.\n` +
                    `3. BOTTOM FUNNEL (Deals): ${pipelines.map(p => p.stages.length).join(', ')} Deal Stages defined.\n\n` +
                    `Identifying the "Black Hole": Where are we losing the most value?\n` +
                    `Propose a 3-step automation plan to fix the gap.`
                );
                setShowAi(true);
            }}
            title="Audit Revenue Flow"
            className="px-8 py-3 premium-gradient text-white rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Audit Flow
          </button>
        </div>
      </div>

       {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                 <ShieldCheck className="text-rose-400" size={32} />
             </div>
             <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-white uppercase tracking-wider">Sync Required</h3>
                 <p className="text-slate-400 mt-2 font-medium">Connect Sales Hub to visualize your revenue pipeline architecture.</p>
             </div>
         </div>
      )}

      {isConnected && (
        <div className="space-y-8">
            {/* The Great Flow Diagram */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch h-full">
                
                {/* 1. CONTACTS (Source) */}
                <div className="flex-1 glass-card p-6 flex flex-col relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                     <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                            <Target size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source</span>
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-1">Cold Contacts</h3>
                     <p className="text-slate-400 text-sm mb-6">Unqualified database records</p>
                     
                     <div className="mt-auto space-y-3">
                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <span className="text-sm font-bold text-slate-300">New</span>
                            <span className="text-sm font-bold text-white">{leadStatusBreakdown['New'] || 0}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <span className="text-sm font-bold text-slate-300">Nurture</span>
                            <span className="text-sm font-bold text-white">{leadStatusBreakdown['Nurture'] || 0}</span>
                        </div>
                     </div>
                     
                     {/* Connector */}
                     <div className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 text-slate-600">
                        <ArrowRight size={24} />
                     </div>
                </div>

                {/* 2. LEADS (Prospecting) */}
                <div className="flex-1 glass-card p-6 flex flex-col relative overflow-hidden ring-1 ring-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
                     <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest animate-pulse">Active Focus</span>
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-1">Prospecting</h3>
                     <p className="text-slate-400 text-sm mb-6">Qualified leads being worked</p>

                     <div className="mt-auto space-y-3">
                        <div className="flex justify-between items-center bg-rose-500/20 border border-rose-500/20 p-3 rounded-lg">
                            <span className="text-sm font-bold text-white">Hot Leads</span>
                            <span className="text-sm font-bold text-white">{leadStatusBreakdown['Hot'] || 0}</span>
                        </div>
                         <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <span className="text-sm font-bold text-slate-300">Sales Objects</span>
                            <span className="text-sm font-bold text-white">{leads.length}</span>
                        </div>
                     </div>
                     
                      {/* Connector */}
                     <div className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-20 text-slate-600">
                        <ArrowRight size={24} />
                     </div>
                </div>

                {/* 3. DEALS (Pipeline) */}
                <div className="flex-[1.5] glass-card p-6 flex flex-col relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                     <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <GitCommit size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opportunity</span>
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-1">Deal Pipelines</h3>
                     <p className="text-slate-400 text-sm mb-6">Revenue opportunities in flight</p>

                      <div className="mt-auto overflow-y-auto max-h-[300px] pr-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                         {pipelines.length === 0 ? (
                             <div className="text-center p-4 border border-dashed border-white/10 rounded-lg text-slate-500 text-xs">No Deployment</div>
                         ) : pipelines.map(p => {
                            const pipelineDeals = deals.filter(d => d.pipeline === p.id);
                            const totalAmount = pipelineDeals.reduce((acc, d) => acc + (d.amount || 0), 0);
                            
                            return (
                                <div key={p.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-indigo-500/20 transition-all">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <span className="text-xs font-black text-white uppercase tracking-wider">{p.label}</span>
                                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">${(totalAmount / 1000).toFixed(1)}k Pipeline Value</p>
                                        </div>
                                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded-lg text-indigo-400 font-bold border border-white/5">{p.stages.length} Nodes</span>
                                    </div>
                                    <div className="flex gap-1.5 h-3 w-full">
                                        {p.stages.map((s) => {
                                            const stageDeals = pipelineDeals.filter(d => d.stage === s.id);
                                            const stageAmount = stageDeals.reduce((acc, d) => acc + (d.amount || 0), 0);
                                            const intensity = totalAmount > 0 ? (stageAmount / totalAmount) : 0;
                                            
                                            return (
                                                <div 
                                                    key={s.id} 
                                                    className="h-full rounded-full transition-all group/node relative" 
                                                    style={{ 
                                                        flex: 1,
                                                        backgroundColor: intensity > 0.4 ? '#f43f5e' : (intensity > 0.1 ? '#fbbf24' : '#10b981'),
                                                        opacity: 0.3 + (intensity * 0.7),
                                                        boxShadow: intensity > 0.5 ? '0 0 10px rgba(244,63,94,0.3)' : 'none'
                                                    }}
                                                >
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-white/10 rounded text-[8px] font-bold text-white opacity-0 group-hover/node:opacity-100 whitespace-nowrap z-50 transition-opacity">
                                                        {s.label}: ${Math.round(stageAmount/1000)}k
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                         })}
                      </div>
                </div>
            </div>

            {/* Analysis Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lead Conversion</p>
                        <p className="text-2xl font-bold text-white">{leadConversionRate}%</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center">
                        <TrendingUp size={20} className={leadConversionRate > 20 ? 'text-emerald-400' : 'text-amber-400'} />
                    </div>
                </div>
                 <div className="glass-card p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pipeline Health</p>
                        <p className="text-2xl font-bold text-white">{pipelines.length > 0 ? 'Active' : 'Unconfigured'}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center">
                        <GitCommit size={20} className="text-indigo-400" />
                    </div>
                </div>
                 <div className="glass-card p-6 flex items-center justify-between border border-rose-500/30 bg-rose-500/5">
                    <div>
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Leakage Risk</p>
                        <p className="text-2xl font-bold text-white">{leadStatusBreakdown['New'] > 50 ? 'Critical' : 'Low'}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center animate-pulse">
                        <AlertTriangle size={20} className="text-rose-400" />
                    </div>
                </div>
            </div>
        </div>
      )}

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="data"
        contextName="Journey Architecture Audit"
        initialPrompt={auditPrompt}
      />
    </div>
  );
};

export default Pipelines;
