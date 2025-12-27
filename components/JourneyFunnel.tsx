import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';

interface StageData {
  name: string;
  count: number;
  color: string;
  label: string;
}

interface JourneyFunnelProps {
  data: Record<string, number>;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  subscriber: { label: 'Subscribers', color: '#6366f1', order: 0 },
  lead: { label: 'Leads', color: '#818cf8', order: 1 },
  marketingqualifiedlead: { label: 'MQLs', color: '#4f46e5', order: 2 },
  salesqualifiedlead: { label: 'SQLs', color: '#4338ca', order: 3 },
  opportunity: { label: 'Opportunities', color: '#3730a3', order: 4 },
  customer: { label: 'Active Clients', color: '#10b981', order: 5 },
  evangelist: { label: 'Evangelists', color: '#059669', order: 6 },
  other: { label: 'Other', color: '#94a3b8', order: 7 }
};

export const JourneyFunnel: React.FC<JourneyFunnelProps> = ({ data }) => {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([key, count]) => ({
        key,
        count,
        ...(STAGE_CONFIG[key.toLowerCase()] || STAGE_CONFIG.other)
      }))
      .sort((a, b) => a.order - b.order)
      .filter(item => item.count > 0);
  }, [data]);

  return (
    <div className="w-full h-[300px] mt-6 bg-slate-900/40 rounded-2xl border border-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Journey Distribution</h3>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Lead to Active Client Funnel</p>
        </div>
        <div className="flex gap-2">
            <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-400 font-bold uppercase">Live Velocity</div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="80%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
          <XAxis type="number" hide />
          <YAxis 
            dataKey="label" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
            width={100}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
            ))}
            <LabelList dataKey="count" position="right" fill="#fff" fontSize={10} fontWeight={900} offset={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
