import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../services/config';
import { 
  Zap,
  TrendingUp, 
  Clock, 
  Target, 
  BarChart3,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  CartesianGrid,
  PieChart,
  Pie
} from 'recharts';

interface VelocityData {
  velocity: {
    revenuePerDay: number;
    revenuePerMonth: number;
  };
  components: {
    winRate: string;
    avgCycleDays: string;
    openOpportunities: number;
    avgDealValue: number;
    totalPipeline: number;
  };
  aging: Array<{
    bucket: string;
    count: number;
    value: number;
  }>;
}

const PipelineVelocity: React.FC = () => {
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(getApiUrl('/api/velocity'));
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load Velocity data', e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${Number(val).toFixed(0)}`;
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-violet-500"></div>
             <span className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.3em]">
               Revenue Forecast
             </span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Pipeline <span className="gradient-text">Speed.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            The speed at which qualified leads convert to revenue. Find out where deals are getting stuck.
          </p>
        </div>
      </div>

      {loading ? (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="h-96 lg:col-span-2 glass-card animate-pulse bg-white/5" />
            <div className="h-96 glass-card animate-pulse bg-white/5" />
         </div>
      ) : (
         <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* 1. Velocity Gauge */}
               <div className="lg:col-span-2 glass-card p-0 overflow-hidden border-violet-500/20 relative">
                  <div className="absolute top-0 right-0 p-32 bg-violet-500/20 blur-[100px] rounded-full pointer-events-none" />
                  
                  <div className="p-10 flex flex-col h-full justify-between relative z-10">
                     <div>
                        <div className="flex items-center gap-3 mb-8">
                           <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400">
                              <Zap size={28} />
                           </div>
                           <h3 className="text-xl font-bold text-white">Projected Velocity</h3>
                        </div>

                        <div className="flex items-baseline gap-4">
                           <span className="text-7xl font-black text-white">
                              {formatCurrency(data?.velocity.revenuePerMonth || 0)}
                           </span>
                           <span className="text-xl font-bold text-slate-500 uppercase tracking-widest">/ month</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-2">
                           Calculated revenue generation speed based on current pipeline, win rate, and cycle length.
                        </p>
                     </div>

                     <div className="grid grid-cols-4 gap-4 mt-12 bg-white/5 rounded-2xl p-6 border border-white/5">
                        <div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Open Opps</p>
                           <p className="text-2xl font-black text-white">{data?.components.openOpportunities}</p>
                        </div>
                         <div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Avg Value</p>
                           <p className="text-2xl font-black text-white">{formatCurrency(data?.components.avgDealValue || 0)}</p>
                        </div>
                         <div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Win Rate</p>
                           <p className="text-2xl font-black text-emerald-400">{data?.components.winRate}%</p>
                        </div>
                         <div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Sales Cycle</p>
                           <p className="text-2xl font-black text-amber-400">{data?.components.avgCycleDays}d</p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* 2. Formula Explanation / Insight */}
               <div className="glass-card p-10 flex flex-col justify-center border-white/10">
                  <h3 className="text-lg font-bold text-white mb-6">Speed Calculation</h3>
                  <div className="space-y-6 font-mono text-sm">
                     <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex justify-between text-slate-400 mb-2">
                           <span>Total Pipeline Value</span>
                           <span>{formatCurrency(data?.components.totalPipeline || 0)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-400 mb-2 font-bold">
                           <span>× Win Rate</span>
                           <span>{data?.components.winRate}%</span>
                        </div>
                         <div className="h-px bg-slate-600 my-2" />
                        <div className="flex justify-between text-amber-400 font-bold">
                           <span>÷ Sales Cycle</span>
                           <span>{data?.components.avgCycleDays} days</span>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-3 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                        <AlertTriangle className="text-violet-400 shrink-0" size={20} />
                        <p className="text-xs text-violet-200">
                           Increasing Win Rate by 5% would add <strong>{formatCurrency((data?.components.totalPipeline || 0) * 0.05)}</strong> to your forecast.
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            {/* 3. Deal Aging Analysis */}
            <div className="glass-card p-8">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Clock size={20} />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-white">Deal Age Analysis</h3>
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Stalled Deals</p>
                     </div>
                  </div>
               </div>

               <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={data?.aging} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="bucket" stroke="#64748b" fontSize={11} fontWeight={700} axisLine={false} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight={700} axisLine={false} tickLine={false} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                           cursor={{fill: '#ffffff05'}}
                           formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Bar dataKey="value" name="Pipeline Value" radius={[8, 8, 0, 0]} barSize={60}>
                           {data?.aging.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>

               <div className="grid grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/5">
                  {data?.aging.map((item, i) => (
                     <div key={i} className="text-center">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.bucket}</p>
                        <p className="text-lg font-black text-white">{item.count} deals</p>
                        <p className={`text-xs font-bold ${i >= 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                           {formatCurrency(item.value)}
                        </p>
                     </div>
                  ))}
               </div>
            </div>
         </>
      )}
    </div>
  );
};

export default PipelineVelocity;
