import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Zap, ArrowUpRight, ShieldCheck, TrendingUp, MoreHorizontal, Link as LinkIcon, Sparkles, Target, Cpu, ShieldAlert, Bot, Users, RefreshCw, Database } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';
import { organizationService } from '../services/organizationService';
import AiModal from '../components/AiModal';
import AuditReportModal from '../components/AuditReportModal';
import { JourneyFunnel } from '../components/JourneyFunnel';
import LeakageCard from '../components/Dashboard/LeakageCard';
import { VelocityForecaster } from '../components/Dashboard/VelocityForecaster';
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
    owners: [] as any[]
  });
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [auditPrompt, setAuditPrompt] = useState('');
  const [isHealing, setIsHealing] = useState(false);

  // ... (keep previous loadData logic)


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
            organizationService.auditRevenueArchitecture()
          ]);
          
          if (isMounted) {
            const [wf, seq, prop, seg, camp, forms, deals, contactHealth, journeyData, sentiment, priorityLeads, owners, pipelineStats, revopsAudit] = results;
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
              revopsAudit
            });
          }
        } else {
          if (isMounted) {
            setMetrics({ 
              workflows: [], 
              sequences: [], 
              properties: [], 
              segments: [], 
              campaigns: [], 
              forms: [], 
              deals: [], 
              contactHealth: { 
                totalScanned: 0, 
                unclassified: 0, 
                unassigned: 0, 
                inactive: 0, 
                healthScore: 0,
                lifecycleStageBreakdown: {}
              },
              journeyData: null,
              sentiment: null,
              priorityLeads: [],
              mission: null,
              forecast: null,
              owners: [],
              pipelineStats: {},
              revopsAudit: null
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

  const activeWorkflows = metrics.workflows.filter((w: any) => w.enabled).length;
  const criticalWorkflows = metrics.workflows.filter((w: any) => !w.enabled && w.enrolledCount > 0).length;
  const redundantProps = metrics.properties.filter((p: any) => p.redundant).length;
  const leadMagnets = metrics.forms.filter((f: any) => f.leadMagnet).length;
  
  const healthData = React.useMemo(() => [
    { 
      name: 'Workflows', 
      score: metrics.workflows.length > 0 
        ? Math.round(metrics.workflows.reduce((acc: number, w: any) => acc + (w.aiScore || 0), 0) / metrics.workflows.length) 
        : 0, 
      color: '#818cf8' 
    },
    { 
      name: 'Sequences', 
      score: metrics.sequences.length > 0 
        ? Math.round(metrics.sequences.reduce((acc: number, s: any) => acc + (s.aiScore || 0), 0) / metrics.sequences.length) 
        : 0, 
      color: '#34d399' 
    },
    { 
      name: 'Database',
      score: metrics.properties.length > 0 
        ? Math.max(0, 100 - Math.min(Math.round((redundantProps / metrics.properties.length) * 100), 100))
        : 0, 
      color: '#fbbf24' 
    },
    {
      name: 'Marketing',
      score: metrics.forms.length > 0
        ? Math.round(metrics.forms.reduce((acc: number, f: any) => acc + (f.aiScore || 0), 0) / metrics.forms.length)
        : 0,
      color: '#f43f5e'
    }
  ], [metrics.workflows, metrics.sequences, metrics.properties, metrics.forms, redundantProps]);

  const overallScore = React.useMemo(() => 
    healthData.length > 0 ? Math.round(healthData.reduce((acc: number, d: any) => acc + d.score, 0) / healthData.length) : 0
  , [healthData]);

  const StatCard = ({ title, value, sub, icon: Icon, colorClass, gradient, onClick }: any) => {
    return (
      <div 
        className={`glass-card p-8 group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <div className={`absolute -right-6 -top-6 w-32 h-32 ${gradient} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`}></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
             <div className={`p-4 rounded-2xl bg-white/5 border border-white/10 text-white shadow-xl`}>
               <Icon size={28} />
             </div>
             <div className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em]">Real-time</div>
          </div>
          
          <div className="space-y-1">
            <span className="text-4xl font-extrabold text-white tracking-tighter">{loading ? '...' : value}</span>
            <h2 className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-wider">{title}</h2>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`}></div>
                <p className="text-xs text-slate-400 font-bold">{sub}</p>
            </div>
            {onClick && (
              <ArrowUpRight size={14} className="text-slate-400 group-hover:text-white group-hover:scale-125 transition-all" />
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!isConnected || metrics.workflows.length === 0 || metrics.mission) return;

    const fetchMission = async () => {
        const briefing = await organizationService.fetchDailyMission({
            overallScore,
            redundantProps,
            priorityLeads: metrics.priorityLeads || [],
            criticalWorkflows: metrics.workflows.filter((w: any) => w.enabled && (w.enrolledCount || 0) === 0).length
        });
        if (briefing) setMetrics(prev => ({ ...prev, mission: briefing }));
    };

    fetchMission();

    const fetchForecast = async () => {
        const forecast = await organizationService.fetchStrategicForecast({
            overallScore,
            velocityScore: metrics.journeyData?.velocityScore || 0,
            dealsCount: metrics.deals.length,
            priorityLeadsCount: metrics.priorityLeads.length
        });
        if (forecast) setMetrics(prev => ({ ...prev, forecast }));
    };

    fetchForecast();
  }, [isConnected, metrics.workflows, metrics.priorityLeads, overallScore, redundantProps, metrics.journeyData, metrics.deals.length]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Daily Mission Briefing */}
      {metrics.mission && (
          <div className="glass-card p-6 border-indigo-500/30 bg-indigo-500/10 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Sparkles size={48} className="text-indigo-400" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Operational Directive</span>
                          <div className="h-0.5 flex-1 bg-indigo-500/20"></div>
                      </div>
                      <h2 className="text-2xl font-black text-white italic tracking-tight">{metrics.mission.slogan}</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {(metrics.mission.objectives || []).map((obj: any, i: number) => (
                              <div key={i} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${obj.priority === 'High' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{obj.category}</span>
                                  </div>
                                  <p className="text-sm font-bold text-white leading-tight">{obj.title}</p>
                                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{obj.description}</p>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="md:border-l border-white/10 md:pl-8 flex flex-col items-center justify-center space-y-2 min-w-[120px]">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mission Focus</span>
                      <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 flex items-center justify-center">
                          <Zap size={24} className="text-indigo-400" />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-indigo-500 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Strategic Operations Engine</span>
          </div>
          <div className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Strategic <span className="gradient-text">Intelligence.</span>
          </div>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Enterprise-grade CRM analysis and business growth heuristics. Identify critical architecture bottlenecks and automated scaling opportunities for your organization.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
            <div className={`px-5 py-3 glass-card flex items-center gap-3 ${
              localStorage.getItem('hubspot_client_id') === '9d7c3c51-862a-4604-9668-cad9bf5aed93' 
                ? 'border-indigo-500/50 bg-indigo-500/10' 
                : 'border-emerald-500/20'
            }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected 
                    ? (localStorage.getItem('hubspot_client_id') === '9d7c3c51-862a-4604-9668-cad9bf5aed93' ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]')
                    : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                }`}></div>
                <span className="text-xs font-bold text-white uppercase tracking-widest whitespace-nowrap">
                  {isConnected 
                    ? (localStorage.getItem('hubspot_client_id') === '9d7c3c51-862a-4604-9668-cad9bf5aed93' ? 'MCP Bridge Active' : 'Heuristics Active') 
                    : 'Offline Mode'}
                </span>
            </div>
            <button 
              id="launch-audit-btn"
              className="glass-button px-6 py-3 text-sm font-bold flex items-center gap-2 hover:scale-105 transition-all" 
              title="Generate Audit"
              aria-label="Generate deep audit"
              onClick={() => {
                hubSpotService.validateConnection().then(v => {
                  if (v.success) {
                    setShowAuditModal(true);
                  } else {
                    alert("Please connect your HubSpot portal to run an audit.");
                  }
                });
              }}
            >
                <Sparkles size={16} className="text-indigo-400" />
                Generate Deep Audit
            </button>
            {/* Performance Quick Actions Trigger */}
            {isHealing && (
                <div className="glass-card p-4 border-indigo-500/30 bg-indigo-500/10 animate-pulse flex items-center gap-3">
                    <RefreshCw className="animate-spin text-indigo-400" size={16} />
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Autonomous Healing Engaged: Optimizing Ghost Workflows...</span>
                </div>
            )}
            <button 
              onClick={async () => {
                if (!window.confirm("This will automatically pause all active workflows with zero enrollments (Ghost Workflows) to optimize API usage. Proceed?")) return;
                setIsHealing(true);
                try {
                    const token = localStorage.getItem('hubspot_access_token');
                    const ghosts = metrics.workflows.filter((w: any) => w.enabled && (w.enrolledCount || 0) === 0);
                    const resp = await fetch('/api/remediate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'pause-ghosts',
                            hubspotToken: token,
                            payload: { workflowIds: ghosts.map(g => g.id) }
                        })
                    });
                    const data = await resp.json();
                    if (data.success) {
                        alert(`Self-Heal Complete: Paused ${data.processed} ghost workflows.`);
                        window.location.reload(); 
                    }
                } catch (e) {
                    alert("Self-healing failed.");
                } finally {
                    setIsHealing(false);
                }
              }}
              disabled={isHealing || !isConnected}
              className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all border ${
                isHealing ? 'bg-slate-800 text-slate-500 border-white/5' : 'glass-button border-rose-500/20 text-rose-400 hover:bg-rose-500/10'
              }`}
              title="Pause Ghost Workflows"
            >
                {isHealing ? <RefreshCw size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                {isHealing ? 'Healing...' : 'Self-Heal Portal'}
            </button>
        </div>
      </div>


      {/* Core Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
            <LeakageCard />
        </div>
        <div className="lg:col-span-1">
            {metrics.journeyData ? (
                <VelocityForecaster 
                    velocityScore={metrics.journeyData.velocityScore || 75} 
                    totalPipelineValue={metrics.deals.reduce((acc, d) => acc + (d.amount || 0), 0)} 
                />
            ) : (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 h-full flex items-center justify-center text-slate-500 italic text-xs">
                    Loading Forecast...
                </div>
            )}
        </div>
        <div className="lg:col-span-1">
            <SentimentCard data={metrics.sentiment} loading={loading} />
        </div>
        <div className="lg:col-span-1">
            <StatCard 
                title="Campaign ROI" 
                value={metrics.campaigns.length > 0 ? `$${Math.round(metrics.campaigns.reduce((acc, c) => acc + (c.revenue || 0), 0) / 1000)}k` : '$0'}
                sub={`${metrics.campaigns.length} Active Feeds`}
                icon={TrendingUp} 
                colorClass="bg-emerald-500"
                gradient="from-emerald-500 to-teal-600"
                onClick={() => onNavigate && onNavigate('campaigns')}
            />
        </div>
      </div>
 
      {/* Revenue Architecture Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-10 flex flex-col space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Revenue <span className="gradient-text">Architecture.</span></h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Pipeline Stage Distribution & Heatmap</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Stalled Deals</span>
                        <span className="text-lg font-black text-amber-500">{metrics.revopsAudit?.stalledDeals || 0}</span>
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
            <div className="glass-card p-8 border-l-4 border-indigo-500">
                <div className="flex items-center gap-3 mb-6">
                    <Users className="text-indigo-400" size={20} />
                    <h3 className="font-black text-white text-sm uppercase tracking-widest italic">Team Intelligence</h3>
                </div>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Ownership Coverage</span>
                            <span className="text-xs font-black text-white">
                                {metrics.contactHealth.totalScanned > 0 
                                    ? Math.round(((metrics.contactHealth.totalScanned - metrics.contactHealth.unassigned) / metrics.contactHealth.totalScanned) * 100) 
                                    : 0}%
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-1000" 
                                style={{ width: `${metrics.contactHealth.totalScanned > 0 ? ((metrics.contactHealth.totalScanned - metrics.contactHealth.unassigned) / metrics.contactHealth.totalScanned) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Active Owners</span>
                            <span className="text-xl font-black text-white">{metrics.owners.length}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-rose-500">
                            <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Unassigned</span>
                            <span className="text-xl font-black">{metrics.contactHealth.unassigned}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card p-8 bg-indigo-500/5">
                <div className="flex items-center gap-3 mb-4">
                    <Bot className="text-indigo-400" size={20} />
                    <h3 className="font-black text-white text-sm uppercase tracking-widest italic">RevOps Audit</h3>
                </div>
                <div className="space-y-4">
                    {metrics.revopsAudit?.bottlenecks?.slice(0, 2).map((b: any, i: number) => (
                        <div key={i} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={10} className={b.impact === 'High' ? 'text-rose-500' : 'text-amber-500'} />
                                <span className="text-[10px] font-black text-white uppercase tracking-tighter">{b.stage}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight font-medium">{b.issue}</p>
                        </div>
                    ))}
                    <button className="w-full py-3 text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors border-t border-white/5 mt-4">
                        Launch Full Audit →
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Deep Breakdown */}
        <div className="lg:col-span-2 glass-card p-10 flex flex-col space-y-10">
          <div className="flex justify-between items-start">
             <div>
                <h2 className="text-2xl font-bold text-white">Heuristic Score Breakdown</h2>
                <p className="text-slate-400 mt-2 font-medium">Categorized performance metrics against industry benchmarks.</p>
             </div>
             <div className="flex items-center gap-2 glass-card border-white/5 px-4 py-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Secure Data</span>
             </div>
          </div>

          <div className="flex-1 min-h-[350px] w-full">
            <ResponsiveContainer width="100%" height={350}>
              {!isConnected || loading || overallScore === 0 ? (
                <div className="h-full w-full flex items-center justify-center border border-dashed border-white/10 rounded-3xl text-slate-400 font-bold uppercase tracking-widest text-xs">
                    Insufficient Data for Visualization
                </div>
              ) : (
                <BarChart data={healthData} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={150} 
                      tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 700 }} 
                      axisLine={false} 
                      tickLine={false} 
                  />
                  <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.03)'}}
                      contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          borderRadius: '16px', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)',
                          padding: '12px'
                      }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Bar 
                    dataKey="score" 
                    radius={[0, 12, 12, 0]} 
                    barSize={40}
                    isAnimationActive={false}
                  >
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/5">
                <div>
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2">Automation Health</p>
                    <p className="text-xl font-bold text-white">{isConnected ? (overallScore > 0 ? "Scanning" : "Pending") : "No Connection"}</p>
                </div>
                <div>
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2">Schema Stability</p>
                    <p className="text-xl font-bold text-white">{isConnected ? (redundantProps > 5 ? "Critical" : "Stable") : "No Connection"}</p>
                </div>
                <div>
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2">Lead Momentum</p>
                    <p className="text-xl font-bold text-indigo-400">{isConnected ? "Live Stream" : "N/A"}</p>
                </div>
          </div>
        </div>
      </div>

      {/* Intelligence Actions */}
        <div className="glass-card p-10 space-y-8 min-h-[500px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Cpu size={150} className="text-indigo-400" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase underline decoration-indigo-500/50 underline-offset-8">Strategy <span className="gradient-text">Command.</span></h2>
              <p className="text-slate-400 text-sm font-medium pt-2">Algorithmic forecasts and priority lead intercepts.</p>
            </div>
            
            {isConnected && !loading && metrics.forecast && (
                <div className="flex items-center gap-6 px-6 py-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Forecast</p>
                        <p className="text-2xl font-black text-white italic">+{metrics.forecast.projectedGrowth}%</p>
                    </div>
                    <div className="w-px h-8 bg-indigo-500/20"></div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Velocity</p>
                        <p className="text-sm font-bold text-white uppercase">{metrics.forecast.revenueVelocity}</p>
                    </div>
                </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
            {/* Priority Intercepts */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Priority Intercepts</p>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Top 4 Intent</span>
                </div>
                <div className="space-y-3">
                    {isConnected && !loading && metrics.priorityLeads.length > 0 ? metrics.priorityLeads.map((lead: any) => (
                        <div key={lead.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-xs font-bold text-white bg-slate-900">
                                    {lead.name.charAt(0)}
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-white block group-hover:text-indigo-400 transition-colors uppercase italic">{lead.name}</span>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{lead.title || 'Decision Maker'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-indigo-400">{lead.priority}%</span>
                                <button className="p-2 rounded-lg bg-slate-900 text-slate-500 hover:text-white transition-colors" title="View Strategic Insights">
                                    <Sparkles size={12} />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center border border-dashed border-white/5 rounded-2xl text-xs text-slate-500 font-bold uppercase">
                            {isConnected ? "Scanning for high-intent signals..." : "Connection Required"}
                        </div>
                    )}
                </div>
            </div>

            {/* Strategic Analysis */}
            <div className="space-y-4">
                <div className="px-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Forecast Analysis</p>
                </div>
                {isConnected && !loading && metrics.forecast ? (
                    <div className="glass-card p-6 bg-slate-900 border-indigo-500/20 h-full flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Top Lever</p>
                                <p className="text-sm font-bold text-white leading-relaxed">{metrics.forecast.topOpportunity}</p>
                            </div>
                            <div className="space-y-2">
                                {metrics.forecast.riskFactors.map((risk: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                                        <AlertTriangle size={12} className="text-rose-500" />
                                        {risk}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Confidence 88%</span>
                            <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">Apply strategy</button>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-8 border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4 h-full">
                        <TrendingUp size={32} className="text-slate-700 animate-pulse" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {isConnected ? "Running growth simulations..." : "Forecast Unavailable"}
                        </p>
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* Journey Funnel Visualization */}
        {isConnected && !loading && metrics.contactHealth.lifecycleStageBreakdown && (
            <div className="mt-8">
                <JourneyFunnel data={metrics.contactHealth.lifecycleStageBreakdown} />
            </div>
        )}
        
        <button 
            className="w-full py-5 rounded-3xl premium-gradient text-white text-sm font-bold shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all mt-8" 
            title="Optimizer"
            onClick={() => setShowAuditModal(true)}
        >
            Launch Heuristic Optimizer
        </button>

      {/* Connection Prompt for Demo Users */}
      {!isConnected && !loading && (
        <div className="glass-card p-10 border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden">
          <div className="absolute top-1/2 -translate-y-1/2 right-0 p-10 opacity-20 hidden lg:block">
             <img src="/logo.png" alt="Brand Logo" className="w-80 h-80 object-contain" />
          </div>
          <div className="relative z-10 max-w-2xl space-y-6">
            <h3 className="text-3xl font-bold text-white">Link your production environment.</h3>
            <p className="text-slate-400 text-lg font-medium leading-relaxed">
              Unlock real-time sequence debugging, workflow logic optimization, and CRM property consolidating by linking your HubSpot Pro/Enterprise portal.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                    <ShieldCheck size={18} className="text-emerald-400" />
                    Secure PKCE Auth
                </div>
                <div className={`w-1 h-1 rounded-full bg-slate-700 self-center`}></div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                    <Activity size={18} className="text-indigo-400" />
                    Strategic Insights
                </div>
            </div>
          </div>
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
