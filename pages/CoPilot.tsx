import React from 'react';
import { Bot, Sparkles, ArrowRight, ShieldCheck, Zap, Activity, MessageSquare, Target, Cpu } from 'lucide-react';

const CoPilot: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="text-center space-y-6 pt-12 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="inline-flex p-6 glass-card rounded-3xl mb-4 shadow-2xl relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-3xl animate-pulse"></div>
            <img src="/logo.png" alt="Heuristic Co-Pilot" className="w-16 h-16 object-contain relative z-10" />
            <div className="absolute -top-1 -right-1 w-6 h-6 premium-gradient rounded-full flex items-center justify-center border-4 border-[#0f172a] shadow-lg">
                <Sparkles size={10} className="text-white" />
            </div>
        </div>
        
        <div className="space-y-3">
            <h1 className="text-6xl font-extrabold text-white tracking-tighter">
                Heuristic <span className="gradient-text">Co-Pilot.</span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
                Your autonomous RevOps engine. Trained on 10,000+ HubSpot enterprise deployments to audit, design, and optimize your growth stack.
            </p>
        </div>
      </div>

      {/* Primary Interface Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[
            { 
                title: "Heuristic Portal Audit", 
                desc: "Run a deep multi-vector diagnostic on workflows, relational data, and hidden architectural risks.", 
                icon: Activity, 
                color: "indigo" 
            },
            { 
                title: "Cognitive Outreach Blueprint", 
                desc: "Draft a high-conversion 5-step outbound sequence based on target persona heuristics.", 
                icon: Target, 
                color: "emerald" 
            },
            { 
                title: "Schema Neutralization", 
                desc: "Identify and resolve redundant architectural nodes and CRM property contamination.", 
                icon: Cpu, 
                color: "amber" 
            },
            { 
                title: "Automation Mapping", 
                desc: "Design a comprehensive lifecycle stage automation map with fallback logic loops.", 
                icon: Zap, 
                color: "purple" 
            }
        ].map((action, i) => (
            <button key={i} className="glass-card text-left p-10 group relative overflow-hidden transition-all duration-500 hover:-translate-y-2 border-white/5 hover:border-indigo-500/30">
                <div className={`absolute -right-10 -top-10 w-40 h-40 bg-${action.color}-500/5 rounded-full blur-[80px] group-hover:bg-${action.color}-500/10 transition-colors`}></div>
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className={`w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-${action.color}-400 group-hover:scale-110 transition-transform duration-500 shadow-xl`}>
                        <action.icon size={32} />
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Module v4.2</span>
                        <div className="flex items-center gap-1 mt-2">
                            <div className={`w-1.5 h-1.5 rounded-full bg-${action.color}-500 shadow-[0_0_8px_rgba(var(--${action.color}-rgb),0.5)]`}></div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest tracking-tighter">Ready</span>
                        </div>
                    </div>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{action.title}</h3>
                <p className="text-slate-400 mb-8 font-medium leading-relaxed text-sm">{action.desc}</p>
                
                <div className="flex items-center text-xs font-extrabold text-indigo-400 gap-2 uppercase tracking-widest group-hover:gap-4 transition-all pt-6 border-t border-white/5">
                    Initialize Module <ArrowRight size={16} />
                </div>
            </button>
        ))}
      </div>
      
      <div className="glass-card p-12 relative overflow-hidden flex flex-col items-center text-center space-y-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-pink-500/5 pointer-events-none"></div>
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
            <MessageSquare size={20} className="text-slate-400" />
        </div>
        <div>
            <h3 className="text-xl font-bold text-white uppercase tracking-widest mb-2">Cognitive Query Interface</h3>
            <p className="text-slate-400 text-sm font-medium max-w-xl mx-auto leading-relaxed">
                Use the global chat matrix in the bottom right to execute complex custom commands or troubleshoot specific portal exceptions.
            </p>
        </div>
        <div className="flex items-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <ShieldCheck size={14} className="text-emerald-500" />
                No Data Training
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-800"></div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Bot size={14} className="text-indigo-400" />
                Gemini 2.0 Flash
            </div>
        </div>
      </div>
    </div>
  );
};

export default CoPilot;