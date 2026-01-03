import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { RefreshCw, TrendingUp, AlertTriangle, Sparkles, ShieldCheck, Target, Zap, Waves, GitFork, UserCheck } from 'lucide-react';
import AiModal from '../components/AiModal';
import FunnelStage from '../components/Journey/FunnelStage';

const JourneyMap: React.FC = () => {
  const [journeyData, setJourneyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAi, setShowAi] = useState(false);
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
    
    if (validation.success) {
      try {
        const data = await hubSpotService.fetchJourneyData();
        setJourneyData(data);
      } catch (e) {
        console.error("Journey fetch error:", e);
      }
    }
    setIsLoading(false);
  };

  const stageIcons = {
    discovery: Target,
    engagement: Waves,
    qualification: Zap,
    opportunity: GitFork,
    retention: UserCheck
  };

  const stageColors = {
    discovery: '#6366f1',
    engagement: '#818cf8',
    qualification: '#f43f5e',
    opportunity: '#fbbf24',
    retention: '#10b981'
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-500'}`}></div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Revenue Architecture</span>
            </div>
            <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
                Journey <span className="gradient-text">Map.</span>
            </h1>
            <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
                Visualize the high-velocity path from unknown visitor to long-term evangelist. Audit the automation nodes powering each stage.
            </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={loadData}
            className="p-3 glass-button border-slate-200 text-slate-600 hover:text-slate-900 transition-all active:scale-90"
            title="Refresh Journey Data"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button 
            onClick={() => {
                const stagesStr = journeyData?.stages.map((s: any) => `- ${s.title}: ${s.count} contacts (${s.workflows} Workflows, ${s.sequences} Sequences)`).join('\n');
                setAuditPrompt(
                    `Analyze this 5-Stage Customer Journey for structural leaks:\n\n${stagesStr}\n\n` +
                    `1. Which stage is the "Bottle-neck" based on volume and drop-off?\n` +
                    `2. Do we have enough automation coverage (Workflows/Sequences) for the ${journeyData?.stages[3].title} stage?\n` +
                    `3. Propose a "High Velocity" remediation plan to increase lead-to-deal conversion by 20%.`
                );
                setShowAi(true);
            }}
            title="Audit Revenue Flow"
            className="px-8 py-3 premium-gradient text-slate-900 rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Audit Revenue Flow
          </button>
        </div>
      </div>

       {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
                 <ShieldCheck className="text-indigo-400" size={32} />
             </div>
             <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">Sync Required</h3>
                 <p className="text-slate-600 mt-2 font-medium">Connect Sales Hub to visualize your revenue pipeline architecture.</p>
             </div>
         </div>
      )}

      {isConnected && journeyData && (
        <div className="space-y-12">
            {/* The Great Funnel */}
            <div className="flex flex-col lg:flex-row gap-0 items-stretch">
                {journeyData.stages.map((stage: any, idx: number) => (
                    <FunnelStage 
                        key={stage.id}
                        title={stage.title}
                        subTitle={stage.subTitle}
                        count={stage.count}
                        icon={(stageIcons as any)[stage.id]}
                        color={(stageColors as any)[stage.id]}
                        workflows={stage.workflows}
                        sequences={stage.sequences}
                        dropOff={stage.dropOff}
                        isLast={idx === journeyData.stages.length - 1}
                    />
                ))}
            </div>

            {/* Impact Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="glass-card p-8 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                    <div className="flex items-center gap-3 mb-4">
                        <TrendingUp size={20} className="text-indigo-500" />
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Velocity Score</h4>
                    </div>
                    <p className="text-4xl font-extrabold text-slate-900 tracking-tighter">{journeyData.velocityScore || 0}%</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">
                        {journeyData.velocityScore > 80 ? 'Elite Acceleration' : (journeyData.velocityScore > 50 ? 'High Potential' : 'Stalled Engine')}
                    </p>
                </div>

                <div className="glass-card p-8 flex flex-col justify-between relative overflow-hidden group hover:border-rose-500/30 transition-all">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all"></div>
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle size={20} className="text-rose-500" />
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Leakage Points</h4>
                    </div>
                    <p className="text-4xl font-extrabold text-slate-900 tracking-tighter">
                        {String(journeyData.stages.filter((s: any) => s.dropOff > 30).length).padStart(2, '0')}
                    </p>
                    <p className="text-[10px] text-rose-500/60 font-bold mt-2 uppercase tracking-widest">
                        {journeyData.stages.filter((s: any) => s.dropOff > 30).length > 0 ? 'Critical Optimization Required' : 'Healthy Flow'}
                    </p>
                </div>

                <div className="glass-card p-8 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                    <div className="flex items-center gap-3 mb-4">
                        <Sparkles size={20} className="text-emerald-500" />
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Growth Opportunity</h4>
                    </div>
                    <p className="text-4xl font-extrabold text-slate-900 tracking-tighter">+$124k</p>
                    <p className="text-[10px] text-emerald-500/60 font-bold mt-2 uppercase tracking-widest">Estimated Pipeline Lift</p>
                </div>
            </div>
        </div>
      )}

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="data"
        contextName="Revenue Architecture Audit"
        initialPrompt={auditPrompt}
      />
    </div>
  );
};

export default JourneyMap;
