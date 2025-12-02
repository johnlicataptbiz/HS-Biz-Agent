import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, ArrowRight, CheckCircle2, BrainCircuit, Zap, Code } from 'lucide-react';
import { generateOptimization } from '../services/aiService';
import { AiResponse } from '../types';

interface AiModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
  contextId?: string;
  contextName?: string;
  initialPrompt?: string;
}

const AiModal: React.FC<AiModalProps> = ({ isOpen, onClose, contextType, contextId, contextName, initialPrompt }) => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);

  // Context-aware dynamic suggestions
  const currentSuggestions = useMemo(() => {
    const baseSuggestions = {
      workflow: [
        "Analyze for redundant steps and delays",
        "Check for broken branching logic",
        "Identify drop-off points in enrollment",
        "Optimize for faster conversion"
      ],
      sequence: [
        "Rewrite email copy for higher reply rate",
        "Check send times against best practices",
        "Make the tone more conversational",
        "Add manual task steps for high-value leads"
      ],
      data: [
        "Identify unused or redundant properties",
        "Suggest property groups for better organization",
        "Find inconsistent naming conventions",
        "Merge duplicate fields"
      ],
      breeze_tool: [
        "Draft a Patient Reactivation action",
        "Design an NPS Calculation tool",
        "Create a custom SMS reminder action",
        "Define inputs for a Revenue Forecast tool"
      ]
    };

    const list = baseSuggestions[contextType] || [];

    if (contextName && contextName !== 'All Workflows' && contextName !== 'All Sequences' && contextName !== 'All Tools') {
      const specific = [];
      if (contextType === 'workflow') {
        specific.push(`Analyze "${contextName}" for bottlenecks`);
        specific.push(`Suggest A/B tests for "${contextName}"`);
      } else if (contextType === 'sequence') {
        specific.push(`Personalize "${contextName}" for target persona`);
      } else if (contextType === 'breeze_tool') {
        specific.push(`Refine inputs for "${contextName}"`);
      }
      return [...specific, ...list].slice(0, 5);
    }

    return list;
  }, [contextType, contextName]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt || '');
      setResult(null);
      setIsProcessing(false);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const handleOptimize = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    try {
      const res = await generateOptimization(prompt, contextType, contextId);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const getContextGradient = () => {
    switch (contextType) {
      case 'workflow': return 'from-indigo-500 to-purple-600';
      case 'sequence': return 'from-emerald-500 to-teal-500';
      case 'data': return 'from-amber-500 to-orange-500';
      case 'breeze_tool': return 'from-purple-500 to-pink-500';
      default: return 'from-indigo-500 to-purple-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`relative px-6 py-5 bg-gradient-to-r ${getContextGradient()}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="relative flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">AI Co-Pilot Optimizer</h3>
                <p className="text-white/70 text-sm flex items-center gap-1.5">
                  <Zap size={12} />
                  Context: <span className="font-medium text-white/90">{contextName || contextType}</span>
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
          {!result ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  What would you like to improve?
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe your goal or issue...`}
                  className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-slate-700 placeholder:text-slate-400 text-sm bg-white shadow-sm transition-all"
                  autoFocus
                />
              </div>

              {/* Context-aware suggestions */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Suggested Optimizations
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(suggestion)}
                      className="px-3 py-2 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-xs font-medium rounded-xl border border-slate-200 hover:border-indigo-200 transition-all shadow-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={handleOptimize}
                  disabled={!prompt.trim() || isProcessing}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all ${
                    !prompt.trim() || isProcessing
                      ? 'bg-slate-300 cursor-not-allowed'
                      : `bg-gradient-to-r ${getContextGradient()} hover:shadow-lg hover:shadow-indigo-500/25`
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Plan
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Analysis Card */}
              <div className={`bg-gradient-to-br ${getContextGradient()} rounded-xl p-5 text-white`}>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <BrainCircuit size={14} />
                  </div>
                  Analysis
                </h4>
                <p className="text-sm text-white/90 leading-relaxed">
                  {result.analysis}
                </p>
              </div>

              {/* Changes List */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" />
                  Proposed Changes
                </h4>
                <div className="space-y-2">
                  {result.diff.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-1 bg-emerald-100 rounded-lg flex-shrink-0">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      </div>
                      <span className="text-sm text-slate-700">{change}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview for Breeze Tool Spec */}
              {result.specType === 'breeze_tool_spec' && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Code size={14} className="text-purple-500" />
                    Tool Definition (JSON)
                  </h4>
                  <pre className="bg-gradient-to-br from-slate-900 to-slate-800 text-purple-300 p-4 rounded-xl text-xs overflow-x-auto border border-slate-700 shadow-lg">
                    {JSON.stringify(result.spec, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions (Only show if result exists) */}
        {result && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <button 
              onClick={() => setResult(null)}
              className="text-sm text-slate-500 hover:text-slate-800 font-medium px-4 py-2 rounded-xl hover:bg-slate-100 transition-all"
            >
              ← Start Over
            </button>
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // Mock apply
                  onClose();
                  alert("Optimization applied successfully! (Mock)");
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25"
              >
                Apply Changes
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiModal;