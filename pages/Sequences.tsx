import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { modeService } from '../services/modeService';
import * as mockService from '../services/mockService';
import { Sequence } from '../types';
import { Mail, RefreshCw, Sparkles, ArrowUpRight, Search, TrendingUp, Users, Clock, PlayCircle, PauseCircle } from 'lucide-react';
import AiModal from '../components/AiModal';

const Sequences: React.FC = () => {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteAfter, setRemoteAfter] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 4; // smaller size to surface pagination in demo mode

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const token = hubSpotService.getToken();
    const demo = modeService.isDemoMode();

    if (token && !demo) {
      setIsConnected(true);
      try {
        const { items, nextAfter } = await hubSpotService.fetchSequencesPageMapped(20);
        setSequences(items);
        setRemoteAfter(nextAfter);
      } catch (error) {
        console.error('Error fetching sequences:', error);
        const mockData = await mockService.getSequences();
        setSequences(mockData);
        setIsConnected(false);
      }
    } else {
      setIsConnected(false);
      const mockData = await mockService.getSequences();
      setSequences(mockData);
    }
    setIsLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getReplyRateColor = (rate: number) => {
    if (rate >= 15) return 'text-emerald-600';
    if (rate >= 8) return 'text-amber-600';
    return 'text-rose-600';
  };

  const filteredSequences = sequences.filter(seq =>
    seq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seq.targetPersona.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const paged = filteredSequences.slice((page - 1) * pageSize, page * pageSize);

  const loadMore = async () => {
    if (!remoteAfter) return;
    setLoadingMore(true);
    try {
      const { items, nextAfter } = await hubSpotService.fetchSequencesPageMapped(20, remoteAfter);
      setSequences(prev => [...prev, ...items]);
      setRemoteAfter(nextAfter);
    } catch (e) {
      console.error('Load more failed', e);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
            Sequences
          </h1>
          <p className="text-slate-500 mt-1">
            {isConnected ? 'Live data from HubSpot' : 'Demo mode - Connect HubSpot for live data'}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setShowAi(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Sparkles size={16} />
            Draft Sequence
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search sequences..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{sequences.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{sequences.filter(s => s.active).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Avg Reply Rate</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {sequences.length > 0 ? Math.round(sequences.reduce((acc, s) => acc + s.replyRate, 0) / sequences.length) : 0}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Avg Score</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {sequences.length > 0 ? Math.round(sequences.reduce((acc, s) => acc + s.aiScore, 0) / sequences.length) : 0}
          </p>
        </div>
      </div>

      {/* Sequence List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paged.map((sequence) => (
            <div 
              key={sequence.id}
              data-testid="seq-card"
              className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${sequence.active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                    {sequence.active ? (
                      <PlayCircle size={20} className="text-emerald-600" />
                    ) : (
                      <PauseCircle size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-indigo-900 transition-colors">
                      {sequence.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{sequence.targetPersona}</p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${getScoreColor(sequence.aiScore)}`}>
                  {sequence.aiScore}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-600">{sequence.stepsCount} steps</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className={getReplyRateColor(sequence.replyRate)} />
                  <span className={`text-sm font-medium ${getReplyRateColor(sequence.replyRate)}`}>
                    {sequence.replyRate}% reply rate
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedSequence(sequence)}
                className="w-full py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-indigo-100 hover:border-indigo-200"
              >
                <Sparkles size={14} />
                Optimize Sequence
                <ArrowUpRight size={12} />
              </button>
            </div>
          ))}

          {filteredSequences.length === 0 && (
            <div className="col-span-2 text-center py-20 text-slate-500">
              <Mail size={40} className="mx-auto mb-4 text-slate-300" />
              <p className="font-medium">No sequences found</p>
              <p className="text-sm mt-1">Try adjusting your search or connect to HubSpot</p>
            </div>
          )}
          {filteredSequences.length > 0 && (
            <div className="col-span-2 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {page} of {Math.max(1, Math.ceil(filteredSequences.length / pageSize))}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50">Previous</button>
                <button onClick={() => setPage(Math.min(Math.ceil(filteredSequences.length / pageSize), page + 1))} disabled={page >= Math.ceil(filteredSequences.length / pageSize)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50">Next</button>
                {isConnected && remoteAfter && (
                  <button onClick={loadMore} disabled={loadingMore} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load More'}</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Modal for selected sequence */}
      <AiModal
        isOpen={!!selectedSequence}
        onClose={() => setSelectedSequence(null)}
        contextType="sequence"
        contextName={selectedSequence?.name}
        initialPrompt={selectedSequence ? `Optimize the "${selectedSequence.name}" sales sequence.\n\nCurrent state:\n- Target Persona: ${selectedSequence.targetPersona}\n- Steps: ${selectedSequence.stepsCount}\n- Reply Rate: ${selectedSequence.replyRate}%\n- AI Score: ${selectedSequence.aiScore}/100\n\nProvide specific recommendations to improve reply rates for this PT Biz outreach sequence.` : ''}
      />

      {/* AI Modal for new sequence */}
      <AiModal
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        contextType="sequence"
        contextName="New Sequence"
        initialPrompt="Draft a new HubSpot sales sequence for PT Biz. We reach out to Physical Therapy clinic owners to book Discovery Calls.\n\nConsider these outreach scenarios:\n1. Webinar attendee follow-up\n2. Podcast listener outreach\n3. Referral introduction\n4. Cold outreach to ideal profile (PT clinic doing $500K-$2M)\n5. Re-engagement of past prospects\n\nGenerate a 5-7 step sequence with email templates and task suggestions."
      />
    </div>
  );
};

export default Sequences;
