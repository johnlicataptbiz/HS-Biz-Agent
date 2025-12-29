import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { fetchContactAnalytics } from '../services/contactAnalyticsService';
import { Form } from '../types';
import { BarChart3, TrendingUp, Download, PieChart, Info, ShieldCheck, Database, Users, Zap, Activity, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie } from 'recharts';

interface Analytics {
  formSubmissions: Record<string, number>;
  leadSources: Record<string, number>;
  lifecycleBreakdown: Record<string, { count: number; avgScore: number }>;
  activity: { last7Days: number; last30Days: number; last60Days: number; last90Days: number; total: number };
}

const Reports: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    // Load both HubSpot forms AND database analytics in parallel
    const [validation, dbAnalytics] = await Promise.all([
      hubSpotService.validateConnection(),
      fetchContactAnalytics()
    ]);
    
    setIsConnected(validation.success);
    setAnalytics(dbAnalytics);
    
    if (validation.success) {
      try {
        const data = await hubSpotService.fetchForms();
        setForms(data);
      } catch (e) {
        console.error(e);
      }
    }
    setIsLoading(false);
  };

  const leadMagnets = forms.filter(f => f.leadMagnet);
  
  // ENHANCED: Merge HubSpot form data with database analytics
  const chartData = leadMagnets
    .map((lm) => {
      // Use database submission count if available and higher
      const dbCount = analytics?.formSubmissions?.[lm.name] || 0;
      const apiCount = lm.submissions || 0;
      const submissions = Math.max(dbCount, apiCount);
      return {
        name: lm.name.length > 20 ? lm.name.substring(0, 20) + '...' : lm.name,
        conversions: Number(submissions),
      };
    })
    .filter(lm => lm.conversions > 0)
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);

  // Lead source chart data from database
  const leadSourceData = analytics?.leadSources 
    ? Object.entries(analytics.leadSources)
        .map(([name, count]) => ({ name: name.replace('_', ' '), value: count }))
        .slice(0, 6)
    : [];

  const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#22d3ee', '#a78bfa'];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${analytics ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">
                  {analytics ? 'Database Synced' : 'API Only'}
                </span>
              </div>
              <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
              Performance <span className="gradient-text">Reports.</span>
              </h1>
              <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
              Deep dive into your high-leverage assets. Data enhanced from local database.
              </p>
          </div>
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="p-3 glass-button border-white/5 text-slate-400 hover:text-white transition-all"
            title="Refresh data"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Activity Overview from Database */}
        {analytics?.activity && (
          <div className="grid grid-cols-4 gap-6">
            <div className="glass-card p-6 text-center">
              <p className="text-3xl font-black text-white">{analytics.activity.total.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Total Contacts</p>
            </div>
            <div className="glass-card p-6 text-center border-emerald-500/20">
              <p className="text-3xl font-black text-emerald-400">{analytics.activity.last7Days.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Active 7d</p>
            </div>
            <div className="glass-card p-6 text-center">
              <p className="text-3xl font-black text-indigo-400">{analytics.activity.last30Days.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Active 30d</p>
            </div>
            <div className="glass-card p-6 text-center">
              <p className="text-3xl font-black text-amber-400">{analytics.activity.last90Days.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Active 90d</p>
            </div>
          </div>
        )}

        {!isConnected && !analytics && (
            <div className="glass-card p-12 text-center space-y-6">
                <ShieldCheck className="text-indigo-400 mx-auto" size={40} />
                <h3 className="text-xl font-bold text-white">Connect HubSpot</h3>
                <p className="text-slate-400">Reports require live data access.</p>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Lead Magnets Chart */}
            <div className="glass-card p-8 border-indigo-500/20">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Top Performing Lead Magnets</h3>
                        <p className="text-xs text-slate-400 uppercase tracking-wider">
                          Conversions {analytics ? '(DB Enhanced)' : '(API Only)'}
                        </p>
                    </div>
                </div>
                
                <div className="h-64 w-full">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={150} tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                />
                                <Bar dataKey="conversions" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#fb7185' : '#818cf8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-white/5 rounded-2xl">
                            <BarChart3 size={32} className="mb-2 opacity-50" />
                            <p className="font-bold">No Data Available</p>
                            <p className="text-xs mt-1 text-slate-600 px-10 text-center">
                                Run a sync to populate lead magnet data from your database.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Lead Sources Pie Chart - FROM DATABASE */}
            <div className="glass-card p-8 border-emerald-500/20">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Database size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Lead Sources</h3>
                        <p className="text-xs text-slate-400 uppercase tracking-wider">From Database JSONB</p>
                    </div>
                </div>
                
                <div className="h-64 w-full">
                    {leadSourceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                                <Pie
                                    data={leadSourceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {leadSourceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                                />
                            </RechartsPie>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-white/5 rounded-2xl">
                            <PieChart size={32} className="mb-2 opacity-50" />
                            <p className="font-bold">No Source Data</p>
                            <p className="text-xs mt-1 text-slate-600 text-center">
                                Sync contacts to see lead source distribution.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="glass-card p-6 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Lead Magnets</p>
                    <h2 className="text-4xl font-extrabold text-white mt-2">{leadMagnets.length}</h2>
                </div>
                <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    <Download size={24} />
                </div>
             </div>

             <div className="glass-card p-6 flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Active Forms</p>
                    <h2 className="text-4xl font-extrabold text-white mt-2">{forms.length}</h2>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    <TrendingUp size={24} />
                </div>
             </div>

             <div className="glass-card p-6 border-amber-500/10 bg-amber-500/5">
                <div className="flex gap-3">
                    <Info className="text-amber-400 shrink-0" size={20} />
                    <div>
                        <h4 className="text-amber-400 font-bold text-sm">Database Insight</h4>
                        <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                            {analytics?.activity?.total 
                              ? `Your database has ${analytics.activity.total.toLocaleString()} synced contacts. ${analytics.activity.last7Days} were active this week.`
                              : "Sync your contacts to unlock database-powered analytics."
                            }
                        </p>
                    </div>
                </div>
             </div>
        </div>
    </div>
  );
};

export default Reports;

