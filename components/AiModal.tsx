import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, ArrowRight, CheckCircle2, BrainCircuit } from 'lucide-react';
import { generateOptimization } from '../services/aiService';
import { AiResponse } from '../types';

interface AiModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool' | 'segment_consolidation' | 'property_migration';
  contextId?: string;
  contextName?: string;
  initialPrompt?: string;
}

const AiModal: React.FC<AiModalProps> = ({ isOpen, onClose, contextType, contextId, contextName, initialPrompt }) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AiResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isQuotaError, setIsQuotaError] = useState(false);

  const parsedSpecJson = useMemo(() => {
    if (!result?.spec || typeof result.spec !== 'object') return null;
    const maybeJson = result.spec.json;
    if (!maybeJson) return null;
    if (typeof maybeJson === 'string') {
      try {
        return JSON.parse(maybeJson);
      } catch {
        return maybeJson;
      }
    }
    return maybeJson;
  }, [result]);

  const apiCalls = useMemo(() => {
    if (parsedSpecJson && typeof parsedSpecJson === 'object' && Array.isArray(parsedSpecJson.apiCalls)) {
      return parsedSpecJson.apiCalls;
    }
    if (result?.spec && typeof result.spec === 'object' && Array.isArray(result.spec.apiCalls)) {
      return result.spec.apiCalls;
    }
    return [];
  }, [parsedSpecJson, result]);

  const applySpec = async () => {
    if (!result) return;
    if (!apiCalls || apiCalls.length === 0) {
      alert("No write actions were provided. Ask for a spec with apiCalls.");
      return;
    }

    const summaryLines = apiCalls.map((call: any, idx: number) => {
      const method = (call.method || 'POST').toUpperCase();
      const path = call.path || '';
      const desc = call.description ? ` - ${call.description}` : '';
      return `${idx + 1}) ${method} ${path}${desc}`;
    });

    const confirmed = window.confirm(
      `You are about to perform ${apiCalls.length} HubSpot write action(s):\n` +
      summaryLines.join('\n') +
      `\n\nProceed?`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      for (const call of apiCalls) {
        const method = (call.method || 'POST').toUpperCase();
        const rawPath = String(call.path || '');
        const normalizedPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;

        const resp = await fetch(`/api/hubspot/${normalizedPath}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: call.body ? JSON.stringify(call.body) : undefined
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Apply failed: ${method} ${rawPath} (${resp.status}) ${text}`);
        }
      }
      alert("Apply completed successfully.");
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Apply failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Manage Countdown for Quota
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && isQuotaError) {
      setIsQuotaError(false);
    }
    return () => clearInterval(timer);
  }, [countdown, isQuotaError]);

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
      ],
      segment_consolidation: [
        "Find overlapping dynamic lists",
        "Propose logic for a 'Master Newsletter' list",
        "Identify inactive segments with no recent activity",
        "Consolidate 'Import' lists into lifecycle stages"
      ],
      property_migration: [
        "Map legacy fields to structured system properties",
        "Identify data type mismatches in redundant fields",
        "Propose logic for data backfilling during merge",
        "Draft property group structure for audit"
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
      setIsQuotaError(false);
      setCountdown(0);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const handleOptimize = async () => {
    if (!prompt.trim() || countdown > 0) return;
    setIsProcessing(true);
    try {
      const res = await generateOptimization(prompt, contextType, contextId);
      setResult(res);
      
      if (res.analysis.includes("QUOTA_EXCEEDED")) {
        setIsQuotaError(true);
        setCountdown(60);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
      aria-describedby="ai-modal-description"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-200/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
                <h3 id="ai-modal-title" className="font-semibold text-slate-900">AI Co-Pilot Optimizer</h3>
                <p id="ai-modal-description" className="text-xs text-slate-600">
                    Context: <span className="font-medium text-slate-700">{contextName || contextType}</span>
                </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-600" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {!result ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    What would you like to improve?
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={`Describe your goal or issue...`}
                    className="w-full h-32 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-slate-700 placeholder:text-slate-600 text-sm"
                    autoFocus
                />
              </div>

              {/* Context-aware suggestions */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Suggested Optimizations</p>
                <div className="flex flex-wrap gap-2">
                    {currentSuggestions.map((suggestion, idx) => (
                        <button
                            key={idx}
                            onClick={() => setPrompt(suggestion)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-xs font-medium rounded-full border border-slate-200 hover:border-indigo-200 transition-colors text-left"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 mt-2">
                <button
                  onClick={handleOptimize}
                  disabled={!prompt.trim() || isProcessing || countdown > 0}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-slate-900 font-medium transition-all ${
                    !prompt.trim() || isProcessing || countdown > 0
                      ? 'bg-indigo-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : countdown > 0 ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Cooldown ({countdown}s)
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
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                    <BrainCircuit size={16} />
                    Analysis
                </h4>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  {result.analysis}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Proposed Changes</h4>
                <div className="space-y-2">
                  {(result.diff && result.diff.length > 0) ? (
                    result.diff.map((change, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-md">
                        <CheckCircle2 size={18} className="text-emerald-500 mt-0.5" />
                        <span className="text-sm text-slate-700">{change}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No explicit diff provided.</div>
                  )}
                </div>
              </div>

              {/* Preview for Structured Specs */}
              {['breeze_tool_spec', 'workflow_spec', 'sequence_spec', 'property_migration_spec'].includes(result.specType) && (
                <div>
                   <h4 className="text-sm font-semibold text-slate-900 mb-3">Spec Output</h4>
                   {result.spec?.title && (
                     <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                       {result.spec.title}
                     </div>
                   )}
                   {result.spec?.yaml && (
                     <div className="mb-3">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">YAML</div>
                       <pre className="bg-slate-100 text-indigo-700 p-4 rounded-lg text-xs overflow-x-auto">
                         {result.spec.yaml}
                       </pre>
                     </div>
                   )}
                   {parsedSpecJson && (
                     <div>
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">JSON</div>
                       <pre className="bg-slate-100 text-indigo-700 p-4 rounded-lg text-xs overflow-x-auto">
                         {typeof parsedSpecJson === 'string' ? parsedSpecJson : JSON.stringify(parsedSpecJson, null, 2)}
                       </pre>
                     </div>
                   )}
                   {Array.isArray(result.spec?.steps) && result.spec.steps.length > 0 && (
                     <div className="mt-3">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Steps</div>
                       <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">
                         {result.spec.steps.map((step: string, idx: number) => (
                           <li key={idx}>{step}</li>
                         ))}
                       </ul>
                     </div>
                   )}
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
                className="text-sm text-slate-600 hover:text-slate-800 font-medium"
            >
                Start Over
            </button>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={applySpec}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-slate-900 text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    Apply Changes
                    <ArrowRight size={16} />
                </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.getElementById('modal-root')!
  );
};

export default AiModal;
