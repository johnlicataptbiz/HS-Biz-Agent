import React, { useEffect, useState } from 'react';
import { getWorkflows } from '../services/mockService';
import { hubSpotService } from '../services/hubspotService';
import { Workflow } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, MoreHorizontal, RefreshCw, GitFork, ArrowRight, Zap } from 'lucide-react';
import AiModal from '../components/AiModal';

const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWf, setSelectedWf] = useState<Workflow | null>(null);
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
      try {
        const realData = await hubSpotService.fetchWorkflows();
        setWorkflows(realData.length > 0 ? realData : []);
        setSource('hubspot');
      } catch (e) {
        // Fallback
        const mockData = await getWorkflows();
        setWorkflows(mockData);
        setSource('demo');
      }
    } else {
      const mockData = await getWorkflows();
      setWorkflows(mockData);
      setSource('demo');
    }
    setIsLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-teal-500';
    if (score >= 60) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-pink-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
              Workflows
            </h1>
            {source === 'hubspot' && (
              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25">
                Live Data
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">Manage and optimize your automation logic.</p>
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
            Create New with AI
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {workflows.length === 0 && !isLoading ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GitFork size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">No workflows found.</p>
            <p className="text-slate-400 text-sm mt-1">Create your first workflow with AI</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Workflow Name</th>
                  <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Object Type</th>
                  <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Enrollment</th>
                  <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">AI Score</th>
                  <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${getScoreColor(wf.aiScore)} shadow-lg`}>
                          <GitFork size={14} className="text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{wf.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5 font-mono">ID: {wf.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium capitalize border border-slate-200">
                        {wf.objectType.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">{wf.enrolledCount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${getScoreBg(wf.aiScore)}`}>
                        {wf.aiScore < 80 && <AlertCircle size={12} />}
                        {wf.aiScore >= 80 && <CheckCircle2 size={12} />}
                        {wf.aiScore}/100
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${wf.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className={`text-sm font-medium ${wf.enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {wf.enabled ? 'Active' : 'Off'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedWf(wf)}
                          className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 border border-transparent hover:border-indigo-100"
                        >
                          <Sparkles size={14} />
                          Optimize
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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