import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../services/config';
import { 
  Trophy, 
  XCircle, 
  TrendingUp, 
  Clock, 
  Target, 
  PieChart, 
  ArrowRight,
  Filter,
  Ban
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  CartesianGrid
} from 'recharts';

interface CohortData {
  status: string;
  count: number;
  total_value: number;
  avg_deal_size: number;
  avg_days_to_close: number;
}

interface WinLossData {
  cohorts: {
    won?: CohortData;
    lost?: CohortData;
  };
  sources: Array<{ source: string; won_count: number; lost_count: number; winRate: string }>;
  types: Array<{ type: string; won_count: number; lost_count: number }>;
}

const WinLoss: React.FC = () => {
  const [data, setData] = useState<WinLossData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(getApiUrl('/api/win-loss'));
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load Win/Loss data', e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${Number(val).toFixed(0)}`;
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
             <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.3em]">
               Revenue Operations
             </span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Win/Loss <span className="gradient-text">Lab.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Comparative analysis of your sales performance. Understand why you win, where you lose, and how to accelerate velocity.
          </p>
        </div>
      </div>

      {loading ? (
         <div className="grid grid-cols-2 gap-8">
            <div className="h-64 glass-card animate-pulse bg-white/5" />
            <div className="h-64 glass-card animate-pulse bg-white/5" />
         </div>
      ) : (
         <>
            {/* The Arena: Won vs Lost */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* WON COHORT */}
               <div className="glass-card p-0 overflow-hidden border-emerald-500/20 relative group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
                  <div className="p-8 relative z-10">
                     <div className="flex items-center justify-between mb-8">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                           <Trophy size={28} />
                        </div>
                        <span className="text-[100px] leading-none font-black text-emerald-500/5 absolute top-0 right-0 -mr-4 -mt-4 select-none">WIN</span>
                     </div>
                     
                     <div className="space-y-6">
                        <div>
                           <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Wins</p>
                           <p className="text-5xl font-black text-white">{data?.cohorts.won?.count || 0}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 rounded-2xl bg-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                 <Clock size={14} className="text-emerald-400" />
                                 <span className="text-[10px] font-black uppercase text-slate-500">Time to Close</span>
                              </div>
                              <p className="text-xl font-bold text-emerald-300">{data?.cohorts.won?.avg_days_to_close || 0} days</p>
                           </div>
                           <div className="p-4 rounded-2xl bg-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                 <TrendingUp size={14} className="text-emerald-400" />
                                 <span className="text-[10px] font-black uppercase text-slate-500">Avg Deal Size</span>
                              </div>
                              <p className="text-xl font-bold text-emerald-300">{formatCurrency(data?.cohorts.won?.avg_deal_size || 0)}</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* LOST COHORT */}
               <div className="glass-card p-0 overflow-hidden border-rose-500/20 relative group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-400" />
                  <div className="p-8 relative z-10">
                     <div className="flex items-center justify-between mb-8">
                        <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                           <Ban size={28} />
                        </div>
                        <span className="text-[100px] leading-none font-black text-rose-500/5 absolute top-0 right-0 -mr-4 -mt-4 select-none">LOSS</span>
                     </div>
                     
                     <div className="space-y-6">
                        <div>
                           <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Losses</p>
                           <p className="text-5xl font-black text-white">{data?.cohorts.lost?.count || 0}</p>
                        </div>
                        
                         <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 rounded-2xl bg-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                 <Clock size={14} className="text-rose-400" />
                                 <span className="text-[10px] font-black uppercase text-slate-500">Time to Fail</span>
                              </div>
                              <p className="text-xl font-bold text-rose-300">{data?.cohorts.lost?.avg_days_to_close || 0} days</p>
                           </div>
                           <div className="p-4 rounded-2xl bg-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                 <Target size={14} className="text-rose-400" />
                                 <span className="text-[10px] font-black uppercase text-slate-500">Avg Lost Size</span>
                              </div>
                              <p className="text-xl font-bold text-rose-300">{formatCurrency(data?.cohorts.lost?.avg_deal_size || 0)}</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Source Efficiency Analysis */}
            <div className="glass-card p-8">
               <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                     <PieChart size={20} />
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-white">Source Efficiency Matrix</h3>
                     <p className="text-xs text-slate-400 uppercase tracking-wider">Which lead sources actually close?</p>
                  </div>
               </div>

               <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={data?.sources} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="source" stroke="#64748b" fontSize={11} fontWeight={700} axisLine={false} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight={700} axisLine={false} tickLine={false} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                           cursor={{fill: '#ffffff05'}}
                        />
                        <Bar dataKey="won_count" name="Wins" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={40} />
                        <Bar dataKey="lost_count" name="Losses" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </>
      )}
    </div>
  );
};

export default WinLoss;
