import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Workflow } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, MoreHorizontal, RefreshCw, GitFork, Zap, Activity, ShieldCheck, Database } from 'lucide-react';
import AiModal from '../components/AiModal';
import Pagination from '../components/Pagination';

const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWf, setSelectedWf] = useState<Workflow | null>(null);
  const [showGeneralAi, setShowGeneralAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [fixPrompt, setFixPrompt] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    loadData();
    window.addEventListener('hubspot_connection_changed', loadData);
    return () => window.removeEventListener('hubspot_connection_changed', loadData);
  }, []);

  const openFixModal = (wf: Workflow) => {
    const issueText = wf.issues && wf.issues.length > 0 ? wf.issues.join(', ') : 'this workflow';
    console.log("Opening fix for:", issueText);
    setFixPrompt(
      `Perform a deep node-level simulation for the workflow "${wf.name}" (Issue: ${issueText}). ` +
      `Analyze the execution path to identify logic bottlenecks or circular branches. ` +
      `Provide a concise strategy to modernize this flow and return a workflow_spec with YAML/JSON definitions. ` +
      `If architectural debt is found, include spec.apiCalls for remedial HubSpot actions.`
    );
    setSelectedWf(wf);
  };

  const loadData = async () => {
    setIsLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);
    
    if (validation.success) {
      try {
        const realData = await hubSpotService.fetchWorkflows();
        setWorkflows(realData);
        setPage(1);
      } catch (e) {
        console.error("Workflow fetch error:", e);
        setWorkflows([]);
      }
    } else {
      setWorkflows([]);
    }
    setIsLoading(false);
  };

  const total = workflows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedWorkflows = workflows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (score === 0) return 'text-slate-600 bg-slate-100 border-slate-200';
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
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Automation <span className="gradient-text">Workflows.</span>
          </h1>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            Architectural oversight of your business logic. identifies stall points and unoptimized branch paths.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            id="refresh-logic-btn"
            onClick={loadData}
            className="p-3 glass-button border-slate-200 text-slate-600 hover:text-slate-900 transition-all active:scale-90"
            title="Refresh Logic Sync"
            aria-label="Refresh workflows from HubSpot"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button 
            id="draft-workflow-btn"
            onClick={() => setShowGeneralAi(true)}
            aria-label="Architect new flow with AI"
            className="px-8 py-3 premium-gradient text-slate-900 rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
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
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">Sync Required</h3>
                <p className="text-slate-600 mt-2 font-medium">Connect your HubSpot instance to visualize and optimize your active automation workflows.</p>
            </div>
         </div>
      )}

      {isConnected && workflows.length === 0 && !isLoading && (
        <div className="glass-card p-20 text-center space-y-6">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto border border-slate-200">
                <GitFork className="text-slate-600" size={40} />
            </div>
            <div className="max-w-md mx-auto">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Zero Logic Detected</h3>
                <p className="text-slate-600 mt-3 font-medium text-sm leading-relaxed">
                  We scanned for workflows but found an empty registry. Check your HubSpot App permissions for <span className="text-indigo-400 font-bold uppercase tracking-widest text-[10px]">automation</span> scopes.
                </p>
                <div className="pt-8">
                   <button onClick={loadData} className="px-6 py-2 glass-button text-xs font-bold text-slate-300 hover:text-slate-900">Heuristic Rerun</button>
                </div>
            </div>
        </div>
      )}

	      {workflows.length > 0 && (
	        <div id="workflows-table" className="glass-card overflow-hidden border-slate-200 shadow-2xl">
	          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase text-slate-600 font-extrabold tracking-[0.2em]">
                <th className="px-8 py-6">Architectural Node</th>
                <th className="px-8 py-6">Object Model</th>
                <th className="px-8 py-6">Volume</th>
                <th className="px-8 py-6 text-center">AI Audit</th>
                <th className="px-8 py-6">Operational Status</th>
                <th className="px-8 py-6 text-right">Optimization</th>
              </tr>
	            </thead>
	            <tbody className="divide-y divide-white/5">
	              {pagedWorkflows.map((wf) => (
	                <tr key={wf.id} className="hover:bg-slate-100 transition-all group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-900 group-hover:text-indigo-400 transition-colors text-base tracking-tight">{wf.name}</div>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">Node ID: {wf.id}</div>
                        {wf.issues && wf.issues.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {wf.issues.map((issue, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        <AlertCircle size={8} />
                                        {issue}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                      <div className="flex items-center gap-2 py-1.5 px-3 bg-slate-100 rounded-xl border border-slate-200 w-fit">
                        <Database size={12} className="text-indigo-400" />
                        <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-widest">
                            {wf.objectType}
                        </span>
                      </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-bold text-slate-300 tracking-tight">
                    <div className="flex items-center gap-2">
                        <Activity size={12} className="text-slate-600" />
                        {wf.enrolledCount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest ${getScoreColor(wf.aiScore)} shadow-sm`}>
                          {wf.aiScore === 0 ? <RefreshCw size={14} className="text-slate-600" /> : (wf.aiScore < 80 ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />)}
                          {wf.aiScore === 0 ? 'PENDING' : `${wf.aiScore}%`}
                        </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${wf.enabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}></div>
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${wf.enabled ? 'text-slate-900' : 'text-slate-600'}`}>
                            {wf.enabled ? 'Active Logic' : 'Standby'}
                          </span>
                      </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {wf.issues && wf.issues.length > 0 ? (
                           <button 
                             onClick={() => openFixModal(wf)}
                             className="px-4 py-2 bg-rose-500 text-slate-900 hover:bg-rose-600 rounded-xl transition-all text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-rose-500/20 active:scale-95 flex items-center gap-2 animate-pulse"
                           >
                               <Sparkles size={14} />
                               Fix Issue
                           </button>
                      ) : (
                          <button 
                              onClick={() => {
                                  setFixPrompt('');
                                  setSelectedWf(wf);
                              }}
                              className="px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-slate-900 rounded-xl transition-all text-[10px] font-extrabold uppercase tracking-widest border border-indigo-500/20 active:scale-95 flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20"
                          >
                              <Sparkles size={14} />
                              Analyze
                          </button>
                      )}
                      
                      <button className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors" title="More Options">
                          <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
	                </tr>
	              ))}
	            </tbody>
	          </table>
              <div className="p-6 border-t border-slate-200">
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  totalItems={total}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
              </div>
	        </div>
	      )}

      <AiModal 
        isOpen={!!selectedWf} 
        onClose={() => setSelectedWf(null)} 
        contextType="workflow"
        contextId={selectedWf?.id}
        contextName={selectedWf?.name}
        initialPrompt={fixPrompt}
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
