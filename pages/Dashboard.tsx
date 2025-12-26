import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Zap, ArrowUpRight, ShieldCheck, TrendingUp, MoreHorizontal, Link as LinkIcon, Sparkles, Target, Cpu, ShieldAlert, Bot } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';

const Dashboard: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    workflows: [] as any[],
    sequences: [] as any[],
    properties: [] as any[],
    segments: [] as any[],
    campaigns: [] as any[],
  });
  });

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const validation = await hubSpotService.validateConnection();
        if (!isMounted) return;

        setIsConnected(validation.success);
        
        const isMcp = localStorage.getItem('hubspot_client_id') === '9d7c3c51-862a-4604-9668-cad9bf5aed93';

        if (validation.success) {
          const [wf, seq, prop, seg, camp] = await Promise.all([
            hubSpotService.fetchWorkflows(),
            hubSpotService.fetchSequences(),
            hubSpotService.fetchProperties(),
            hubSpotService.fetchSegments(),
            hubSpotService.fetchCampaigns()
          ]);
          if (isMounted) {
            setMetrics({ workflows: wf, sequences: seq, properties: prop, segments: seg, campaigns: camp });
          }
        } else {
          if (isMounted) {
            setMetrics({ workflows: [], sequences: [], properties: [], segments: [], campaigns: [] });
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
      score: metrics.properties.length > 0 
        ? Math.max(0, 100 - Math.min(Math.round((redundantProps / metrics.properties.length) * 100), 100))
        : 0, 
      color: '#fbbf24' 
    },
    {
      name: 'Organization',
      score: metrics.segments.length > 0
        ? Math.round(metrics.segments.reduce((acc: number, s: any) => acc + (s.aiScore || 0), 0) / metrics.segments.length)
        : 0,
      color: '#c084fc'
    }
  ], [metrics.workflows, metrics.sequences, metrics.properties, metrics.segments, redundantProps]);

  const overallScore = React.useMemo(() => 
    healthData.length > 0 ? Math.round(healthData.reduce((acc: number, d: any) => acc + d.score, 0) / healthData.length) : 0
  , [healthData]);

  const StatCard = ({ title, value, sub, icon: Icon, colorClass, gradient }: any) => {
    return (
      <div className="glass-card p-8 group relative overflow-hidden transition-all duration-300 hover:-translate-y-1">
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
            <ArrowUpRight size={14} className="text-slate-400 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-indigo-500 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Strategic Analysis Engine</span>
          </div>
          <div className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Portal <span className="gradient-text">Intelligence.</span>
          </div>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Real-time heuristic analysis of your HubSpot environment. identifying critical bottlenecks, redundant architecture, and automated scaling opportunities.
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
              id="generate-audit-btn"
              className="glass-button px-6 py-3 text-sm font-bold flex items-center gap-2 hover:scale-105 transition-all" 
              title="Generate Audit"
              aria-label="Generate deep audit"
              onClick={() => {
                console.log("🧩 Dashboard: Deep audit requested.");
                hubSpotService.validateConnection().then(v => {
                  if (v.success) window.dispatchEvent(new Event('hubspot_connection_changed'));
                });
              }}
            >
                <Sparkles size={16} className="text-indigo-400" />
                Generate Deep Audit
            </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Consolidated Health" 
          value={isConnected && !loading ? `${overallScore}%` : "0%"} 
          sub={isConnected && !loading ? (overallScore > 0 ? "Analyzed" : "Pending Audit") : "Unauthorized"} 
          icon={Cpu} 
          colorClass="bg-indigo-400" 
          gradient="bg-indigo-500"
        />
        <StatCard 
          title="Active Automations" 
          value={isConnected && !loading ? activeWorkflows : "0"} 
          sub={isConnected && !loading ? `${criticalWorkflows} Stall Alerts` : "Limited Access"} 
          icon={Zap} 
          colorClass="bg-emerald-400" 
          gradient="bg-emerald-500"
        />
        <StatCard 
          title="Market Sequences" 
          value={isConnected && !loading ? metrics.sequences.length : "0"} 
          sub={isConnected && !loading ? "Live Vol Track" : "Inactive"} 
          icon={Target} 
          colorClass="bg-pink-400" 
          gradient="bg-pink-500"
        />
          title="Campaign Focus" 
          value={isConnected && !loading ? metrics.campaigns.length : "0"} 
          sub={isConnected && !loading ? `${metrics.segments.length} Lists Active` : "No Data"}
          icon={Target} 
          colorClass="bg-rose-400" 
          gradient="bg-rose-500"
        />
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

        {/* Intelligence Actions */}
        <div className="glass-card p-10 space-y-8 min-h-[500px]">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Intelligence Tasks</h2>
            <p className="text-slate-400 text-sm font-medium">AI-prioritized architectural improvements.</p>
          </div>
          
          <div className="space-y-4">
            {isConnected && !loading ? (
              [
                { label: `Fix ${criticalWorkflows} broken workflows`, impact: 'Critical', type: 'Architecture', color: 'text-indigo-400' },
                { label: `Refactor ${redundantProps} legacy properties`, impact: 'High', type: 'Database', color: 'text-amber-400' },
                { label: 'Optimize sequence outreach', impact: 'Medium', type: 'Sales', color: 'text-emerald-400' },
                { label: 'Scan for ghost list segments', impact: 'Medium', type: 'Cleanup', color: 'text-rose-400' },
              ].map((item, i) => (
                <div key={i} className="group flex items-center justify-between p-5 rounded-3xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm bg-slate-800 border border-white/5 ${item.color}`}>
                          {item.type.charAt(0)}
                      </div>
                      <div>
                          <span className="text-sm font-bold text-white group-hover:text-indigo-400 block transition-colors">{item.label}</span>
                          <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">{item.type}</span>
                              <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                              <span className={`text-[10px] font-extrabold uppercase tracking-widest ${item.impact === 'Critical' ? 'text-rose-500' : 'text-slate-400'}`}>
                                  {item.impact}
                              </span>
                          </div>
                      </div>
                  </div>
                  <ArrowUpRight size={18} className="text-slate-700 group-hover:text-white transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
              ))
            ) : (
                <div className="p-10 text-center border border-dashed border-white/5 rounded-3xl text-slate-400 font-bold uppercase tracking-widest text-[10px] italic">
                    Requires Secure Connection to Populate Task Queue
                </div>
            )}
          </div>
          
          <button className="w-full py-5 rounded-3xl premium-gradient text-white text-sm font-bold shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all" title="Optimizer">
            Launch Heuristic Optimizer
          </button>
        </div>
      </div>

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
    </div>
  );
};

export default Dashboard;
