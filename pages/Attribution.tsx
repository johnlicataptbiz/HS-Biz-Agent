import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../services/config';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Target, 
  RefreshCw, 
  ArrowRight,
  Sparkles,
  BarChart3,
  PieChart as PieIcon,
  Route
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';

interface Attribution {
  summary: {
    totalDeals: number;
    closedWon: number;
    closedRevenue: number;
    pipelineValue: number;
  };
  revenueByType: Array<{ type: string; count: number; revenue: number; avgDealSize: number }>;
  revenueBySource: Array<{ source: string; deals: number; revenue: number }>;
  revenueByForm: Array<{ form: string; dealType: string; deals: number; revenue: number }>;
  topPaths: Array<{ source: string; form: string; dealType: string; conversions: number; revenue: number }>;
}

const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#22d3ee', '#a78bfa', '#fb7185'];

const Attribution: React.FC = () => {
  const [data, setData] = useState<Attribution | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(getApiUrl('/api/attribution-analytics'));
      if (!resp.ok) throw new Error('Failed to fetch attribution data');
      const result = await resp.json();
      if (result.success) {
        setData(result.attribution);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${data ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">
              Customer Journey Intelligence
            </span>
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Revenue <span className="gradient-text">Attribution.</span>
          </h1>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            Track which lead magnets, forms, and sources generate Mastermind vs Clinical Rainmaker clients.
          </p>
        </div>
        <button 
          onClick={loadData}
          disabled={isLoading}
          className="p-3 glass-button border-slate-200 text-slate-600 hover:text-slate-900 transition-all"
          title="Refresh attribution data"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="glass-card p-6 border-rose-500/20 bg-rose-500/5">
          <p className="text-rose-400 font-bold">{error}</p>
          <p className="text-slate-600 text-sm mt-2">Sync deals to your database to see attribution data.</p>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-4 gap-6">
          <div className="glass-card p-6 text-center border-emerald-500/20">
            <p className="text-3xl font-black text-emerald-400">{formatCurrency(data.summary.closedRevenue)}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">Closed Revenue</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-black text-slate-900">{data.summary.closedWon}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">Closed Won</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-black text-indigo-400">{formatCurrency(data.summary.pipelineValue)}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">Pipeline Value</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-3xl font-black text-amber-400">{data.summary.totalDeals}</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">Total Deals</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue by Client Type */}
        <div className="glass-card p-8 border-indigo-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Revenue by Client Type</h3>
              <p className="text-xs text-slate-600 uppercase tracking-wider">Mastermind vs Clinical Rainmaker</p>
            </div>
          </div>
          
          <div className="h-64 w-full">
            {data?.revenueByType && data.revenueByType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByType} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="type" type="category" width={120} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {data.revenueByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                <Users size={32} className="mb-2 opacity-50" />
                <p className="font-bold">No Deal Data</p>
                <p className="text-xs mt-1 text-slate-600">Sync deals to see revenue by type.</p>
              </div>
            )}
          </div>

          {/* Type breakdown cards */}
          {data?.revenueByType && (
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200">
              {data.revenueByType.slice(0, 4).map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-100">
                  <p className="text-[10px] font-bold text-slate-600 uppercase">{item.type}</p>
                  <p className="text-xl font-black text-slate-900">{item.count} clients</p>
                  <p className="text-xs text-emerald-400 font-bold">{formatCurrency(item.avgDealSize)} avg</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue by Lead Source */}
        <div className="glass-card p-8 border-emerald-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Revenue by Lead Source</h3>
              <p className="text-xs text-slate-600 uppercase tracking-wider">Traffic Source Attribution</p>
            </div>
          </div>
          
          <div className="h-64 w-full">
            {data?.revenueBySource && data.revenueBySource.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.revenueBySource}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="revenue"
                    nameKey="source"
                    label={({ name, percent }) => `${name || ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.revenueBySource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                <PieIcon size={32} className="mb-2 opacity-50" />
                <p className="font-bold">No Source Data</p>
              </div>
            )}
          </div>

          {/* Source breakdown */}
          {data?.revenueBySource && (
            <div className="space-y-2 mt-6 pt-6 border-t border-slate-200">
              {data.revenueBySource.slice(0, 5).map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-sm text-slate-900 font-bold">{item.source}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-600">{item.deals} deals</span>
                    <span className="text-sm font-black text-emerald-400">{formatCurrency(item.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Converting Paths */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Route size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Top Converting Paths</h3>
            <p className="text-xs text-slate-600 uppercase tracking-wider">Source → Form → Client Type</p>
          </div>
        </div>

        {data?.topPaths && data.topPaths.length > 0 ? (
          <div className="space-y-4">
            {data.topPaths.map((path, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all group">
                <div className="text-2xl font-black text-slate-600 w-8">#{i + 1}</div>
                <div className="flex items-center gap-3 flex-1">
                  <span className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase">
                    {path.source}
                  </span>
                  <ArrowRight size={14} className="text-slate-600" />
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                    {path.form?.substring(0, 30) || 'Direct'}
                  </span>
                  <ArrowRight size={14} className="text-slate-600" />
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                    path.dealType === 'Mastermind' ? 'bg-purple-500/10 text-purple-400' :
                    path.dealType === 'Clinical Rainmaker' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-500/10 text-slate-600'
                  }`}>
                    {path.dealType}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-400">{formatCurrency(path.revenue)}</p>
                  <p className="text-[10px] text-slate-600 uppercase">{path.conversions} clients</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <Sparkles size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-slate-600 font-bold">No conversion paths yet</p>
            <p className="text-xs text-slate-500 mt-1">Closed-won deals with contact associations will appear here.</p>
          </div>
        )}
      </div>

      {/* Revenue by Form */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
            <BarChart3 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Revenue by Lead Magnet / Form</h3>
            <p className="text-xs text-slate-600 uppercase tracking-wider">Which assets generate paying clients</p>
          </div>
        </div>

        {data?.revenueByForm && data.revenueByForm.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.revenueByForm.filter(f => f.form !== 'Direct/Unknown').slice(0, 9).map((item, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all">
                <p className="text-sm font-bold text-slate-900 truncate" title={item.form}>{item.form}</p>
                <div className="flex justify-between mt-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    item.dealType === 'Mastermind' ? 'bg-purple-500/10 text-purple-400' :
                    item.dealType === 'Clinical Rainmaker' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-500/10 text-slate-600'
                  }`}>{item.dealType}</span>
                  <span className="text-emerald-400 font-black">{formatCurrency(item.revenue)}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{item.deals} clients</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <BarChart3 size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-slate-600 font-bold">No form attribution data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attribution;
