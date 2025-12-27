import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Activity, AlertTriangle, CheckCircle, ArrowRight, Zap, RefreshCw, Sparkles, LayoutPanelTop, Database, PieChart } from 'lucide-react';
import { auditService, PortalAuditReport, AuditIssue } from '../services/auditService';

interface AuditReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRunAiRefinement?: (prompt: string) => void;
}

const AuditReportModal: React.FC<AuditReportModalProps> = ({ isOpen, onClose, onRunAiRefinement }) => {
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState<string | null>(null);
    const [report, setReport] = useState<PortalAuditReport | null>(null);

    useEffect(() => {
        if (isOpen) {
            runAudit();
        }
    }, [isOpen]);

    const runAudit = async () => {
        setLoading(true);
        try {
            const result = await auditService.runComprehensiveAudit();
            setReport(result);
        } catch (e) {
            console.error("Audit failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (issue: AuditIssue) => {
        if (!issue.actionScript || issue.actionScript === 'analyze-sequence' || issue.actionScript === 'batch-classify') {
            onRunAiRefinement?.(`Run optimization for: ${issue.title}`);
            return;
        }

        setExecuting(issue.id);
        try {
            const res = await auditService.executeAuditAction(issue.actionScript);
            alert(res.message);
            await runAudit(); // Refresh state
        } catch (e: any) {
            alert("Script failed: " + e.message);
        } finally {
            setExecuting(null);
        }
    };

    if (!isOpen) return null;


    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <div 
                className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md transition-opacity duration-500" 
                onClick={onClose}
                role="button"
                aria-label="Close Modal"
                title="Close modal"
            ></div>

            <div className="relative glass-card border-white/10 w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 shadow-[0_0_100px_rgba(79,70,229,0.2)] max-h-[90vh] flex flex-col">
                <div className="premium-gradient h-1.5 w-full shrink-0" />

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-500 rounded-2xl shadow-xl shadow-indigo-500/20">
                            <Activity size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-white tracking-tighter uppercase italic">Comprehensive Direct Audit</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-400">Heuristic Engine v2.0</span>
                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Deterministic Logic Scan</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        title="Close Audit Report"
                        className="p-3 text-slate-400 hover:text-white glass-button border-transparent transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center space-y-4">
                            <RefreshCw className="animate-spin text-indigo-500" size={40} />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Scanning Portal Nodes...</p>
                        </div>
                    ) : report ? (
                        <>
                            {/* Score Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="col-span-1 md:col-span-1 flex flex-col items-center justify-center p-8 bg-white/[0.03] border border-white/10 rounded-[2.5rem] relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500 opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity" />
                                    <span className="text-5xl font-black text-white tracking-tighter mb-2">{report.overallScore}%</span>
                                    <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest text-center">Global Health</span>
                                </div>
                                <div className="col-span-1 md:col-span-3 grid grid-cols-3 gap-4">
                                    {[
                                        { label: 'Automation', score: report.summary.automationScore, icon: Zap, color: 'text-amber-400' },
                                        { label: 'Data Model', score: report.summary.dataScore, icon: Database, color: 'text-indigo-400' },
                                        { label: 'Sales Velocity', score: report.summary.salesScore, icon: PieChart, color: 'text-emerald-400' }
                                    ].map((s, i) => (
                                        <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-2">
                                            <s.icon size={20} className={s.color} />
                                            <span className="text-xl font-bold text-white tracking-tight">{s.score}%</span>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Detailed Findings */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <LayoutPanelTop size={14} />
                                    Critical Heuristic Findings
                                </h3>
                                
                                <div className="space-y-4">
                                    {report.issues.length > 0 ? report.issues.map((issue) => (
                                        <div key={issue.id} className="group p-6 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-[2rem] transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="flex gap-5 max-w-xl">
                                                <div className={`p-4 rounded-2xl shrink-0 ${
                                                    issue.impact === 'Critical' ? 'bg-rose-500/10 text-rose-500' :
                                                    issue.impact === 'High' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'
                                                }`}>
                                                    <AlertTriangle size={24} />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight italic">{issue.title}</h4>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                                            issue.impact === 'Critical' ? 'border-rose-500/20 text-rose-500' : 'border-slate-700 text-slate-500'
                                                        }`}>
                                                            {issue.impact}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-400 font-medium leading-relaxed">{issue.description}</p>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleAction(issue)}
                                                disabled={executing === issue.id}
                                                className="px-6 py-4 glass-button border-indigo-500/20 text-indigo-300 hover:text-white hover:bg-indigo-500 text-xs font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 group/btn"
                                            >
                                                {executing === issue.id ? (
                                                    <RefreshCw className="animate-spin" size={14} />
                                                ) : (
                                                    <>
                                                        {issue.actionLabel}
                                                        <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                                            <div className="p-6 bg-emerald-500/10 text-emerald-500 rounded-full">
                                                <CheckCircle size={40} />
                                            </div>
                                            <p className="text-xl font-bold text-white uppercase italic">Perfect Score Detected</p>
                                            <p className="text-sm text-slate-500 max-w-sm">Your portal architecture is currently within optimal heuristic bounds. No immediate fixes required.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* AI Refinement Footer */}
                <div className="p-8 bg-white/[0.04] border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
                    <div className="flex items-center gap-4 text-left">
                        <div className="p-3 bg-indigo-500/10 rounded-xl">
                            <Sparkles size={18} className="text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-xs font-extrabold text-white uppercase tracking-widest">Strategic Insight Upgrade</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Refine these findings with AI specific to your niche.</p>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button 
                            onClick={onClose}
                            className="flex-1 md:flex-none px-8 py-4 glass-button text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl"
                        >
                            Close Report
                        </button>
                        <button 
                            onClick={() => {
                                onClose();
                                if (onRunAiRefinement) onRunAiRefinement(
                                    `Refine the following Deterministic Audit findings for a Physical Therapy business:\n` +
                                    (report?.issues.map(i => `- ${i.title}: ${i.description}`).join('\n') || 'All systems clear.')
                                );
                            }}
                            className="flex-1 md:flex-none px-8 py-4 premium-gradient text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-900/40 hover:scale-105 active:scale-95 transition-all"
                        >
                            Ask AI Co-Pilot
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.getElementById('modal-root')!
    );
};

export default AuditReportModal;
