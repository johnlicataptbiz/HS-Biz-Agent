import React, { useEffect, useState } from 'react';
import { getSequences } from '../services/mockService';
import { hubSpotService } from '../services/hubspotService';
import { Sequence } from '../types';
import { Sparkles, Mail, TrendingUp, Users, RefreshCw, ArrowUpRight, BarChart3 } from 'lucide-react';
import AiModal from '../components/AiModal';

const Sequences: React.FC = () => {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
  const [showGeneralAi, setShowGeneralAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<'demo' | 'hubspot'>('demo');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const token = hubSpotService.getToken();
    if (token) {
      const realData = await hubSpotService.fetchSequences();
      if (realData.length > 0) {
        setSequences(realData);
        setSource('hubspot');
      } else {
        const mockData = await getSequences();
        setSequences(mockData);
        setSource('demo');
      }
    } else {
      const mockData = await getSequences();
      setSequences(mockData);
      setSource('demo');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
              Sequences
            </h1>
            {source === 'hubspot' && (
              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25">
                Live Data
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">Sales outreach and automated follow-ups.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={`${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowGeneralAi(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Sparkles size={16} />
            Generate New
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sequences.map((seq) => (
          <div 
            key={seq.id} 
            className="group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
          >
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/25">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  seq.active 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}>
                  {seq.active ? 'Active' : 'Draft'}
                </span>
              </div>
              
              {/* Title & Target */}
              <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-900 transition-colors mb-2">
                {seq.name}
              </h3>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-6">
                <Users size={14} className="text-slate-400" />
                Target: {seq.targetPersona}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Steps</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{seq.stepsCount}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Reply Rate</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xl font-bold text-slate-900">{seq.replyRate}%</p>
                    <div className="p-1 bg-emerald-100 rounded">
                      <TrendingUp size={12} className="text-emerald-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={() => setSelectedSeq(seq)}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-700 font-semibold text-sm hover:from-indigo-100 hover:to-purple-100 transition-all flex items-center justify-center gap-2 group/btn"
              >
                <Sparkles size={16} />
                Optimize with AI
                <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AiModal 
        isOpen={!!selectedSeq} 
        onClose={() => setSelectedSeq(null)} 
        contextType="sequence"
        contextId={selectedSeq?.id}
        contextName={selectedSeq?.name}
        initialPrompt={selectedSeq ? `Optimize the "${selectedSeq.name}" sequence targeting "${selectedSeq.targetPersona}". It has ${selectedSeq.stepsCount} steps with a ${selectedSeq.replyRate}% reply rate and AI score of ${selectedSeq.aiScore}/100. Suggest improvements for higher engagement and conversions.` : ''}
      />

      <AiModal 
        isOpen={showGeneralAi} 
        onClose={() => setShowGeneralAi(false)} 
        contextType="sequence"
        contextName="All Sequences"
        initialPrompt="Generate a new 5-step cold outreach sequence for PT clinic owners. Focus on high reply rates, include personalization tokens, and follow best practices for B2B sales outreach."
      />
    </div>
  );
};

export default Sequences;