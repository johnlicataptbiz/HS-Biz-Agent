import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../services/config';
import { 
  FileText, 
  Users, 
  TrendingUp, 
  DollarSign, 
  ArrowRight,
  Filter,
  BarChart3,
  Search,
  Award
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';

interface AssetMetric {
  form_name: string;
  total_contacts: number;
  avg_health_score: number;
  customer_count: number;
  total_revenue: number;
  closed_deals: number;
}

const AssetIntelligence: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const [assets, setAssets] = useState<AssetMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch(getApiUrl('/api/assets'));
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets);
      }
    } catch (e) {
      console.error('Failed to load assets', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetClick = (formName: string) => {
    // Navigate to Contacts with filter
    const params = new URLSearchParams();
    params.set('formId', formName);
    params.set('segmentName', `Source: ${formName.substring(0, 20)}...`);
    
    // Push state and navigate
    const newUrl = `/contacts?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
    onNavigate('contacts');
  };

  const filteredAssets = assets.filter(a => 
    a.form_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val}`;
  };

  const getScoreBadgeStyle = (score: number) => {
    if (score <= 0) {
      return {
        className: 'text-slate-600 bg-slate-100 border-slate-200',
        style: {},
      };
    }

    const clamped = Math.max(0, Math.min(100, score));
    const hue = 210 - (200 * (clamped / 100));

    return {
      className: 'border',
      style: {
        backgroundColor: `hsla(${hue}, 85%, 55%, 0.18)`,
        borderColor: `hsla(${hue}, 70%, 45%, 0.45)`,
        color: `hsl(${hue}, 55%, 30%)`,
      } as React.CSSProperties,
    };
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-pink-500"></div>
             <span className="text-[10px] font-bold text-pink-400 uppercase tracking-[0.3em]">
               Content Performance
             </span>
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Asset <span className="gradient-text">Intelligence.</span>
          </h1>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            Analyze your entry points (landing pages, forms, and page titles). Identify which assets attract the highest quality, highest value leads.
          </p>
        </div>

        <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-pink-400 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search assets..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-100 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all w-80 text-sm font-medium text-slate-900 placeholder:text-slate-600"
            />
        </div>
      </div>

      {loading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 glass-card animate-pulse bg-slate-100" />)}
         </div>
      ) : filteredAssets.length === 0 ? (
         <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl">
            <FileText size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-900">No Assets Found</h3>
            <p className="text-slate-500 mt-2">Try adjusting your search or sync more data.</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map((asset, idx) => (
               <div 
                 key={idx} 
                 onClick={() => handleAssetClick(asset.form_name)}
                 className="glass-card p-0 group cursor-pointer hover:border-pink-500/30 hover:bg-white/[0.03] transition-all overflow-hidden flex flex-col h-full"
               >
                  <div className="p-6 flex-1">
                     <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform duration-500">
                           <FileText size={22} />
                        </div>
                        {(() => {
                          const scoreStyles = getScoreBadgeStyle(asset.avg_health_score);
                          return (
                            <div
                              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${scoreStyles.className}`}
                              style={scoreStyles.style}
                            >
                              {Number(asset.avg_health_score).toFixed(1)} Quality
                            </div>
                          );
                        })()}
                     </div>
                     
                     <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 leading-tight group-hover:text-pink-200 transition-colors" title={asset.form_name}>
                        {asset.form_name}
                     </h3>
                     
                     <div className="grid grid-cols-2 gap-4 mt-6">
                        <div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Volume</p>
                           <p className="text-2xl font-black text-slate-900">{asset.total_contacts}</p>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Revenue</p>
                           <p className="text-2xl font-black text-emerald-400">{formatCurrency(asset.total_revenue)}</p>
                        </div>
                     </div>
                  </div>

                  {/* Footer Stats */}
                  <div className="bg-slate-100 px-6 py-4 flex items-center justify-between border-t border-slate-200">
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5" title="Conversion Rate">
                           <Users size={14} className="text-slate-500" />
                           <span className="text-xs font-bold text-slate-300">
                              {((asset.customer_count / asset.total_contacts) * 100).toFixed(1)}% Conv.
                           </span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                        Analyst View <ArrowRight size={14} />
                     </div>
                  </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
};

export default AssetIntelligence;
