import React, { useEffect, useState } from 'react';
import { getSequences } from '../services/mockService';
import { hubSpotService } from '../services/hubspotService';
import { Sequence } from '../types';
import { Sparkles, Mail, TrendingUp, Users, RefreshCw } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Sequences</h1>
              {source === 'hubspot' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Live Data</span>
              )}
            </div>
            <p className="text-slate-500 mt-1">Sales outreach and automated follow-ups.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={`${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowGeneralAi(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2"
          >
              <Sparkles size={16} />
              Generate New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sequences.map((seq) => (
          <div key={seq.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg">
                    <Mail className="w-6 h-6 text-emerald-600" />
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${seq.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {seq.active ? 'Active' : 'Draft'}
                </span>
            </div>
            
            <h3 className="font-bold text-slate-900 mb-1">{seq.name}</h3>
            <p className="text-xs text-slate-500 mb-6 flex items-center gap-1">
                <Users size={12} />
                Target: {seq.targetPersona}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-50">
                <div>
                    <p className="text-xs text-slate-400">Steps</p>
                    <p className="font-semibold text-slate-700">{seq.stepsCount}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-400">Reply Rate</p>
                    <p className="font-semibold text-slate-700 flex items-center gap-1">
                        {seq.replyRate}%
                        <TrendingUp size={12} className="text-emerald-500" />
                    </p>
                </div>
            </div>

            <button 
                onClick={() => setSelectedSeq(seq)}
                className="mt-auto w-full py-2.5 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 font-medium text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
            >
                <Sparkles size={16} />
                Optimize with AI
            </button>
          </div>
        ))}
      </div>

      <AiModal 
        isOpen={!!selectedSeq} 
        onClose={() => setSelectedSeq(null)} 
        contextType="sequence"
        contextId={selectedSeq?.id}
        contextName={selectedSeq?.name}
      />

      <AiModal 
        isOpen={showGeneralAi} 
        onClose={() => setShowGeneralAi(false)} 
        contextType="sequence"
        contextName="All Sequences"
      />
    </div>
  );
};

export default Sequences;