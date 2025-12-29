import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Loader2, Download, UserPlus, Database, Plus, ChevronDown, Activity, Star, Users, Trash2, ShieldCheck, Zap, Mail, Phone, Calendar, MapPin, Globe, CreditCard, Building2, Clock, CheckCircle2, MoreHorizontal, UserCheck, UserMinus, ShieldAlert, TrendingUp, BrainCircuit, RefreshCw, Flame, Eye, Sparkles, Ban, Shield, Building, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { getApiUrl } from '../services/config';
import StrategicModelOptimizer from '../components/ContactRemediator';
import SaveSegmentModal from '../components/SaveSegmentModal';

interface Contact {
  id: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  lifecyclestage: string | null;
  hubspot_owner_id: string | null;
  health_score: number | null;
  classification: string | null;
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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeSegment, setActiveSegment] = useState('all'); 
  const [sortField, setSortField] = useState('health_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRemediator, setShowRemediator] = useState(false);
  const [minHealthScore, setMinHealthScore] = useState(0); // New state for minScore
  const [selectedFilter, setSelectedFilter] = useState('all'); // New state for general filter
  const [searchTerm, setSearchTerm] = useState(''); // New state for search term
  const [daysInactive, setDaysInactive] = useState(0); // New state for daysInactive
  const [hasDeal, setHasDeal] = useState(false); // New state for ghost detection
  const [leadSource, setLeadSource] = useState(''); // New state for Lead Source
  const [formId, setFormId] = useState(''); // New state for Form ID/Magnet
  const [showSaveModal, setShowSaveModal] = useState(false);

  // URL Deep Linking for Segments
  useEffect(() => {
    // Check if we have search params
    const params = new URLSearchParams(window.location.search);
    let filtersApplied = false;

    // 1. Min Score
    const minScore = params.get('minScore');
    if (minScore) {
      setMinHealthScore(parseInt(minScore));
      filtersApplied = true;
    }

    // 2. Has Owner
    const hasOwner = params.get('hasOwner');
    if (hasOwner === 'false') {
      setSelectedFilter('unassigned');
      filtersApplied = true;
    }

    // 3. Lifecycle Stage
    const lifecycle = params.get('lifecycle');
    if (lifecycle) {
      // Assuming we might have a filter for this later, for now we can filter client-side or add backend support
      // If classification is set, use that
    }

    // 4. Classification (Hot, Nurture, etc)
    const classification = params.get('classification');
    if (classification) {
      setActiveSegment(classification.toLowerCase()); // Use activeSegment for classification
      filtersApplied = true;
    }

    // 5. Deal Types (Mastermind, etc)
    const dealType = params.get('dealType');
    if (dealType) {
      setSearchTerm(`type:${dealType}`);
      filtersApplied = true; 
    }

    // 6. Days Inactive (Ghost/Stale)
    const days = params.get('daysInactive');
    if (days) {
        setDaysInactive(parseInt(days));
        filtersApplied = true;
    }

    // 7. Has Deal (Ghost detection)
    const dealParam = params.get('hasDeal');
    if (dealParam === 'true') {
        setHasDeal(true);
        filtersApplied = true;
    }

    // 8. Lead Source
    const sourceParam = params.get('leadSource');
    if (sourceParam) {
        setLeadSource(sourceParam);
        filtersApplied = true;
    }

    // 9. Form ID
    const formParam = params.get('formId');
    if (formParam) {
        setFormId(formParam);
        filtersApplied = true;
    }

    // 10. Segment Name (Display only)
    const segmentName = params.get('segmentName');
    if (segmentName) {
      // Could show a toast or banner "Viewing Segment: X"
    }

    // If filters were applied from URL, setting the states will trigger fetchContacts via its useEffect dependency
    // No need to call fetchContacts() directly here.
  }, []); // Run on mount

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: any = {
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sortField,
        order: sortOrder,
        ...(search && { search })
      };

      // Apply segment filters
      if (activeSegment === 'hot') filterParams.classification = 'Hot';
      else if (activeSegment === 'nurture') filterParams.classification = 'Nurture';
      else if (activeSegment === 'watch') filterParams.classification = 'Watch';
      else if (activeSegment === 'new') filterParams.classification = 'New';
      else if (activeSegment === 'unqualified') filterParams.classification = 'Unqualified';
      else if (activeSegment === 'customer') filterParams.classification = 'Customer';
      else if (activeSegment === 'trash') filterParams.classification = 'Trash';
      else if (activeSegment === 'mm') filterParams.lifecyclestage = '266772554'; 
      else if (activeSegment === 'crm') filterParams.lifecyclestage = 'customer';

      // Advanced Filters (from URL/Segments)
      if (minHealthScore > 0) filterParams.minScore = minHealthScore.toString();
      if (selectedFilter === 'unassigned') filterParams.hasOwner = 'false';
      else if (selectedFilter !== 'all') filterParams.classification = selectedFilter; 
      
      if (searchTerm && searchTerm.startsWith('type:')) {
          filterParams.dealType = searchTerm.replace('type:', '');
      }

      if (daysInactive > 0) {
          filterParams.daysInactive = daysInactive.toString();
          if (hasDeal) filterParams.hasDeal = 'true';
      }

      if (leadSource) filterParams.leadSource = leadSource;
      if (formId) filterParams.formId = formId;

      const params = new URLSearchParams(filterParams);
      const resp = await fetch(`${getApiUrl('/api/contacts')}?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setContacts(data.contacts);
        setPagination(prev => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
        setSelectedIds([]); // Reset selection on fetch
      }
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, activeSegment, sortField, sortOrder, minHealthScore, selectedFilter, searchTerm, daysInactive, hasDeal, leadSource, formId]);

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

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'Hot': return <Flame size={14} className="text-orange-500" />;
      case 'Nurture': return <Clock size={14} className="text-amber-500" />;
      case 'Watch': return <Eye size={14} className="text-indigo-400" />;
      case 'New': return <Sparkles size={14} className="text-emerald-400" />;
      case 'Unqualified': return <Ban size={14} className="text-slate-500" />;
      case 'Customer': return <UserCheck size={14} className="text-emerald-500" />;
      case 'Trash': return <Trash2 size={14} className="text-rose-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Hot': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Nurture': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Watch': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'New': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Unqualified': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'Customer': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Trash': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-white/5 text-slate-500 border-white/10';
    }
  };

  return (
    <div className="flex bg-[#020617] text-white min-h-screen font-['Inter'] w-full overflow-hidden">
      {/* --- SEGMENT SIDEBAR --- */}
      <aside id="contacts-segment-sidebar" className="w-64 border-r border-white/5 p-6 space-y-8 flex-shrink-0 bg-slate-950/50 backdrop-blur-2xl overflow-y-auto">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Database size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter leading-none">CORE ENGINE</h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operator Console v2.5</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 pl-2 opacity-50">Intelligence</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveSegment('all')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'all' ? 'bg-white/10 text-white shadow-xl border border-white/10' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'all' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  <Users size={14} />
                </div>
                <span className="font-bold text-sm">Strategic Directory</span>
              </button>
              
              <button 
                onClick={() => setActiveSegment('new')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'new' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'new' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800 text-slate-500'}`}>
                  <Sparkles size={14} />
                </div>
                <span className="font-bold text-sm">New Leads ✨</span>
              </button>

              <button 
                onClick={() => setActiveSegment('hot')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'hot' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'hot' ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                  <Flame size={14} />
                </div>
                <span className="font-bold text-sm">Hot Targets 🔥</span>
              </button>

              <button 
                onClick={() => setActiveSegment('nurture')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'nurture' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'nurture' ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-slate-800 text-slate-500'}`}>
                  <Clock size={14} />
                </div>
                <span className="font-bold text-sm">Nurture ⏳</span>
              </button>

               <button 
                onClick={() => setActiveSegment('watch')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'watch' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'watch' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-slate-800 text-slate-500'}`}>
                  <Eye size={14} />
                </div>
                <span className="font-bold text-sm">Watch List 👁️</span>
              </button>
            </nav>
          </div>

          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 pl-2 opacity-50">Members</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveSegment('mm')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'mm' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'mm' ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                  <Shield size={14} />
                </div>
                <span className="font-bold text-sm">Mastermind 👑</span>
              </button>
              <button 
                onClick={() => setActiveSegment('customer')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'customer' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'customer' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                  <UserCheck size={14} />
                </div>
                <span className="font-bold text-sm">Customers 🤝</span>
              </button>
            </nav>
          </div>

          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 pl-2 opacity-50">Cleanup</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveSegment('unqualified')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'unqualified' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'unqualified' ? 'bg-slate-800 text-slate-500' : 'bg-slate-800 text-slate-500'}`}>
                  <Ban size={14} />
                </div>
                <span className="font-bold text-sm">Unqualified 🚫</span>
              </button>
              <button 
                onClick={() => setActiveSegment('trash')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${activeSegment === 'trash' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeSegment === 'trash' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  <Trash2 size={14} />
                </div>
                <span className="font-bold text-sm">Trash 🗑️</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="mt-auto pt-10 border-t border-white/5 space-y-4">
          <div className="px-4 py-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
            <div className="flex items-center justify-between mb-2">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Portal Integrity</span>
               <TrendingUp size={10} className="text-emerald-500" />
            </div>
            <div className="flex items-end gap-2">
               <span className="text-xl font-black text-white italic">0.94</span>
               <span className="text-[10px] font-bold text-emerald-500 mb-1">+2.4%</span>
            </div>
          </div>
          
          <button 
            id="contacts-sync-btn"
            onClick={fetchContacts}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-all border border-white/5"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span className="uppercase text-[10px] tracking-widest">Architectural Sync</span>
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
            <h1 className="text-6xl font-black tracking-tighter leading-none mb-4 uppercase">
              {activeSegment === 'all' ? 'Directory' : 
               activeSegment === 'hot' ? 'Hot Targets' : 
               activeSegment === 'new' ? 'New Leads' :
               activeSegment === 'nurture' ? 'Nurture' :
               activeSegment === 'watch' ? 'Watch List' :
               activeSegment === 'unqualified' ? 'Unqualified' :
               activeSegment === 'customer' ? 'Customers' :
               activeSegment === 'trash' ? 'Trash' :
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
                id="contacts-search-bar"
                type="text"
                placeholder="Search strategic records..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all w-96 text-sm font-medium"
              />
            </form>

            <button 
              onClick={() => setShowSaveModal(true)}
              className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white"
            >
              <Save size={18} />
              Save View
            </button>
          </div>
        </header>

        {/* --- DATAGRID --- */}
        <div className="glass-panel border-white/5 shadow-2xl overflow-hidden mb-10">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="w-12 px-8 py-6">
                    <input 
                      aria-label="Select all contacts" 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(contacts.map(c => c.id));
                        else setSelectedIds([]);
                      }}
                      checked={selectedIds.length === contacts.length && contacts.length > 0}
                      className="accent-indigo-500"
                    />
                  </th>
                  <th id="contacts-ai-rank-header" onClick={() => handleSort('health_score')} className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors group">
                    <div className="flex items-center gap-2">
                       A.I. RANK <ChevronDown size={14} className={`transition-transform ${sortField === 'health_score' ? 'text-indigo-400' : 'opacity-0'}`} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('firstname')} className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">
                    PROFILE INFO
                  </th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">STATUS TAG</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">ORGANIZATION</th>
                  <th onClick={() => handleSort('last_modified')} className="px-8 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">
                    LAST INTERACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-8 py-10 border-b border-white/5 bg-white/5 opacity-50" />
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Database size={48} className="text-slate-800" />
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">No strategic records found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id} className={`group hover:bg-white/[0.04] transition-all duration-300 ${selectedIds.includes(contact.id) ? 'bg-indigo-500/[0.03]' : ''}`}>
                      <td className="px-8 py-8">
                        <input 
                          aria-label={`Select contact ${contact.firstname} ${contact.lastname}`} 
                          type="checkbox" 
                          checked={selectedIds.includes(contact.id)}
                          onChange={() => {
                            setSelectedIds(prev => 
                              prev.includes(contact.id) 
                                ? prev.filter(id => id !== contact.id) 
                                : [...prev, contact.id]
                            );
                          }}
                          className="accent-indigo-500"
                        />
                      </td>
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
                        {contact.classification && (
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getStatusColor(contact.classification)}`}>
                            {getStatusIcon(contact.classification)}
                            {contact.classification}
                          </div>
                        )}
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
                      <td className="px-8 py-8 text-right">
                        <div className="text-lg font-black text-slate-200 tracking-tighter">{formatDate(contact.last_modified)}</div>
                        <div className="flex items-center justify-end gap-2 mt-1.5 flex-wrap">
                           {/* Data Quality Heuristics */}
                           {!contact.email && (
                             <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20" title="Missing email address">No Email ⚠️</span>
                           )}
                           {!contact.hubspot_owner_id && (
                             <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20" title="No assigned owner">No Owner</span>
                           )}
                           {contact.last_modified && (Date.now() - new Date(contact.last_modified).getTime() > 90 * 24 * 60 * 60 * 1000) && (
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-500/10 px-2 py-0.5 rounded-md border border-slate-500/20" title="No activity in 90+ days">Stale</span>
                           )}
                           {/* Hot Lead Indicator */}
                           {(contact.health_score || 0) >= 80 && (
                             <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">Critical Lead 🔥</span>
                           )}
                           {/* Ghost Opportunity */}
                           {contact.lifecyclestage === 'opportunity' && contact.last_modified && (Date.now() - new Date(contact.last_modified).getTime() > 30 * 24 * 60 * 60 * 1000) && (
                             <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20" title="Opportunity with no recent activity">Ghost 👻</span>
                           )}
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

      {/* --- BULK ACTION BAR --- */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
           <div className="bg-[#0a0f1d]/90 backdrop-blur-2xl border border-indigo-500/30 rounded-full px-8 py-4 flex items-center gap-8 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(99,102,241,0.2)]">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">
                    {selectedIds.length}
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-slate-300">Target Nodes Selected</span>
              </div>
              
              <div className="h-4 w-[1px] bg-white/10" />
              
              <div className="flex items-center gap-4">
                 <button 
                   onClick={() => setShowRemediator(true)}
                   className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                 >
                    <Zap size={14} /> AI Remediate
                 </button>
                 <button 
                   onClick={() => setSelectedIds([])}
                   className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest px-4"
                 >
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {showRemediator && (
        <StrategicModelOptimizer 
          contactIds={selectedIds}
          contacts={contacts}
          onClose={() => setShowRemediator(false)}
          onComplete={() => {
            fetchContacts();
            setSelectedIds([]);
          }}
        />
      )}

      {showSaveModal && (
          <SaveSegmentModal 
            onClose={() => setShowSaveModal(false)}
            queryConfig={{
                minScore: minHealthScore > 0 ? minHealthScore : undefined,
                hasOwner: selectedFilter === 'unassigned' ? false : undefined,
                classification: ['hot','nurture','watch','new'].includes(activeSegment) ? activeSegment.charAt(0).toUpperCase() + activeSegment.slice(1) : 
                               (selectedFilter !== 'all' && selectedFilter !== 'unassigned') ? selectedFilter : undefined,
                lifecycleStage: activeSegment === 'mm' ? '266772554' : activeSegment === 'customer' ? 'customer' : undefined,
                dealType: searchTerm.startsWith('type:') ? searchTerm.replace('type:', '') : undefined,
                daysInactive: daysInactive > 0 ? daysInactive : undefined,
                hasDeal: hasDeal ? true : undefined,
                leadSource: leadSource || undefined,
                formId: formId || undefined
            }}
          />
      )}
    </div>
  );
};

export default ContactsExplorer;
