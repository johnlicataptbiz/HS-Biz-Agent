import React, { useEffect, useState } from 'react';
import { getWorkflows } from '../services/mockService';
import { hubSpotService } from '../services/hubspotService';
import { Workflow } from '../types';
import { Sparkles, AlertCircle, CheckCircle2, MoreHorizontal, RefreshCw } from 'lucide-react';
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
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
              {source === 'hubspot' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Live Data</span>
              )}
            </div>
            <p className="text-slate-500 mt-1">Manage and optimize your automation logic.</p>
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
              Create New with AI
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {workflows.length === 0 && !isLoading ? (
          <div className="p-12 text-center text-slate-500">
            No workflows found.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                <th className="px-6 py-4">Workflow Name</th>
                <th className="px-6 py-4">Object Type</th>
                <th className="px-6 py-4">Enrollment</th>
                <th className="px-6 py-4">AI Score</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{wf.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">ID: {wf.id}</div>
                  </td>
                  <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium capitalize">
                          {wf.objectType.toLowerCase()}
                      </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{wf.enrolledCount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${getScoreColor(wf.aiScore)}`}>
                      {wf.aiScore < 80 && <AlertCircle size={12} />}
                      {wf.aiScore >= 80 && <CheckCircle2 size={12} />}
                      {wf.aiScore}/100
                    </div>
                  </td>
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${wf.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                          <span className="text-sm text-slate-600">{wf.enabled ? 'Active' : 'Off'}</span>
                      </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                          onClick={() => setSelectedWf(wf)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-medium flex items-center gap-1 border border-transparent hover:border-indigo-100"
                      >
                          <Sparkles size={14} />
                          Optimize
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600">
                          <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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