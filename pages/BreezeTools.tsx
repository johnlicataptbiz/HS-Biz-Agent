import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { BreezeTool } from '../types';
import { Sparkles, Hammer, Box, Code, RefreshCw, Cpu, Zap, ShieldCheck, Terminal } from 'lucide-react';
import AiModal from '../components/AiModal';

const BreezeTools: React.FC = () => {
  const [tools, setTools] = useState<BreezeTool[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [auditPrompt, setAuditPrompt] = useState('');

  useEffect(() => {
    loadData();
    window.addEventListener('hubspot_connection_changed', loadData);
    return () => window.removeEventListener('hubspot_connection_changed', loadData);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);
    
    try {
        const realData = await hubSpotService.fetchBreezeTools();
        setTools(realData);
    } catch (e) {
        setTools([]);
    }
    setIsLoading(false);
  };

  const handleOpenDraft = () => {
      setAuditPrompt(
          `I need to build a new Breeze Extension (HubSpot App).\n\n` +
          `GOAL: Create a serverless function that [DESCRIBE GOAL].\n\n` +
          `REQUIREMENTS:\n` +
          `- Must use the HubSpot UI Extension React + Node.js runtime.\n` +
          `- Define the app.json configuration.\n` +
          `- Provide the serverless function code (app.functions.js).\n` +
          `- Provide the React frontend code (extensions/example.jsx).`
      );
      setShowAi(true);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          {/* ... header content ... */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-purple-500 shadow-[0_0_8px_rgba(167,139,250,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.3em]">Edge Computing</span>
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Breeze <span className="gradient-text">Extensions.</span>
          </h1>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            Architect custom workflow actions and autonomous app objects for advanced logic execution.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            id="refresh-extensions-btn"
            onClick={loadData}
            className="p-3 glass-button border-slate-200 text-slate-600 hover:text-slate-900 transition-all active:scale-90"
            title="Refresh Extension Registry"
            aria-label="Refresh breeze extensions from HubSpot"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
          <button 
            id="draft-tool-btn"
            onClick={handleOpenDraft}
            aria-label="Draft new edge tool with AI"
            className="px-8 py-3 premium-gradient text-slate-900 rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Draft Edge Tool
          </button>
        </div>
      </div>

      {/* ... (sync required warning) ... */}
      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto border border-purple-500/20">
                <ShieldCheck className="text-purple-400" size={32} />
            </div>
            <div className="max-w-md mx-auto">
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">Sync Required</h3>
                <p className="text-slate-600 mt-2 font-medium">Link your HubSpot portal to orchestrate custom extensions and edge-based workflow actions.</p>
            </div>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tools.map((tool) => (
          <div key={tool.id} className="glass-card p-8 group hover:-translate-y-1 transition-all duration-500 flex flex-col relative overflow-hidden h-fit">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center text-slate-900 shadow-lg group-hover:scale-110 transition-transform">
                        <Hammer size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-400 transition-colors uppercase tracking-tight">{tool.name}</h3>
                        <p className="text-[10px] text-slate-600 font-extrabold uppercase tracking-widest mt-1">Registry ID: {tool.id}</p>
                    </div>
                </div>
                <div className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">
                    {tool.aiScore === 0 ? 'PENDING AUDIT' : `Rating: ${tool.aiScore}%`}
                </div>
            </div>

            <div className="space-y-6 mb-8 relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Terminal size={12} className="text-slate-600" />
                        <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest leading-none">Execution Endpoint</p>
                    </div>
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-indigo-700 text-xs font-mono break-all font-bold">
                        {tool.actionUrl || 'No Endpoint Identified'}
                    </div>
                </div>
                
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={12} className="text-slate-600" />
                        <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Input Arguments</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {tool.inputFields.length > 0 ? tool.inputFields.map((field) => (
                            <span key={field.key} className="px-3 py-1.5 bg-slate-100 text-slate-900/90 rounded-xl border border-slate-200 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                <Box size={10} className="text-purple-400" />
                                {field.label}
                                {field.required && <span className="text-rose-500">*</span>}
                            </span>
                        )) : (
                            <span className="text-xs text-slate-600 font-medium italic uppercase tracking-widest">Dynamic Logic Mapping</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200 flex gap-4 relative z-10">
                <button className="flex-1 py-4 glass-button text-[10px] font-extrabold text-slate-600 hover:text-slate-900 uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all" title="Inspect Tool JSON">
                    <Code size={14} />
                    Inspect JSON
                </button>
                <button className="flex-1 py-4 glass-button border-purple-500/20 text-slate-900 hover:bg-purple-500/10 uppercase tracking-widest text-[10px] font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg hover:shadow-purple-500/5" title="Refine Tool with AI">
                    <Sparkles size={14} className="text-purple-400" />
                    Refine Tool
                </button>
            </div>
          </div>
        ))}

        <button 
            onClick={handleOpenDraft}
            title="Draft new edge logic with AI"
            className="group glass-card p-12 flex flex-col items-center justify-center text-center space-y-6 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all h-[400px]"
        >
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500/20 transition-all border border-slate-200 group-hover:border-purple-500/30">
                <Sparkles size={32} className="text-slate-600 group-hover:text-purple-400" />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider group-hover:text-purple-400 transition-colors">Draft Edge Logic</h3>
                <p className="text-[10px] text-slate-600 font-extrabold uppercase tracking-widest leading-relaxed">
                    Generate autonomous <code className="text-indigo-400">app.json</code> configurations using heuristic AI modeling.
                </p>
            </div>
        </button>
      </div>

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="breeze_tool"
        contextName="Heuristic Extension Registry"
        initialPrompt={auditPrompt}
      />
    </div>
  );
};

export default BreezeTools;
