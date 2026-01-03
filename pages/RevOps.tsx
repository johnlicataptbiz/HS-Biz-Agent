import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { organizationService } from '../services/organizationService';
import { 
  ShieldAlert, 
  Zap, 
  Target, 
  Users, 
  AlertTriangle, 
  RefreshCw, 
  BarChart3, 
  Activity,
  Bot,
  Brain,
  History,
  Lock,
  ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie } from 'recharts';

const RevOps: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [pipelineStats, setPipelineStats] = useState<any>({});
  const [ghostDeals, setGhostDeals] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);

    if (validation.success) {
      try {
        const [auditData, dealsData, ownersData, stats] = await Promise.all([
          organizationService.auditRevenueArchitecture(),
          hubSpotService.fetchDeals(),
          hubSpotService.fetchOwners(),
          hubSpotService.fetchPipelineStats()
        ]);
        setAudit(auditData);
        setDeals(dealsData);
        setOwners(ownersData);
        setPipelineStats(stats);
        setGhostDeals(organizationService.detectGhostDeals(dealsData));
      } catch (e) {
        console.error("RevOps load error:", e);
      }
    }
    setLoading(false);
  };

  const ownershipData = [
    { name: 'Assigned', value: deals.filter(d => d.properties.hubspot_owner_id).length, color: '#6366f1' },
    { name: 'Unassigned', value: deals.filter(d => !d.properties.hubspot_owner_id).length, color: '#f43f5e' }
  ];

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
            <div className="w-24 h-24 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
            <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={32} />
        </div>
        <p className="text-slate-500 font-black uppercase tracking-[0.4em] animate-pulse">Loading Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Control Center Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 py-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2">
                <Lock size={12} className="text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Admin Access</span>
            </div>
            <div className="h-px w-12 bg-slate-200"></div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 scale-animation"></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">All Systems Go</span>
            </div>
          </div>
          <h1 className="text-6xl font-black text-slate-900 italic tracking-tighter leading-none">
            Operations <span className="gradient-text">Control.</span>
          </h1>
          <p className="text-slate-600 max-w-xl font-bold uppercase tracking-widest text-[11px] leading-relaxed">
            Automatic monitoring of your sales pipeline and team performance.
          </p>
        </div>
        <button 
          onClick={loadData}
          className="flex items-center gap-3 px-8 py-4 glass-card bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900 font-black uppercase tracking-widest text-xs transition-all"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Sync Data
        </button>
      </div>

      {!isConnected ? (
        <div className="glass-card p-20 text-center space-y-8 border-dashed border-slate-200">
            <ShieldAlert size={64} className="text-slate-800 mx-auto" />
            <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Authentication Required</h3>
                <p className="text-slate-500 font-medium">Link your HubSpot portal to start managing your business operations.</p>
            </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Audit Summary Column */}
          <div className="lg:col-span-1 space-y-8">
            <div className="glass-card p-8 border-l-4 border-indigo-500">
                <div className="flex items-center gap-3 mb-8">
                    <Activity className="text-indigo-400" size={20} />
                    <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest italic">Health Score</h3>
                </div>
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="58" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                            <circle 
                                cx="64" cy="64" r="58" 
                                stroke="#6366f1" strokeWidth="8" 
                                fill="transparent" 
                                strokeDasharray={364}
                                strokeDashoffset={364 - (364 * (audit?.ownershipHealth?.score || 0)) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <span className="absolute text-3xl font-black text-slate-900 italic">{audit?.ownershipHealth?.score || 0}%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">System Health</p>
                </div>
                <div className="mt-8 pt-8 border-t border-slate-200 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-600 font-bold uppercase">Stalled Deals</span>
                        <span className="text-xs font-black text-rose-500">{ghostDeals.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-600 font-bold uppercase">Active Owners</span>
                        <span className="text-xs font-black text-indigo-400">{owners.length}</span>
                    </div>
                </div>
            </div>

            <div className="glass-card p-8 bg-indigo-500/5">
                <div className="flex items-center gap-3 mb-6">
                    <History className="text-indigo-400" size={20} />
                    <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest italic">Recent Audits</h3>
                </div>
                <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Ownership Scan</p>
                            <p className="text-[9px] text-slate-500 font-bold">2 HOURS AGO</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Pipeline Activity</p>
                            <p className="text-[9px] text-slate-500 font-bold">5 HOURS AGO</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    </div>
                </div>
            </div>
          </div>

          {/* Main Visuals Column */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Pipeline Distribution */}
            <div className="glass-card p-10 flex flex-col space-y-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase underline decoration-indigo-500 decoration-4 underline-offset-8">Pipeline <span className="gradient-text">Visualizer.</span></h2>
                        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] mt-3">See how deals flow through your stages</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-right">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Total Pipeline</span>
                            <span className="text-sm font-black text-slate-900 italic">
                                ${Math.round(deals.reduce((acc, d) => acc + (d.amount || 0), 0) / 1000000)}M
                            </span>
                        </div>
                    </div>
                </div>

                <div className="min-h-[400px]">
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={Object.values(pipelineStats)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey="label" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 10 }}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                                itemStyle={{ color: '#818cf8', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase' }}
                            />
                            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                {Object.values(pipelineStats).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#a855f7'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Strategic Intelligence Feed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Bottlenecks Card */}
                <div className="glass-card p-10 space-y-8 bg-indigo-500/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                            <AlertTriangle className="text-indigo-400" size={20} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase">Bottleneck <span className="text-indigo-400">Finder.</span></h3>
                    </div>
                    <div className="space-y-6">
                        {audit?.bottlenecks?.map((b: any, i: number) => (
                            <div key={i} className="group p-6 rounded-2xl bg-slate-100 border border-slate-200 hover:border-indigo-500/30 transition-all">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="px-2 py-1 rounded bg-indigo-500/20 text-[9px] font-black text-indigo-400 uppercase tracking-widest">{b.stage}</span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${b.impact === 'High' ? 'text-rose-500' : 'text-amber-500'}`}>{b.impact} Impact</span>
                                </div>
                                <p className="text-sm font-black text-slate-900 mb-2 leading-tight uppercase italic">{b.issue}</p>
                                <p className="text-xs text-slate-500 font-medium mb-4">{b.recommendation}</p>
                                <button className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-slate-900 transition-all uppercase tracking-widest">
                                    Deploy Fix <ArrowRight size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Team & Ownership Card */}
                <div className="glass-card p-10 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                            <Users className="text-emerald-400" size={20} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase">Deal <span className="text-emerald-400">Ownership.</span></h3>
                    </div>
                    
                    <div className="flex items-center justify-center h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={ownershipData} 
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                >
                                    {ownershipData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Ghost Deals Detected</span>
                            <span className="text-lg font-black text-rose-500 italic">{ghostDeals.length}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Strategy Priority</span>
                            <span className="text-xs font-black text-indigo-400 uppercase tracking-tighter underline underline-offset-4">{audit?.strategicPriority}</span>
                        </div>
                    </div>

                    <button className="w-full py-4 rounded-2xl premium-gradient text-slate-900 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Target size={16} />
                        Fix Issues
                    </button>
                </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default RevOps;
