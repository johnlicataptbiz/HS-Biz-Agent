import React from 'react';
import { ArrowRight, Info, Workflow as WorkflowIcon, Mail as SequenceIcon } from 'lucide-react';

interface FunnelStageProps {
  title: string;
  count: number;
  subTitle: string;
  icon: React.ElementType;
  color: string;
  workflows: number;
  sequences: number;
  dropOff?: number;
  isLast?: boolean;
}

const FunnelStage: React.FC<FunnelStageProps> = ({ 
  title, 
  count, 
  subTitle, 
  icon: Icon, 
  color, 
  workflows, 
  sequences, 
  dropOff,
  isLast 
}) => {
  return (
    <div className="flex-1 flex items-stretch">
      <div 
        className="flex-1 glass-card p-6 flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-500"
        style={{ '--stage-accent': color } as React.CSSProperties}
      >
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl pointer-events-none transition-opacity group-hover:opacity-20 bg-[var(--stage-accent)]"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform text-[var(--stage-accent)]">
            <Icon size={24} />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{subTitle}</span>
            {dropOff !== undefined && dropOff > 0 && (
                <span className="text-[10px] font-bold text-rose-400 mt-1 uppercase tracking-tighter">-{dropOff}% Leakage</span>
            )}
          </div>
        </div>

        <div className="space-y-1 mb-8 relative z-10">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">{title}</h3>
          <p className="text-4xl font-extrabold text-white tracking-tighter">{count.toLocaleString()}</p>
        </div>

        <div className="mt-auto space-y-3 relative z-10">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 px-3 py-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-2">
                <WorkflowIcon size={12} className="text-indigo-400" />
                <span>Workflows</span>
            </div>
            <span className="text-white">{workflows}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 px-3 py-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-2">
                <SequenceIcon size={12} className="text-emerald-400" />
                <span>Sequences</span>
            </div>
            <span className="text-white">{sequences}</span>
          </div>
        </div>
      </div>

      {!isLast && (
        <div className="hidden lg:flex flex-col items-center justify-center px-4 text-slate-700 animate-pulse">
          <ArrowRight size={20} />
        </div>
      )}
    </div>
  );
};

export default FunnelStage;
