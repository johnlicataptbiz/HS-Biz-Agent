import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Zap, ArrowUpRight, ShieldCheck, TrendingUp, MoreHorizontal, Link as LinkIcon, Sparkles, Target, Cpu, ShieldAlert, Bot, Users, RefreshCw, Database, Trophy, FileText, LayoutDashboard } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';
import { organizationService } from '../services/organizationService';
import { getApiUrl } from '../services/config';
import AiModal from '../components/AiModal';
import AuditReportModal from '../components/AuditReportModal';
import { JourneyFunnel } from '../components/JourneyFunnel';
import LeakageCard from '../components/Dashboard/LeakageCard';
import { SentimentCard } from '../components/Dashboard/SentimentCard';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    workflows: [] as any[],
    sequences: [] as any[],
    properties: [] as any[],
    segments: [] as any[],
    campaigns: [] as any[],
    forms: [] as any[],
    deals: [] as any[],
    contactHealth: { 
      totalScanned: 0, 
      unclassified: 0, 
      unassigned: 0, 
      inactive: 0, 
      healthScore: 0,
      lifecycleStageBreakdown: {} as Record<string, number>
    },
    journeyData: null as any,
    sentiment: null as any,
    priorityLeads: [] as any[],
    mission: null as any,
    forecast: null as any,
    revopsAudit: null as any,
    pipelineStats: {} as Record<string, any>,
    owners: [] as any[],
    // Phase 4 Metrics
    velocity: null as any,
    winLoss: null as any,
    topAssets: [] as any[]
  });
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [auditPrompt, setAuditPrompt] = useState('');
  const [isHealing, setIsHealing] = useState(false);


  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const validation = await hubSpotService.validateConnection();
        if (!isMounted) return;

        setIsConnected(validation.success);
        
        if (validation.success) {
          const results = await Promise.all([
            hubSpotService.fetchWorkflows(),
            hubSpotService.fetchSequences(),
            hubSpotService.fetchProperties(),
            hubSpotService.fetchSegments(),
            hubSpotService.fetchCampaigns(),
            hubSpotService.fetchForms(),
            hubSpotService.fetchDeals(),
            hubSpotService.scanContactOrganization(),
            hubSpotService.fetchJourneyData(),
            hubSpotService.fetchMarketSentiment(),
            hubSpotService.fetchPriorityLeads(),
            hubSpotService.fetchOwners(),
            hubSpotService.fetchPipelineStats(),
            organizationService.auditRevenueArchitecture(),
            // Phase 4 Fetches
            fetch(getApiUrl('/api/velocity')).then(r => r.json()).catch(() => ({})),
            fetch(getApiUrl('/api/win-loss')).then(r => r.json()).catch(() => ({})),
            fetch(getApiUrl('/api/assets')).then(r => r.json()).catch(() => ({}))
          ]);
          
          if (isMounted) {
            const [wf, seq, prop, seg, camp, forms, deals, contactHealth, journeyData, sentiment, priorityLeads, owners, pipelineStats, revopsAudit, velocityData, winLossData, assetsData] = results;
            setMetrics({ 
              workflows: wf, 
              sequences: seq, 
              properties: prop, 
              segments: seg, 
              campaigns: camp, 
              forms, 
              deals, 
              contactHealth: contactHealth,
              journeyData: journeyData,
              sentiment: sentiment,
              priorityLeads: priorityLeads,
              mission: null,
              forecast: null,
              owners,
              pipelineStats,
              revopsAudit,
              velocity: velocityData?.success ? velocityData : null,
              winLoss: winLossData?.success ? winLossData : null,
              topAssets: assetsData?.success ? assetsData.assets : []
            });
          }
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    window.addEventListener('hubspot_connection_changed', loadData);
    return () => {
      isMounted = false;
      window.removeEventListener('hubspot_connection_changed', loadData);
    };
  }, []);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${Number(val).toFixed(0)}`;
  };

  const StatCard = ({ title, value, sub, icon: Icon, colorClass, gradient, onClick, active }: any) => {
    return (
      <div 
        className={`glass-card p-8 group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''} ${ active ? 'ring-1 ring-white/10' : ''}`}
        onClick={onClick}
      >
        <div className={`absolute -right-6 -top-6 w-32 h-32 ${gradient} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`}></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
             <div className={`p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-900 shadow-xl`}>
               <Icon size={28} />
             </div>
             <div className="text-[10px] font-bold text-slate-900/40 uppercase tracking-[0.2em]">{active ? 'Live' : 'Cached'}</div>
          </div>
          
          <div className="space-y-1">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tighter">{loading ? '...' : value}</span>
            <h2 className="text-sm font-bold text-slate-600 mt-2 uppercase tracking-wider">{title}</h2>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`}></div>
                <p className="text-xs text-slate-600 font-bold">{sub}</p>
            </div>
            {onClick && (
              <ArrowUpRight size={14} className="text-slate-600 group-hover:text-slate-900 group-hover:scale-125 transition-all" />
            )}
          </div>
        </div>
      </div>
    );
  };

  // Safe Accessors for Phase 4 Data
  const velocityMonth = metrics.velocity?.velocity?.revenuePerMonth || 0;
  const winRate = metrics.winLoss?.cohorts?.won && (metrics.winLoss.cohorts.won.count + (metrics.winLoss.cohorts.lost?.count || 0)) > 0
      ? ((metrics.winLoss.cohorts.won.count / (metrics.winLoss.cohorts.won.count + (metrics.winLoss.cohorts.lost?.count || 0))) * 100).toFixed(1)
      : '0.0';
  const topAssetName = metrics.topAssets.length > 0 ? metrics.topAssets[0].form_name : 'N/A';
  const topAssetRev = metrics.topAssets.length > 0 ? metrics.topAssets[0].total_revenue : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-indigo-500 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Commercial Operations</span>
          </div>
          <div className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Command <span className="gradient-text">Center.</span>
          </div>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            Unified view of your revenue architecture. Converting raw activity into strategic velocity.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
             {/* Header Actions (Deep Audit, etc.) */}
             <button 
               className="glass-button px-6 py-3 text-sm font-bold flex items-center gap-2 hover:scale-105 transition-all"
               onClick={() => setShowAuditModal(true)}
             >
                 <Sparkles size={16} className="text-indigo-400" />
                 Launch Optimizer
             </button>
        </div>
      </div>


      {/* Core Insights Grid - Phase 4 Integrated */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        
        {/* 1. PIPELINE VELOCITY */}
        <div className="lg:col-span-1">
             <StatCard 
                title="Pipeline Velocity" 
                value={formatCurrency(velocityMonth)}
                sub="Projected Revenue / Month"
                icon={Zap} 
                colorClass="bg-violet-500"
                gradient="from-violet-500 to-purple-600"
                onClick={() => onNavigate && onNavigate('velocity')}
                active={!!metrics.velocity}
            />
        </div>

        {/* 2. WIN EFFICIENCY */}
        <div className="lg:col-span-1">
             <StatCard 
                title="Win Efficiency" 
                value={`${winRate}%`}
                sub={`${metrics.winLoss?.cohorts?.won?.count || 0} Deals Won (All Time)`}
                icon={Trophy} 
                colorClass="bg-emerald-500"
                gradient="from-emerald-500 to-teal-400"
                onClick={() => onNavigate && onNavigate('win-loss')}
                active={!!metrics.winLoss}
            />
        </div>

        {/* 3. TOP ASSET */}
        <div className="lg:col-span-1">
             <StatCard 
                title="Top Lead Magnet" 
                value={loading ? '...' : (topAssetName.length > 15 ? topAssetName.substring(0, 15) + '...' : topAssetName)}
                sub={`Generated ${formatCurrency(topAssetRev)}`}
                icon={FileText} 
                colorClass="bg-pink-500"
                gradient="from-pink-500 to-rose-500"
                onClick={() => onNavigate && onNavigate('assets')}
                active={metrics.topAssets.length > 0}
            />
        </div>

        {/* 4. SENTIMENT / HEALTH */}
        <div className="lg:col-span-1">
            <SentimentCard data={metrics.sentiment} loading={loading} />
        </div>
      </div>
 
      {/* Revenue Architecture & Leakage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-10 flex flex-col space-y-8">
             <div className="flex justify-between items-center">
                <div>
                     <h2 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">Revenue <span className="gradient-text">Architecture.</span></h2>
                     <p className="text-slate-600 text-xs font-bold uppercase tracking-widest mt-1">Pipeline Stage Distribution & Heatmap</p>
                </div>
                 <div className="flex gap-4">
                     <div className="text-right">
                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Open Opps</span>
                         <span className="text-lg font-black text-slate-900">{metrics.velocity?.components?.openOpportunities || 0}</span>
                     </div>
                 </div>
            </div>

            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                        data={Object.values(metrics.pipelineStats)} 
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                            dataKey="label" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                            itemStyle={{ color: '#818cf8', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {Object.values(metrics.pipelineStats).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#4f46e5' : '#818cf8'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
            <LeakageCard />
            
             <div className="glass-card p-8 bg-indigo-500/5">
                <div className="flex items-center gap-3 mb-4">
                    <Bot className="text-indigo-400" size={20} />
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest italic">RevOps Audit</h3>
                </div>
                <div className="space-y-4">
                    {metrics.revopsAudit?.bottlenecks?.slice(0, 2).map((b: any, i: number) => (
                        <div key={i} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={10} className={b.impact === 'High' ? 'text-rose-500' : 'text-amber-500'} />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{b.stage}</span>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-tight font-medium">{b.issue}</p>
                        </div>
                    ))}
                    <button 
                        onClick={() => setShowAuditModal(true)}
                        className="w-full py-3 text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-slate-900 transition-colors border-t border-slate-200 mt-4"
                    >
                        Launch Full Audit →
                    </button>
                </div>
            </div>
        </div>
      </div>

       {/* Journey Funnel Visualization */}
        {isConnected && !loading && metrics.contactHealth.lifecycleStageBreakdown && (
            <div className="mt-8">
                <JourneyFunnel data={metrics.contactHealth.lifecycleStageBreakdown} />
            </div>
        )}

      <AuditReportModal 
         isOpen={showAuditModal} 
         onClose={() => setShowAuditModal(false)}
         onRunAiRefinement={(prompt) => {
             setAuditPrompt(prompt);
             setShowAiModal(true);
         }}
      />

      <AiModal 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)}
        contextType="workflow"
        contextName="Global Portal Audit"
        initialPrompt={auditPrompt}
      />
    </div>
  );
};

export default Dashboard;
