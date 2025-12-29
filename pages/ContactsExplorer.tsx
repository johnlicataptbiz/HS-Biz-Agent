import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, User, Building, ChevronLeft, ChevronRight, ChevronDown, Flame, Shield, Users, Mail, Database } from 'lucide-react';
import { getApiUrl } from '../services/config';

interface Contact {
  id: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  lifecyclestage: string | null;
  hubspot_owner_id: string | null;
  health_score: number | null;
  phone: string | null;
  company: string | null;
  jobtitle: string | null;
  lead_status: string | null;
  source: string | null;
  deals: string | null;
  hubspot_url: string | null;
  last_modified: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ContactsExplorer: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeSegment, setActiveSegment] = useState('all'); // 'all', 'hot', 'mm', 'crm'
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [sortField, setSortField] = useState('health_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      let filterParams: any = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sortField,
        order: sortOrder,
        ...(search && { search })
      };

      if (activeSegment === 'hot') {
        filterParams.health_score_min = '80';
        filterParams.lifecyclestage = 'lead,marketingqualifiedlead,opportunity';
      } else if (activeSegment === 'mm') {
        filterParams.lifecyclestage = '266772554'; 
      } else if (activeSegment === 'crm') {
        filterParams.lifecyclestage = 'customer';
      }

      if (lifecycleFilter && activeSegment === 'all') {
        filterParams.lifecyclestage = lifecycleFilter;
      }

      const params = new URLSearchParams(filterParams);
      const resp = await fetch(`${getApiUrl('/api/contacts')}?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setContacts(data.contacts);
        setPagination(data.pagination);
      }
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, activeSegment, lifecycleFilter, sortField, sortOrder]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex bg-[#020617] text-white min-h-screen font-['Inter'] w-full overflow-hidden">
      {/* --- SEGMENT SIDEBAR --- */}
      <aside className="w-64 border-r border-white/5 p-6 space-y-8 flex-shrink-0 bg-slate-950/50 backdrop-blur-2xl">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Database size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter leading-none">CORE ENGINE</h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operator Console v2.5</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 pl-2 opacity-50">Intelligence</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => { setActiveSegment('all'); setLifecycleFilter(''); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'all' ? 'bg-white/10 text-white shadow-xl border border-white/10' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'all' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  <Users size={16} />
                </div>
                <span className="font-bold text-sm">Strategic Directory</span>
              </button>
              <button 
                onClick={() => setActiveSegment('hot')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'hot' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'hot' ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                  <Flame size={16} />
                </div>
                <span className="font-bold text-sm">Hot Targets 🔥</span>
              </button>
            </nav>
          </div>

          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 pl-2 opacity-50">Memberships</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveSegment('mm')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'mm' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'mm' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                  <Shield size={16} />
                </div>
                <span className="font-bold text-sm">Mastermind 👑</span>
              </button>
              <button 
                onClick={() => setActiveSegment('crm')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'crm' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'crm' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                  <RefreshCw size={16} />
                </div>
                <span className="font-bold text-sm">CRM Members 🛠️</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="absolute bottom-8 left-6 right-6">
          <button 
            onClick={fetchContacts}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-all border border-white/5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Sync Database
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-10 overflow-y-auto max-h-screen">
        <header className="flex justify-between items-end mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">CRM Core</span>
              <div className="w-1 h-1 rounded-full bg-slate-700" />
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Sync</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter leading-none mb-4">
              {activeSegment === 'all' ? 'Directory' : 
               activeSegment === 'hot' ? 'Hot Targets' : 
               activeSegment === 'mm' ? 'Mastermind' : 'Members'}
            </h1>
            <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-slate-400">
                <span className="text-white">{pagination.total.toLocaleString()}</span> Strategic Leads
               </div>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Database Live</span>
            </div>
          </div>

          <div className="flex gap-4">
            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search strategic records..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all w-96 text-sm font-medium"
              />
            </form>
          </div>
        </header>

        {/* --- DATAGRID --- */}
        <div className="glass-panel border-white/5 shadow-2xl overflow-hidden mb-10">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th onClick={() => handleSort('health_score')} className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors group">
                    <div className="flex items-center gap-2">
                       A.I. RANK <ChevronDown size={14} className={`transition-transform ${sortField === 'health_score' ? 'text-indigo-400' : 'opacity-0'}`} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('firstname')} className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">
                    PROFILE INFO
                  </th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">ORGANIZATION</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">TAGS</th>
                  <th onClick={() => handleSort('last_modified')} className="px-8 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">
                    LAST INTERACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-8 py-10 border-b border-white/5 bg-white/5 opacity-50" />
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Database size={48} className="text-slate-800" />
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">No strategic records found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id} className="group hover:bg-white/[0.04] transition-all duration-300">
                      <td className="px-8 py-8">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl transition-all group-hover:scale-110 ${
                          (contact.health_score || 0) >= 80 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-orange-500/20' : 
                          (contact.health_score || 0) >= 60 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                          'bg-white/5 text-slate-500 border border-white/10'
                        }`}>
                          {contact.health_score || '0'}
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-lg font-black transition-all group-hover:rotate-6 ${
                            (contact.health_score || 0) >= 80 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-slate-800/50 border-white/10 text-slate-400'
                          }`}>
                            {(contact.firstname?.[0] || contact.email?.[0] || '?')}
                          </div>
                          <div>
                            <div className="font-black text-lg text-slate-100 group-hover:text-white transition-colors tracking-tight">
                              {contact.firstname || 'Anonymous'} {contact.lastname || ''}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail size={12} className="text-slate-600" />
                              <span className="text-xs text-slate-500 font-bold lowecase">{contact.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-8">
                        {contact.company ? (
                          <div className="flex items-center gap-3 group/company">
                            <Building size={16} className="text-slate-600 group-hover/company:text-indigo-400 transition-colors" />
                            <span className="text-slate-300 font-bold tracking-tight">{contact.company}</span>
                          </div>
                        ) : (
                          <div className="w-8 h-px bg-slate-800" />
                        )}
                      </td>
                      <td className="px-8 py-8">
                        <div className="flex justify-center gap-3">
                          {parseInt(contact.deals || '0') > 0 && (
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center title-Active Deals">
                               <RefreshCw size={14} className="text-emerald-500" />
                            </div>
                          )}
                          {contact.lifecyclestage === '266772554' && (
                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center" title="MM Member">
                               <Shield size={14} className="text-indigo-400" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-8 text-right">
                        <div className="text-lg font-black text-slate-200 tracking-tighter">{formatDate(contact.last_modified)}</div>
                        <div className="flex items-center justify-end gap-2 mt-1.5">
                           {(contact.health_score || 0) >= 80 && (
                             <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">Critical Lead 🔥</span>
                           )}
                           <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Last Synced</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- MODERN PAGINATION --- */}
        <footer className="flex justify-between items-center py-6">
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-emerald-500" />
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Showing <span className="text-white">{contacts.length}</span> / {pagination.total.toLocaleString()} Strategic Results
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPagination(p => ({ ...p, page: p.page - 1 }));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={pagination.page <= 1 || loading}
              className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 disabled:opacity-20 transition-all font-bold text-sm text-slate-400 hover:text-white"
            >
              <ChevronLeft size={18} /> BACK
            </button>
            
            <div className="px-6 py-3 bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 text-sm tracking-widest">
               {pagination.page} <span className="text-white/50 mx-1">/</span> {pagination.totalPages}
            </div>

            <button
              onClick={() => {
                setPagination(p => ({ ...p, page: p.page + 1 }));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 disabled:opacity-20 transition-all font-bold text-sm text-slate-400 hover:text-white"
            >
              NEXT <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default ContactsExplorer;
