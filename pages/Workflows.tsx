import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { modeService } from '../services/modeService';
import * as mockService from '../services/mockService';
import { Workflow } from '../types';
import { Zap, RefreshCw, Sparkles, AlertTriangle, CheckCircle2, PlayCircle, PauseCircle, ArrowUpRight, Search, Filter } from 'lucide-react';
import AiModal from '../components/AiModal';

const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteAfter, setRemoteAfter] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
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
        // initial page from server-side pagination
        const { items, nextAfter } = await hubSpotService.fetchWorkflowsPageMapped(20);
        setWorkflows(items);
        setRemoteAfter(nextAfter);
      } catch (error) {
        console.error('Error fetching workflows:', error);
        const mockData = await mockService.getWorkflows();
        setWorkflows(mockData);
        setIsConnected(false);
      }
    } else {
      setIsConnected(false);
      const mockData = await mockService.getWorkflows();
      setWorkflows(mockData);
    }
    setIsLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const filteredWorkflows = workflows.filter(wf => {
    const matchesSearch = wf.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterEnabled === 'all' || 
      (filterEnabled === 'enabled' && wf.enabled) || 
      (filterEnabled === 'disabled' && !wf.enabled);
    return matchesSearch && matchesFilter;
  });

  const paged = filteredWorkflows.slice((page - 1) * pageSize, page * pageSize);

  const loadMore = async () => {
    if (!remoteAfter) return;
    setLoadingMore(true);
    try {
      const { items, nextAfter } = await hubSpotService.fetchWorkflowsPageMapped(20, remoteAfter);
      setWorkflows(prev => [...prev, ...items]);
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
            Workflows
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
            Draft Workflow
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
          {(['all', 'enabled', 'disabled'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterEnabled(filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filterEnabled === filter
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{workflows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{workflows.filter(w => w.enabled).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Issues</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{workflows.filter(w => w.issues.length > 0).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Avg Score</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {workflows.length > 0 ? Math.round(workflows.reduce((acc, w) => acc + w.aiScore, 0) / workflows.length) : 0}
          </p>
        </div>
      </div>

      {/* Workflow List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((workflow) => (
            <div 
              key={workflow.id}
              data-testid="wf-card"
              className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${workflow.enabled ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                    {workflow.enabled ? (
                      <PlayCircle size={20} className="text-emerald-600" />
                    ) : (
                      <PauseCircle size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-indigo-900 transition-colors">
                      {workflow.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Zap size={12} />
                        {workflow.objectType}
                      </span>
                      <span>•</span>
                      <span>{workflow.enrolledCount.toLocaleString()} enrolled</span>
                      <span>•</span>
                      <span>Updated {workflow.lastUpdated}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {workflow.issues.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium border border-amber-200">
                      <AlertTriangle size={12} />
                      {workflow.issues.length} issue{workflow.issues.length > 1 ? 's' : ''}
                    </div>
                  )}
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${getScoreColor(workflow.aiScore)}`}>
                    {workflow.aiScore}
                  </div>
                  <button
                    onClick={() => setSelectedWorkflow(workflow)}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles size={14} />
                    Optimize
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
              {workflow.issues.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {workflow.issues.map((issue, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs border border-amber-100">
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredWorkflows.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <Zap size={40} className="mx-auto mb-4 text-slate-300" />
              <p className="font-medium">No workflows found</p>
              <p className="text-sm mt-1">Try adjusting your filters or connect to HubSpot</p>
            </div>
          )}
          {filteredWorkflows.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {page} of {Math.max(1, Math.ceil(filteredWorkflows.length / pageSize))}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50">Previous</button>
                <button onClick={() => setPage(Math.min(Math.ceil(filteredWorkflows.length / pageSize), page + 1))} disabled={page >= Math.ceil(filteredWorkflows.length / pageSize)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50">Next</button>
                {isConnected && remoteAfter && (
                  <button onClick={loadMore} disabled={loadingMore} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-50">
                    {loadingMore ? 'Loading…' : 'Load More'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Modal for selected workflow */}
      <AiModal
        isOpen={!!selectedWorkflow}
        onClose={() => setSelectedWorkflow(null)}
        contextType="workflow"
        contextName={selectedWorkflow?.name}
        initialPrompt={selectedWorkflow ? `Optimize the "${selectedWorkflow.name}" workflow.\n\nCurrent state:\n- Object Type: ${selectedWorkflow.objectType}\n- Currently Enrolled: ${selectedWorkflow.enrolledCount}\n- AI Score: ${selectedWorkflow.aiScore}/100\n- Issues: ${selectedWorkflow.issues.length > 0 ? selectedWorkflow.issues.join(', ') : 'None detected'}\n\nProvide specific optimization recommendations for this PT Biz workflow.` : ''}
      />

      {/* AI Modal for new workflow */}
      <AiModal
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        contextType="workflow"
        contextName="New Workflow"
        initialPrompt="Draft a new HubSpot workflow for PT Biz. Consider our sales lifecycle: Lead → Discovery Call → Coaching Client → Renewal/Referral.\n\nSuggest a workflow that addresses one of these common needs:\n1. Lead nurture for webinar registrants\n2. Discovery call no-show follow-up\n3. New coaching client onboarding\n4. Renewal reminders (60 days before expiration)\n5. Referral request from satisfied clients"
      />
    </div>
  );
};

export default Workflows;
