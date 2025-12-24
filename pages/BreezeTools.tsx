import React, { useEffect, useState } from 'react';
import { getBreezeTools } from '../services/mockService';
import { BreezeTool } from '../types';
import { Sparkles, Hammer, Box, Code, RefreshCw } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Breeze Tools</h1>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">Beta</span>
            </div>
            <p className="text-slate-500 mt-1">Architect custom Workflow Actions and App Objects.</p>
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
                onClick={() => setShowAi(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2"
            >
                <Sparkles size={16} />
                Draft New Tool
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <div key={tool.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col hover:border-indigo-200 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                        <Hammer className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">{tool.name}</h3>
                        <p className="text-xs text-slate-400 font-mono">ID: {tool.id}</p>
                    </div>
                </div>
                <div className="px-2 py-1 rounded-full border border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">
                    AI Score: {tool.aiScore}
                </div>
            </div>

            <div className="space-y-4 mb-6">
                <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Action URL</p>
                    <code className="block bg-slate-900 text-indigo-200 p-2 rounded text-xs font-mono break-all">
                        {tool.actionUrl}
                    </code>
                </div>
                
                <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Input Fields</p>
                    <div className="flex flex-wrap gap-2">
                        {tool.inputFields.map((field) => (
                            <span key={field.key} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200 flex items-center gap-1">
                                <Box size={10} />
                                {field.label}
                                {field.required && <span className="text-rose-500">*</span>}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-auto flex gap-3">
                <button className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-2">
                    <Code size={14} />
                    View JSON
                </button>
                <button className="flex-1 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-100 transition-colors flex items-center justify-center gap-2">
                    <Sparkles size={14} />
                    Refine
                </button>
            </div>
          </div>
        ))}

        {/* Call to action for empty state or adding more */}
        <button 
            onClick={() => setShowAi(true)}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all group min-h-[250px]"
        >
            <div className="p-4 bg-slate-50 rounded-full mb-3 group-hover:bg-white">
                <Sparkles size={24} />
            </div>
            <span className="font-semibold">Draft a new Custom Action</span>
            <span className="text-xs mt-1">Generate <code>app.json</code> config with AI</span>
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