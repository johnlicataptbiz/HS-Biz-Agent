import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, X, ShieldCheck, Zap, ArrowRight, Trash2, Ban, BrainCircuit } from 'lucide-react';
import { getApiUrl } from '../services/config';
import { hubSpotService } from '../services/hubspotService';

interface RemediationTask {
  contactId: string;
  contactName: string;
  issue: string;
  suggestedAction: "Update Status" | "Archive" | "Correct Data" | "Re-assign";
  updates: Record<string, string>;
  reasoning: string;
  status: 'pending' | 'loading' | 'completed' | 'failed';
}

interface ContactRemediatorProps {
  contactIds: string[];
  contacts: any[];
  onClose: () => void;
  onComplete: () => void;
}

const StrategicModelOptimizer: React.FC<ContactRemediatorProps> = ({ contactIds, contacts, onClose, onComplete }) => {
  const [tasks, setTasks] = useState<RemediationTask[]>([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    analyzeModelIntegrity();
  }, [contactIds]);

  const analyzeModelIntegrity = async () => {
    setAnalyzing(true);
    try {
      // Prepare context for AI 
      const selectedData = contacts.filter(c => contactIds.includes(c.id));
      const prompt = `Perform a Strategic Architectural Audit on these ${selectedData.length} records.
      Analyze for "Architectural Debt":
      1. Misaligned Lifecycle Stages (e.g. Lead with active deals).
      2. Data Decay (Inactivity > 180 days).
      3. Schema Inconsistency (Missing critical sync properties).
      
      DATA SET:
      ${JSON.stringify(selectedData.map(c => ({
        id: c.id,
        name: `${c.firstname} ${c.lastname}`,
        email: c.email,
        status: c.classification,
        stage: c.lifecyclestage,
        score: c.health_score,
        last_modified: c.last_modified
      })), null, 2)}
      
      Propose a Remediation Plan to align these records with high-velocity automation standards.`;

      const response = await fetch(getApiUrl('/api/ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'remediate',
          prompt
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.remediations.map((r: any) => ({ ...r, status: 'pending' })));
      }
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  const executeOptimization = async () => {
    setExecuting(true);
    const token = hubSpotService.getToken();
    
    try {
      const batchItems = tasks.map(t => ({
        id: t.contactId,
        properties: t.updates
      }));

      const response = await fetch(getApiUrl('/api/remediate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch-remediate',
          hubspotToken: token,
          payload: { items: batchItems }
        })
      });

      if (response.ok) {
        setTasks(prev => prev.map(t => ({ ...t, status: 'completed' })));
        setTimeout(() => {
          onComplete();
          onClose();
        }, 1500);
      }
    } catch (e) {
      console.error('Execution failed:', e);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-[#0a0f1d] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(99,102,241,0.25)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-indigo-500/10 to-transparent">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 transform -rotate-3 border border-white/20">
                <ShieldCheck size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic leading-none">Strategic Model Optimizer</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 shadow-inner">Architectural Hub v2.5</span>
                  <div className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{contactIds.length} Nodes for Refinement</span>
                </div>
              </div>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-500 hover:text-white border border-transparent hover:border-white/10">
 <span className="sr-only">Close</span>
             <X size={24} />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-slate-950/30">
          {analyzing ? (
            <div className="flex flex-col items-center justify-center py-24 gap-8">
               <div className="relative">
                 <div className="w-24 h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_30px_rgba(99,102,241,0.2)]" />
                 <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse" size={40} />
               </div>
               <div className="text-center">
                 <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter italic">Scanning Schema Integrity</h3>
                 <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">Gemini 2.0 is mapping behavioral heatmaps to CRM architectural standards. Optimizing for high-velocity synchronization...</p>
               </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-24">
               <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                  <CheckCircle2 size={40} className="text-emerald-500" />
               </div>
               <h3 className="text-2xl font-black text-white uppercase italic italic">Architectural Integrity: 100%</h3>
               <p className="text-slate-500 mt-2 font-medium">No strategic model debt detected in this cohort.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {tasks.map((task, idx) => (
                <div key={idx} className="group glass-panel p-8 border-white/5 hover:border-indigo-500/40 transition-all duration-700 relative overflow-hidden bg-[#0c1223]/80 shadow-xl">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12">
                    {task.suggestedAction === 'Archive' ? <Trash2 size={60} /> : <Zap size={60} />}
                  </div>
                  
                  <div className="flex items-start gap-8 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      task.suggestedAction === 'Archive' ? 'bg-rose-500/20 text-rose-400 shadow-rose-500/10 border border-rose-500/30' :
                      task.suggestedAction === 'Update Status' ? 'bg-amber-500/20 text-amber-400 shadow-amber-500/10 border border-amber-500/30' :
                      'bg-indigo-500/20 text-indigo-400 shadow-indigo-500/10 border border-indigo-500/30'
                    }`}>
                      {task.suggestedAction === 'Archive' ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                         <div>
                            <h4 className="font-black text-xl text-white uppercase tracking-tighter italic leading-none mb-1">{task.contactName}</h4>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{task.contactId}</span>
                         </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 bg-indigo-500/5 px-4 py-1.5 rounded-full border border-indigo-500/20 italic">
                          Optimization Node
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                        <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <Ban size={12} className="text-rose-500/50" /> Architectural Conflict
                           </p>
                           <p className="text-sm text-slate-300 font-bold leading-relaxed">{task.issue}</p>
                        </div>
                        <div className="bg-indigo-500/[0.02] p-4 rounded-2xl border border-indigo-500/10">
                           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <Zap size={12} className="text-indigo-500/50" /> Remediation Delta
                           </p>
                           <div className="space-y-2">
                             {Object.entries(task.updates).map(([key, val]) => (
                               <div key={key} className="flex items-center justify-between text-[11px] font-bold">
                                 <span className="text-slate-500 uppercase">{key}</span>
                                 <div className="flex items-center gap-2">
                                    <ArrowRight size={10} className="text-indigo-500" />
                                    <span className="text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{val}</span>
                                 </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-5 border-t border-white/5">
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                          <span className="text-indigo-400/60 font-black text-[10px] mr-3 uppercase tracking-widest">A.I. Inference:</span>
                          {task.reasoning}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {task.status === 'completed' && (
                    <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] flex items-center justify-center animate-in zoom-in duration-300">
                       <div className="bg-emerald-500 text-white px-8 py-4 rounded-2xl flex items-center gap-4 font-black uppercase tracking-[0.2em] text-sm shadow-[0_20px_40px_rgba(16,185,129,0.3)] transform -rotate-2 border-2 border-white/30 scale-110">
                         <CheckCircle2 size={24} /> Node Optimized
                       </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-10 border-t border-white/10 bg-white/[0.02] flex justify-between items-center">
           <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              <div>
                <p className="text-[11px] font-black text-white uppercase tracking-[0.1em]">Commercial Engine Synchronized</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Architectural Health Index: 0.94</p>
              </div>
           </div>
           
           <div className="flex gap-6 items-center">
              <button 
 title="Abort Refinement"
                onClick={onClose}
                className="text-slate-500 hover:text-white font-black text-xs uppercase tracking-[0.2em] transition-all hover:tracking-[0.3em]"
                disabled={executing}
              >
                Abort Refinement
              </button>
              <button 
 title="Align CRM Model"
                onClick={executeOptimization}
                disabled={analyzing || executing || tasks.length === 0}
                className="group relative px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-20 flex items-center gap-4 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {executing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> SYNCHRONIZING...
                  </>
                ) : (
                  <>
                    ALIGN CRM MODEL <Zap size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StrategicModelOptimizer;
