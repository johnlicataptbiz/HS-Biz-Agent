import React, { useState } from 'react';
import { Bot, Sparkles, ArrowRight, Zap, Database, Users, GitFork, MessageSquare, BrainCircuit } from 'lucide-react';
import AiModal from '../components/AiModal';
import { hubSpotService } from '../services/hubspotService';
import { actionsService } from '../services/actionsService';
import { useAuth } from '../components/AuthContext';

interface QuickAction {
  title: string;
  desc: string;
  gradient: string;
  icon: React.ElementType;
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
  prompt: string;
}

const CoPilot: React.FC = () => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
    prompt: string;
  }>({ isOpen: false, contextType: 'workflow', prompt: '' });
  const { isAdmin } = useAuth();
  const [execLoading, setExecLoading] = useState<boolean>(false);
  const [previewOutput, setPreviewOutput] = useState<string>('');
  const [execOutput, setExecOutput] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [updatesJson, setUpdatesJson] = useState<string>('{\n  "name": "Improved name"\n}');

  React.useEffect(() => {
    setPreviewOutput('');
    setExecOutput('');
  }, [modalState]);

  const quickActions: QuickAction[] = [
    { 
      title: "Full Portal Scan", 
      desc: "Run a deep diagnostic on workflows, data, and assets.", 
      gradient: "from-indigo-500 to-purple-600",
      icon: BrainCircuit,
      contextType: 'workflow',
      prompt: "Run a full portal health scan. Audit all workflows, check data model for redundancies, and identify optimization opportunities."
    },
    { 
      title: "Sequence Generator", 
      desc: "Draft a 5-step outbound sequence for a specific persona.", 
      gradient: "from-emerald-500 to-teal-500",
      icon: Users,
      contextType: 'sequence',
      prompt: "Generate a 5-step cold outreach sequence for PT clinic owners. Focus on high reply rates and include personalization tokens."
    },
    { 
      title: "Data Cleaner", 
      desc: "Identify and merge duplicate contacts and properties.", 
      gradient: "from-amber-500 to-orange-500",
      icon: Database,
      contextType: 'data',
      prompt: "Audit the Contact schema for redundant or unused properties. Identify merge candidates and suggest cleanup actions."
    },
    { 
      title: "Journey Architect", 
      desc: "Design a lifecycle stage automation map.", 
      gradient: "from-pink-500 to-rose-500",
      icon: GitFork,
      contextType: 'workflow',
      prompt: "Design a lifecycle automation workflow that moves contacts from Lead to MQL to SQL stages based on engagement signals."
    }
  ];

  const handleActionClick = (action: QuickAction) => {
    setModalState({
      isOpen: true,
      contextType: action.contextType,
      prompt: action.prompt
    });
  };

  const doPreview = async () => {
    setExecLoading(true);
    setPreviewOutput('');
    try {
      const updates = JSON.parse(updatesJson || '{}');
      if (modalState.contextType === 'workflow') {
        const out = await actionsService.previewWorkflow(targetId, updates);
        setPreviewOutput(JSON.stringify(out, null, 2));
      } else if (modalState.contextType === 'sequence') {
        const out = await actionsService.previewSequence(targetId, updates);
        setPreviewOutput(JSON.stringify(out, null, 2));
      } else {
        setPreviewOutput('Preview supported for workflows and sequences.');
      }
    } catch (e) {
      setPreviewOutput('Preview failed. Ensure a valid ID and JSON updates.');
    } finally {
      setExecLoading(false);
    }
  };

  const doExecute = async () => {
    setExecLoading(true);
    setExecOutput('');
    try {
      const updates = JSON.parse(updatesJson || '{}');
      if (modalState.contextType === 'workflow') {
        const out = await actionsService.executeWorkflow(targetId, updates);
        setExecOutput(JSON.stringify(out, null, 2));
      } else if (modalState.contextType === 'sequence') {
        const out = await actionsService.executeSequence(targetId, updates);
        setExecOutput(JSON.stringify(out, null, 2));
      } else {
        setExecOutput('Execution supported for workflows and sequences.');
      }
    } catch (e) {
      setExecOutput('Execution failed or forbidden. Only admins can execute.');
    } finally {
      setExecLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="relative text-center space-y-6 py-12">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 rounded-full blur-3xl opacity-60" />
        </div>
        
        <div className="relative inline-flex">
          <div className="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl shadow-indigo-500/30">
            <Bot size={56} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg">
            <Zap size={16} className="text-white" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent tracking-tight">
            HubSpot Co-Pilot
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Your autonomous RevOps engine. Ask me to audit, design, or fix anything in your portal.
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-center gap-8 pt-4">
          {[
            { label: 'Avg Response', value: '< 3s' },
            { label: 'Actions Available', value: '12+' },
            { label: 'Accuracy', value: '98%' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={18} className="text-indigo-500" />
          <h2 className="text-lg font-bold text-slate-900">Quick Actions</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, i) => (
            <button 
              key={i}
              onClick={() => handleActionClick(action)}
              className="group relative text-left p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
            >
              {/* Gradient accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${action.gradient}`} />
              
              {/* Hover background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />
              
              <div className="relative flex items-start gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg flex-shrink-0`}>
                  <action.icon size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{action.desc}</p>
                </div>
              </div>
              
              <div className="flex items-center text-sm font-semibold text-indigo-600 gap-1 mt-4 group-hover:gap-2 transition-all">
                Start Action 
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* CTA Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-2xl p-8 md:p-12">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur">
            <MessageSquare size={32} className="text-white" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-bold text-xl text-white mb-2">Need something more complex?</h3>
            <p className="text-slate-300 max-w-lg">
              Use the global chat button in the bottom right corner to ask complex questions, troubleshoot errors, or get custom recommendations.
            </p>
          </div>
          <button 
            onClick={() => setModalState({ isOpen: true, contextType: 'workflow', prompt: '' })}
            className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors shadow-lg"
          >
            <Sparkles size={18} />
            Open Chat
          </button>
        </div>
      </div>

      <AiModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        contextType={modalState.contextType}
        initialPrompt={modalState.prompt}
        contextName="Co-Pilot Action"
      />

      {modalState.isOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow-xl p-4 w-[90%] max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1 space-y-2">
              <label className="text-xs font-semibold text-slate-600">Target ID</label>
              <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder={modalState.contextType === 'workflow' ? 'workflowId' : 'sequenceId'} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <label className="text-xs font-semibold text-slate-600">Updates (JSON)</label>
              <textarea value={updatesJson} onChange={(e) => setUpdatesJson(e.target.value)} rows={6} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono" />
              <div className="flex gap-2">
                <button onClick={doPreview} disabled={!targetId || execLoading} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold disabled:opacity-50">Preview</button>
                <button onClick={doExecute} disabled={!isAdmin || !targetId || execLoading} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isAdmin ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>Execute (admin)</button>
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600">Preview Output</label>
              <pre className="max-h-40 overflow-auto text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 whitespace-pre-wrap">{previewOutput || '—'}</pre>
              <label className="text-xs font-semibold text-slate-600">Execution Result</label>
              <pre className="max-h-40 overflow-auto text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 whitespace-pre-wrap">{execOutput || (isAdmin ? '—' : 'Execution requires admin role.')}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoPilot;
