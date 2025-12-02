
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Zap, ArrowUpRight, ShieldCheck, TrendingUp, MoreHorizontal } from 'lucide-react';

const Dashboard: React.FC = () => {
  const healthData = [
    { name: 'Workflows', score: 65, color: '#6366f1' }, // Indigo
    { name: 'Sequences', score: 78, color: '#10b981' }, // Emerald
    { name: 'Data Model', score: 45, color: '#f59e0b' }, // Amber
    { name: 'Segments', score: 88, color: '#8b5cf6' }, // Violet
  ];

  const StatCard = ({ title, value, sub, icon: Icon, colorClass, trend }: any) => {
    // Extract base color name (e.g. "indigo") from colorClass "bg-indigo-600"
    const baseColor = colorClass.split('-')[1]; 
    
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
        <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${baseColor}-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out`}></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
             <div className={`p-3 rounded-xl bg-${baseColor}-50 text-${baseColor}-600`}>
               <Icon size={24} />
             </div>
             {trend && (
               <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs font-semibold">
                 <TrendingUp size={12} />
                 <span>+4%</span>
               </div>
             )}
          </div>
          
          <div>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`}></div>
            <p className="text-xs text-slate-400 font-medium">{sub}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Portal Overview</h1>
          <p className="text-slate-500 mt-2 text-lg">Real-time optimization analysis of your HubSpot instance.</p>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm font-semibold text-slate-700">System Operational</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Overall Health Score" 
          value="72" 
          sub="Top 15% of portals" 
          icon={Activity} 
          colorClass="bg-indigo-600" 
          trend="up"
        />
        <StatCard 
          title="Active Workflows" 
          value="42" 
          sub="3 critical bottlenecks" 
          icon={Zap} 
          colorClass="bg-amber-500" 
        />
        <StatCard 
          title="Active Sequences" 
          value="13" 
          sub="12.4% avg reply rate" 
          icon={CheckCircle} 
          colorClass="bg-emerald-500" 
          trend="up"
        />
        <StatCard 
          title="Pending Issues" 
          value="7" 
          sub="Requires attention" 
          icon={AlertTriangle} 
          colorClass="bg-rose-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-8 flex justify-between items-center">
             <div>
                <h3 className="text-lg font-bold text-slate-900">Health Breakdown</h3>
                <p className="text-sm text-slate-500">Optimization scores by category</p>
             </div>
             <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600">
               <MoreHorizontal size={20} />
             </button>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }} 
                    axisLine={false} 
                    tickLine={false} 
                />
                <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={32}>
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action List */}
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-6 flex justify-between items-center">
             <div>
                <h3 className="text-lg font-bold text-slate-900">Priority Actions</h3>
                <p className="text-sm text-slate-500">Suggested optimizations</p>
             </div>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Optimize "Abandoned Cart" Flow', impact: 'High', type: 'Auto', time: '5m' },
              { label: 'Merge "Niche" properties', impact: 'Med', type: 'Data', time: '10m' },
              { label: 'Update "Cold Outreach" Copy', impact: 'Med', type: 'Sales', time: '2m' },
              { label: 'Fix broken branch in "Webinar"', impact: 'Crit', type: 'Auto', time: '1m' },
            ].map((item, i) => (
              <div key={i} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm
                        ${item.type === 'Auto' ? 'bg-indigo-100 text-indigo-700' : 
                          item.type === 'Data' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.type.charAt(0)}
                    </div>
                    <div>
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-900 block">{item.label}</span>
                        <span className="text-xs text-slate-400 group-hover:text-indigo-400">{item.time} est.</span>
                    </div>
                </div>
                <div>
                   <ArrowUpRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full mt-6 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
            View All Recommendations
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
