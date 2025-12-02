import React, { useEffect, useState } from 'react';
import { getBreezeTools } from '../services/mockService';
import { BreezeTool } from '../types';
import { Sparkles, Hammer, Box, Code, RefreshCw, Zap, ArrowUpRight, Plus } from 'lucide-react';
import AiModal from '../components/AiModal';

const BreezeTools: React.FC = () => {
  const [tools, setTools] = useState<BreezeTool[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    // Currently only mock data as Breeze Tools (App Objects) aren't fetchable via standard PAT
    const mockData = await getBreezeTools();
    setTools(mockData);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
              Breeze Tools
            </h1>
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/25">
              Beta
            </span>
          </div>
          <p className="text-slate-500 mt-1">Architect custom Workflow Actions and App Objects.</p>
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
            onClick={() => setShowAi(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Sparkles size={16} />
            Draft New Tool
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <div 
            key={tool.id} 
            className="group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
          >
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/25">
                    <Hammer className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-purple-900 transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">ID: {tool.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                  <Zap size={12} className="text-amber-500" />
                  <span className="text-xs font-bold text-slate-600">Score: {tool.aiScore}</span>
                </div>
              </div>

              {/* Action URL */}
              <div className="mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Action URL</p>
                <div className="relative">
                  <code className="block bg-gradient-to-br from-slate-900 to-slate-800 text-purple-300 p-3 rounded-xl text-xs font-mono break-all border border-slate-700">
                    {tool.actionUrl}
                  </code>
                </div>
              </div>
              
              {/* Input Fields */}
              <div className="mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Input Fields</p>
                <div className="flex flex-wrap gap-2">
                  {tool.inputFields.map((field) => (
                    <span 
                      key={field.key} 
                      className="px-2.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
                    >
                      <Box size={10} className="text-slate-400" />
                      {field.label}
                      {field.required && <span className="text-rose-500 font-bold">*</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-center gap-2 group/btn">
                  <Code size={14} />
                  View JSON
                </button>
                <button className="flex-1 py-2.5 text-sm font-semibold text-purple-600 hover:bg-purple-50 rounded-xl border border-purple-100 hover:border-purple-200 transition-all flex items-center justify-center gap-2 group/btn">
                  <Sparkles size={14} />
                  Refine
                  <ArrowUpRight size={12} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add New Card */}
        <button 
          onClick={() => setShowAi(true)}
          className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-purple-300 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 hover:text-purple-600 transition-all duration-300 min-h-[320px]"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          
          <div className="relative">
            <div className="p-5 bg-slate-50 rounded-2xl mb-4 group-hover:bg-white group-hover:shadow-lg transition-all">
              <Plus size={32} className="group-hover:scale-110 transition-transform" />
            </div>
            <span className="font-bold text-lg block mb-1">Draft a new Custom Action</span>
            <span className="text-sm">Generate <code className="px-1.5 py-0.5 bg-slate-100 group-hover:bg-white rounded text-xs font-mono">app.json</code> config with AI</span>
          </div>
        </button>
      </div>

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="breeze_tool"
        contextName="All Tools"
      />
    </div>
  );
};

export default BreezeTools;