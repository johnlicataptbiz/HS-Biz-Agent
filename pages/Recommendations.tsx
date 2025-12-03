import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { PaginatedList } from '../components/PaginatedList';
import { authService } from '../services/authService';
import { modeService } from '../services/modeService';

interface RecommendationItem {
  id: string;
  title: string;
  impact: 'High' | 'Med' | 'Low';
  category: string;
  details: string;
}

export default function Recommendations() {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [remoteOffset, setRemoteOffset] = useState<number | undefined>(undefined);
  const pageSize = 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const demo = modeService.isDemoMode();
        if (demo || !authService.isAuthenticated()) {
          // Demo recommendations
          setItems([
            { id: 'rec1', title: 'Optimize "Abandoned Cart" Flow', impact: 'High', category: 'Automation', details: 'Tighten email delays and add branch for high‑value items.' },
            { id: 'rec2', title: 'Merge legacy "Niche" properties', impact: 'Med', category: 'Data', details: 'Hide old fields and standardize naming into `niche_specialty`.' },
            { id: 'rec3', title: 'Update Cold Outreach Copy', impact: 'Med', category: 'Sales', details: 'More conversational, add social proof, adjust send times.' },
            { id: 'rec4', title: 'Fix broken branch in "Webinar"', impact: 'High', category: 'Automation', details: 'Incorrect negative path from CTA click; add goal criteria.' },
            { id: 'rec5', title: 'Add Renewal Reminder Sequence', impact: 'Med', category: 'Sales', details: '5‑step sequence for 60‑day renewal window.' },
            { id: 'rec6', title: 'Property cleanup: `annual_revenue_2022`', impact: 'Low', category: 'Data', details: 'Hide outdated field and migrate values to `annual_revenue`.' }
          ]);
        } else {
          // Server-side paging
          const resp = await authService.apiRequest('/api/recommendations', { method: 'POST', body: JSON.stringify({ limit: pageSize, offset: 0 }) });
          const data = await resp.json();
          const mapped: RecommendationItem[] = Array.isArray(data?.items) ? data.items : [];
          setItems(mapped);
          setRemoteOffset(typeof data?.nextOffset === 'number' ? data.nextOffset : undefined);
        }
      } catch (e) {
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600"><Sparkles size={18} className="text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-900">Recommendations</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</div>
      ) : (
        <div className="space-y-4">
          <PaginatedList
            items={items}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            renderItem={(r) => (
              <div className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">{r.category[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 truncate">{r.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-md border ${r.impact === 'High' ? 'text-rose-600 border-rose-200 bg-rose-50' : r.impact === 'Med' ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-slate-600 border-slate-200 bg-slate-50'}`}>{r.impact}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{r.details}</p>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            )}
          />
          {typeof remoteOffset === 'number' && (
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  try {
                    setLoading(true);
                    const resp = await authService.apiRequest('/api/recommendations', { method: 'POST', body: JSON.stringify({ limit: pageSize, offset: remoteOffset }) });
                    const data = await resp.json();
                    const mapped: RecommendationItem[] = Array.isArray(data?.items) ? data.items : [];
                    setItems(prev => [...prev, ...mapped]);
                    setRemoteOffset(typeof data?.nextOffset === 'number' ? data.nextOffset : undefined);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
