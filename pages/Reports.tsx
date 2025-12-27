import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Form } from '../types';
import { BarChart3, TrendingUp, Download, PieChart, Info, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Reports: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);
    
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
  
  // Strict Real Data Only
  // We only chart items that actually have submissions > 0
  const chartData = leadMagnets
    .filter(lm => typeof lm.submissions === 'number' && lm.submissions > 0)
    .map((lm) => ({
      name: lm.name.length > 20 ? lm.name.substring(0, 20) + '...' : lm.name,
      conversions: Number(lm.submissions),
    }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-2">
            <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Performance <span className="gradient-text">Reports.</span>
            </h1>
            <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Deep dive into your high-leverage assets. Track lead magnet attribution and optimization impact.
            </p>
        </div>

        {!isConnected && (
            <div className="glass-card p-12 text-center space-y-6">
                <ShieldCheck className="text-indigo-400 mx-auto" size={40} />
                <h3 className="text-xl font-bold text-white">Connect HubSpot</h3>
                <p className="text-slate-400">Reports require live data access.</p>
            </div>
        )}

        {isConnected && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Lead Magnets Chart */}
                <div className="glass-card p-8 border-indigo-500/20">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Top Performing Lead Magnets</h3>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Conversions (Real Time)</p>
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
                                    We couldn't retrieve submission counts for your lead magnets. 
                                    Ensure usage of HubSpot Legacy V2 Forms or check API permissions.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-6">
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
                                <h4 className="text-amber-400 font-bold text-sm">Insight</h4>
                                <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                                    {leadMagnets.length > 0 
                                      ? `You have ${leadMagnets.length} detected lead magnets. Optimize the top performing one to maximize funnel efficiency.`
                                      : "No clear lead magnets detected (based on 'guide', 'ebook', etc). Consider renaming forms to track them better."
                                    }
                                </p>
                            </div>
                        </div>
                     </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Reports;
