import React from 'react';
import { Bot, Sparkles, ArrowRight } from 'lucide-react';

const CoPilot: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 pt-8">
        <div className="inline-flex p-4 bg-indigo-100 rounded-2xl mb-2 shadow-sm">
            <Bot size={48} className="text-indigo-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">HubSpot Co-Pilot</h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Your autonomous RevOps engine. Ask me to audit, design, or fix anything in your portal.
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
            { title: "Full Portal Scan", desc: "Run a deep diagnostic on workflows, data, and assets.", color: "bg-indigo-500" },
            { title: "Sequence Generator", desc: "Draft a 5-step outbound sequence for a specific persona.", color: "bg-emerald-500" },
            { title: "Data Cleaner", desc: "Identify and merge duplicate contacts and properties.", color: "bg-amber-500" },
            { title: "Journey Architect", desc: "Design a lifecycle stage automation map.", color: "bg-purple-500" }
        ].map((action, i) => (
            <button key={i} className="text-left p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group hover:border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{action.title}</h3>
                    <div className={`p-2 rounded-lg ${action.color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}>
                        <Sparkles size={18} className={`${action.color.replace('bg-', 'text-')}`} />
                    </div>
                </div>
                <p className="text-sm text-slate-500 mb-4">{action.desc}</p>
                <div className="flex items-center text-sm font-medium text-indigo-600 gap-1 group-hover:gap-2 transition-all">
                    Start Action <ArrowRight size={16} />
                </div>
            </button>
        ))}
      </div>
      
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
        <h3 className="font-semibold text-slate-900 mb-2">Need something else?</h3>
        <p className="text-slate-500 text-sm mb-0">
            Use the global chat button in the bottom right to ask complex questions or troubleshoot specific errors.
        </p>
      </div>
    </div>
  );
};

export default CoPilot;