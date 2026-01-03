import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Sequence } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, MoreHorizontal, RefreshCw, Send, Target, BarChart3, ShieldCheck } from 'lucide-react';
import AiModal from '../components/AiModal';
import Pagination from '../components/Pagination';

const Sequences: React.FC = () => {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
  const [sequencePrompt, setSequencePrompt] = useState('');
  const [showGeneralAi, setShowGeneralAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

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
        const realData = await hubSpotService.fetchSequences();
        setSequences(realData);
        setPage(1);
      } catch (e) {
        console.error("Sequence fetch error:", e);
        setSequences([]);
      }
    } else {
      setSequences([]);
    }
    setIsLoading(false);
  };

  const total = sequences.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSequences = sequences.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getScoreColor = (score: number) => {
    if (score === 0) return 'text-slate-600 bg-slate-100 border-slate-200';
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const avgOpenRate =
    sequences.length > 0
      ? sequences.reduce((acc, s) => acc + (s.openRate || 0), 0) / sequences.length
      : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Outbound Performance</span>
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Market <span className="gradient-text">Sequences.</span>
          </h1>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            Heuristic audit of your multi-step outbound logic. Identifying high-friction steps and persona mismatches.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            id="refresh-sequence-btn"
            onClick={loadData}
            className="p-3 glass-button border-slate-200 text-slate-600 hover:text-slate-900 transition-all active:scale-90"
            title="Refresh Sequence Logic"
            aria-label="Refresh sequences from HubSpot"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button 
            id="optimize-sequence-btn"
            onClick={() => setShowGeneralAi(true)}
            aria-label="Draft new persona with AI"
            title="Draft New Persona"
            className="px-8 py-3 premium-gradient text-slate-900 rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Draft New Persona
          </button>
        </div>
      </div>

      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                <ShieldCheck className="text-emerald-400" size={32} />
            </div>
            <div className="max-w-md mx-auto">
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">Sync Required</h3>
                <p className="text-slate-600 mt-2 font-medium">Connect your HubSpot instance to visualize and optimize your active outbound sequences.</p>
            </div>
         </div>
      )}

      {isConnected && sequences.length === 0 && !isLoading && (
        <div className="glass-card p-20 text-center space-y-6">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto border border-slate-200">
                <Send className="text-slate-500" size={40} />
            </div>
            <div className="max-w-md mx-auto">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Zero Cycles Found</h3>
                <p className="text-slate-600 mt-3 font-medium text-sm leading-relaxed">
                  We scanned your portal but no active sequences were detected in the registry. Ensure you have <span className="text-emerald-400 font-bold uppercase tracking-widest text-[10px]">Sales Hub Professional</span> active.
                </p>
            </div>
        </div>
      )}

      {/* Performance Summary */}
      {isConnected && sequences.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-slate-900">{sequences.length}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Total Sequences</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-emerald-400">{sequences.filter(s => s.active).length}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Active</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-emerald-300">
              {sequences.length > 0 ? `${(avgOpenRate * 100).toFixed(1)}%` : '0%'}
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Avg Open Rate</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-extrabold text-amber-400">
              {sequences.length > 0 ? Math.round(sequences.reduce((acc, s) => acc + s.aiScore, 0) / sequences.length) : 0}%
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Avg Health</p>
          </div>
        </div>
      )}

      {sequences.length > 0 && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pagedSequences.map((seq) => (
            <div key={seq.id} className="glass-card p-8 group hover:-translate-y-1 transition-all duration-500 border-slate-200 hover:border-emerald-500/20 active:scale-[0.98]">
               <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-lg group-hover:bg-emerald-500 group-hover:text-slate-900 transition-all">
                        <Target size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-500 transition-colors tracking-tight">{seq.name}</h3>
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">ID: {seq.id}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest ${getScoreColor(seq.aiScore)}`}>
                    {seq.aiScore === 0 ? 'PENDING' : `Score: ${seq.aiScore}%`}
                  </div>
               </div>

               <div className="space-y-6 mb-8">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                     <span className="text-slate-500">Target Persona</span>
                     <span className="text-slate-900">{seq.targetPersona}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                     <span className="text-slate-500">Flow Integrity</span>
                     <span className="text-slate-900">{seq.stepsCount} Nodes</span>
                  </div>
                  <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-[0.2em]">
                        <span className="text-slate-500">Reply Rate</span>
                        <span className="text-emerald-400">{seq.replyRate === 0 ? 'N/A' : `${(seq.replyRate * 100).toFixed(1)}%`}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(seq.replyRate * 100 * 5, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-[0.2em]">
                        <span className="text-slate-500">Open Rate</span>
                        <span className="text-emerald-400">{seq.openRate === 0 ? 'N/A' : `${(seq.openRate * 100).toFixed(1)}%`}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(seq.openRate * 100, 100)}%` }}
                        ></div>
                      </div>
                  </div>
               </div>

               <div className="flex gap-4 pt-8 border-t border-slate-200">
                   <button 
                    onClick={() => {
                      const reply = seq.replyRate ? `${(seq.replyRate * 100).toFixed(1)}%` : 'N/A';
                      const open = seq.openRate ? `${(seq.openRate * 100).toFixed(1)}%` : 'N/A';
                      setSequencePrompt(
                        `Analyze sequence "${seq.name}" (reply rate: ${reply}, open rate: ${open}). \n` +
                        `Provide 3 specific improvements to increase replies and 2 subject-line or timing changes to improve opens. \n` +
                        `Return a sequence_spec with draft email templates (subject + body) in spec.json and a YAML version in spec.yaml. \n` +
                        `If write actions are possible, include spec.apiCalls for HubSpot sequence updates.`
                      );
                      setSelectedSeq(seq);
                    }}
                    title="Optimize sequence logic with AI"
                    className="flex-1 py-4 premium-gradient text-slate-900 text-[10px] font-extrabold uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={14} />
                    Optimize Flow
                  </button>
                  <button className="p-4 glass-button border-slate-200 text-slate-600 hover:text-slate-900 rounded-2xl transition-all" title="More Actions">
                    <MoreHorizontal size={20} />
                  </button>
               </div>
            </div>
          ))}
        </div>
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          pageSizeOptions={[6, 9, 12, 18]}
          className="pt-2"
        />
        </>
      )}

      <AiModal 
        isOpen={!!selectedSeq} 
        onClose={() => setSelectedSeq(null)} 
        contextType="sequence"
        contextId={selectedSeq?.id}
        contextName={selectedSeq?.name}
        initialPrompt={sequencePrompt}
      />
      
      <AiModal 
        isOpen={showGeneralAi} 
        onClose={() => setShowGeneralAi(false)} 
        contextType="sequence"
        contextName="Market Sequences"
      />
    </div>
  );
};

export default Sequences;
