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
  first_form: string | null;
  deal_stage: string | null;
  deals: string | null;
  hubspot_url: string | null;
  last_modified: string;
}

interface ContactDetails extends Contact {
  raw_data?: any;
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
  const [selectedContact, setSelectedContact] = useState<ContactDetails | null>(null);
  const [loadingContactDetails, setLoadingContactDetails] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'generating' | 'saving' | 'saved' | 'error'>('idle');
  const [noteError, setNoteError] = useState('');

  const formatTag = (value: string | null, fallback = '') => {
    if (!value) return fallback;
    return value.replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
  };

  const isMeaningfulTag = (value: string | null) => {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (!/[a-zA-Z]/.test(trimmed)) return false;
    if (/^(user(id)?|contact(id)?|vid|id)[:_ ]?\d+$/i.test(trimmed)) return false;
    return true;
  };

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
      else if (activeSegment === 'customer') filterParams.activeClient = 'true';
      else if (activeSegment === 'opportunity') filterParams.lifecyclestage = 'opportunity';
      else if (activeSegment === 'closed-lost') filterParams.dealStage = 'closedlost';
      else if (activeSegment === 'trash') filterParams.classification = 'Trash';
      else if (activeSegment === 'mm') filterParams.lifecyclestage = '266772554'; 
      else if (activeSegment === 'crm') filterParams.lifecyclestage = 'customer';
      if (activeSegment !== 'all' && activeSegment !== 'opportunity') {
        filterParams.excludeLifecycle = 'opportunity';
      }

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

  useEffect(() => {
    const handleSync = () => {
      fetchContacts();
    };
    window.addEventListener('lead_mirror_synced', handleSync);
    return () => window.removeEventListener('lead_mirror_synced', handleSync);
  }, [fetchContacts]);

  useEffect(() => {
    if (selectedContact) {
      setNoteDraft('');
      setNoteStatus('idle');
      setNoteError('');
    }
  }, [selectedContact]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    // Search should be global (not constrained to the current segment)
    setActiveSegment('all');
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

  const buildNotePrompt = (contact: ContactDetails) => {
    const props = contact.raw_data?.properties || {};
    const ownerId = props.hubspot_owner_id || contact.hubspot_owner_id;
    const ownerTag = ownerId ? `@owner-${ownerId}` : '@unassigned';
    return `
You are a sales assistant. Write a concise CRM note for a HubSpot contact.
Tone: direct, analytical, 3-4 sentences max. Explain why the lead is labeled this way using specific signals.
Include a clear next step and tag the owner (${ownerTag}).

Contact:
- Name: ${contact.firstname || ''} ${contact.lastname || ''}`.trim() + `
- Email: ${contact.email || 'Unknown'}
- Lifecycle: ${contact.lifecyclestage || 'Unknown'}
- Lead Status: ${contact.lead_status || 'Unknown'}
- AI Score: ${contact.health_score ?? 0}
- Source: ${props.hs_analytics_source || contact.source || 'Unknown'}
- First Form: ${props.hs_analytics_first_conversion_event_name || props.hs_analytics_source_data_2 || contact.first_form || 'Unknown'}
- Page Views: ${props.hs_analytics_num_page_views || '0'}
- Conversions: ${props.num_conversion_events || '0'}
- Last Visit: ${props.hs_analytics_last_visit_timestamp || 'Unknown'}
- Last Modified: ${contact.last_modified || 'Unknown'}

Output only the note body, no markdown.`;
  };

  const generateNoteDraft = async () => {
    if (!selectedContact) return;
    setNoteStatus('generating');
    setNoteError('');
    try {
      const accessToken = localStorage.getItem('hubspot_access_token');
      const resp = await fetch(getApiUrl('/api/ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          prompt: buildNotePrompt(selectedContact),
          hubspotToken: accessToken
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        if (/EXPIRED_AUTHENTICATION/i.test(errText) || resp.status === 401) {
          throw new Error('HubSpot token expired — click “Connect HubSpot” (top-right) and try again.');
        }
        throw new Error(errText || 'Failed to generate note');
      }
      const data = await resp.json();
      setNoteDraft(data.text || '');
      setNoteStatus('idle');
    } catch (error: any) {
      setNoteStatus('error');
      setNoteError(error.message || 'Failed to generate note');
    }
  };

  const saveNoteToHubSpot = async () => {
    if (!selectedContact || !noteDraft.trim()) return;
    setNoteStatus('saving');
    setNoteError('');
    try {
      const accessToken = localStorage.getItem('hubspot_access_token');
      const resp = await fetch(getApiUrl('/api/notes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hubspotToken: accessToken,
          contactId: selectedContact.id,
          noteBody: noteDraft.trim(),
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        if (/EXPIRED_AUTHENTICATION/i.test(errText) || resp.status === 401) {
          throw new Error('HubSpot token expired — click “Connect HubSpot” (top-right) and try again.');
        }
        throw new Error(errText || 'Failed to save note');
      }
      setNoteStatus('saved');
      setTimeout(() => setNoteStatus('idle'), 3000);
    } catch (error: any) {
      setNoteStatus('error');
      setNoteError(error.message || 'Failed to save note');
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'Hot': return <Flame size={14} className="text-orange-500" />;
      case 'Nurture': return <Clock size={14} className="text-amber-500" />;
      case 'Watch': return <Eye size={14} className="text-indigo-400" />;
      case 'New': return <Sparkles size={14} className="text-emerald-400" />;
      case 'Unqualified': return <Ban size={14} className="text-slate-500" />;
      case 'Active Client': return <UserCheck size={14} className="text-emerald-500" />;
      case 'Employee': return <Users size={14} className="text-cyan-400" />;
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
      case 'Unqualified': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      case 'Active Client': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Employee': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'Trash': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const buildLeadSignals = (contact: ContactDetails) => {
    const props = contact.raw_data?.properties || {};
    const signals: { label: string; value: string }[] = [];

    const addSignal = (label: string, value?: string | number | null) => {
      if (value === null || value === undefined || value === '') return;
      signals.push({ label, value: String(value) });
    };

    addSignal('Lifecycle Stage', contact.lifecyclestage);
    addSignal('Lead Status', props.hs_lead_status || contact.lead_status);
    addSignal('Page Views', props.hs_analytics_num_page_views);
    addSignal('Email Opens', props.hs_email_open_count);
    addSignal('Email Clicks', props.hs_email_click_count);
    addSignal('Conversions', props.num_conversion_events || props.num_conversion_events);
    addSignal('Last Visit', props.hs_analytics_last_visit_timestamp ? formatDate(props.hs_analytics_last_visit_timestamp) : null);
    addSignal('Last Modified', contact.last_modified ? formatDate(contact.last_modified) : null);
    addSignal('Associated Deals', props.num_associated_deals || contact.deals);
    addSignal('Source', props.hs_analytics_source || contact.source);
    addSignal('Source Detail', props.hs_analytics_source_data_1);
    addSignal('First Form', props.hs_analytics_source_data_2);

    return signals;
  };

  const handleContactOpen = async (contact: Contact) => {
    setSelectedContact(contact);
    setLoadingContactDetails(true);
    try {
      const resp = await fetch(`${getApiUrl('/api/contacts')}?id=${contact.id}`);
      if (resp.ok) {
        const detail = await resp.json();
        setSelectedContact(detail);
      }
    } catch (e) {
      console.error('Failed to fetch contact details:', e);
    } finally {
      setLoadingContactDetails(false);
    }
  };

  return (
    <div className="flex bg-[#f8fafc] text-slate-900 min-h-screen font-['Inter'] w-full overflow-hidden min-w-0">
      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-10 overflow-y-auto max-h-screen min-w-0 overflow-x-hidden">
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
               activeSegment === 'opportunity' ? 'Opportunities' :
               activeSegment === 'closed-lost' ? 'Closed / Lost' :
               activeSegment === 'customer' ? 'Customers' :
               activeSegment === 'trash' ? 'Trash' :
               activeSegment === 'mm' ? 'Mastermind' : 'Members'}
            </h1>
            <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-bold text-slate-500">
                <span className="text-slate-900">{pagination.total.toLocaleString()}</span> Strategic Leads
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
              className="bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all w-96 text-sm font-medium"
              />
            </form>

            <button 
              onClick={() => setShowSaveModal(true)}
              className="px-6 py-4 bg-slate-100 border border-slate-200 rounded-2xl hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
            >
              <Save size={18} />
              Save View
            </button>
          </div>
        </header>

        <div id="contacts-segments-row" className="flex flex-wrap gap-3 mb-8">
          {[
            { id: 'all', label: 'Strategic Directory' },
            { id: 'hot', label: 'Hot Targets' },
            { id: 'new', label: 'New Leads' },
            { id: 'nurture', label: 'Nurture' },
            { id: 'watch', label: 'Watch List' },
            { id: 'opportunity', label: 'Opportunities' },
            { id: 'closed-lost', label: 'Closed / Lost' },
            { id: 'customer', label: 'Active Clients' },
            { id: 'unqualified', label: 'Unqualified' },
            { id: 'trash', label: 'Trash' }
          ].map(segment => (
            <button
              key={segment.id}
              onClick={() => {
                setActiveSegment(segment.id);
                setPagination(p => ({ ...p, page: 1 }));
              }}
              className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border transition-colors ${
                activeSegment === segment.id
                  ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
              }`}
            >
              {segment.label}
            </button>
          ))}
        </div>

        {/* --- DATAGRID --- */}
        <div id="contacts-data-grid" className="glass-panel border-slate-200 shadow-2xl overflow-hidden mb-10">
          <div className="overflow-x-hidden">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-10 px-3 py-2">
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
                  <th id="contacts-ai-rank-header" onClick={() => handleSort('health_score')} className="w-24 px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors group">
                    <div className="flex items-center gap-2">
                       A.I. RANK <ChevronDown size={14} className={`transition-transform ${sortField === 'health_score' ? 'text-indigo-400' : 'opacity-0'}`} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('firstname')} className="w-[36%] px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors">
                    PROFILE INFO
                  </th>
                  <th className="w-36 px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">STATUS TAG</th>
                  <th className="w-40 px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">ORGANIZATION</th>
                  <th onClick={() => handleSort('last_modified')} className="w-40 px-3 py-2 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors">
                    LAST INTERACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-3 py-4 border-b border-slate-200 bg-slate-50 opacity-70" />
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Database size={48} className="text-slate-800" />
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">No strategic records found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr 
                      key={contact.id}
                      className={`group hover:bg-slate-50 transition-all duration-300 cursor-pointer ${selectedIds.includes(contact.id) ? 'bg-indigo-500/[0.03]' : ''}`}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.tagName.toLowerCase() === 'input' || target.closest('button')) return;
                        handleContactOpen(contact);
                      }}
                    >
                      <td className="px-3 py-2">
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
                      <td className="px-3 py-2">
                        {(() => {
                          const scoreValue = Number(contact.health_score ?? 0);
                          return (
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-2xl transition-all group-hover:scale-110 ${
                              scoreValue >= 80 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-slate-900 shadow-orange-500/20' : 
                              scoreValue >= 60 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                              'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {scoreValue.toFixed(1)}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-md border flex items-center justify-center text-[10px] font-black transition-all group-hover:rotate-6 ${
                            Number(contact.health_score ?? 0) >= 80 ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            {(contact.firstname?.[0] || contact.email?.[0] || '?')}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-sm text-slate-900 group-hover:text-slate-900 transition-colors tracking-tight truncate">
                              {contact.firstname || 'Anonymous'} {contact.lastname || ''}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 min-w-0">
                              <Mail size={12} className="text-slate-600" />
                              <span className="text-[10px] text-slate-500 font-bold lowecase truncate">{contact.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {contact.classification && (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${getStatusColor(contact.classification)}`}>
                              {getStatusIcon(contact.classification)}
                              {contact.classification}
                            </div>
                            {isMeaningfulTag(contact.lifecyclestage) && (
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-slate-200">
                                {formatTag(contact.lifecyclestage)}
                              </div>
                            )}
                            {isMeaningfulTag(contact.lead_status) && (
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                                {formatTag(contact.lead_status)}
                              </div>
                            )}
                            {isMeaningfulTag(contact.deal_stage) && (
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border-amber-500/20">
                                {formatTag(contact.deal_stage)}
                              </div>
                            )}
                            {(contact.classification === 'Active Client' || contact.lifecyclestage === 'customer') &&
                              /closed\s*lost/i.test(contact.deal_stage || '') && (
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border-rose-500/20">
                                CONFLICT
                              </div>
                            )}
                            {(isMeaningfulTag(contact.first_form) || isMeaningfulTag(contact.source)) && (
                              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 border-slate-200 max-w-[140px] truncate">
                                {formatTag(isMeaningfulTag(contact.first_form) ? contact.first_form : contact.source)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {contact.company ? (
                          <div className="flex items-center gap-2 group/company min-w-0">
                            <Building size={16} className="text-slate-600 group-hover/company:text-indigo-400 transition-colors" />
                            <span className="text-slate-300 text-xs font-bold tracking-tight truncate">{contact.company}</span>
                          </div>
                        ) : (
                          <div className="w-8 h-px bg-slate-800" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="text-xs font-black text-slate-200 tracking-tighter">{formatDate(contact.last_modified)}</div>
                        <div className="flex items-center justify-end gap-2 mt-1 flex-wrap">
                           {/* Data Quality Heuristics */}
                           {!contact.email && (
                             <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20" title="Missing email address">No Email ⚠️</span>
                           )}
                           {!contact.hubspot_owner_id && (
                             <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20" title="No assigned owner">No Owner</span>
                           )}
                           {contact.last_modified && (Date.now() - new Date(contact.last_modified).getTime() > 90 * 24 * 60 * 60 * 1000) && (
                             <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest bg-slate-500/10 px-2 py-0.5 rounded-md border border-slate-500/20" title="No activity in 90+ days">Stale</span>
                           )}
                           {/* Hot Lead Indicator */}
                           {(Number(contact.health_score ?? 0)) >= 80 && contact.classification !== 'Active Client' && contact.classification !== 'Customer' && contact.classification !== 'Employee' && (
                             <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">Critical Lead 🔥</span>
                           )}
                           {/* Ghost Opportunity */}
                           {contact.lifecyclestage === 'opportunity' && contact.last_modified && (Date.now() - new Date(contact.last_modified).getTime() > 30 * 24 * 60 * 60 * 1000) && (
                             <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20" title="Opportunity with no recent activity">Ghost 👻</span>
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
              Showing <span className="text-slate-900">{contacts.length}</span> / {pagination.total.toLocaleString()} Strategic Results
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPagination(p => ({ ...p, page: p.page - 1 }));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={pagination.page <= 1 || loading}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 border border-slate-200 rounded-2xl hover:bg-slate-200 disabled:opacity-40 transition-all font-bold text-sm text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft size={18} /> BACK
            </button>
            
            <div className="px-6 py-3 bg-indigo-500 text-slate-900 font-black rounded-2xl shadow-xl shadow-indigo-500/20 text-sm tracking-widest">
               {pagination.page} <span className="text-slate-900/50 mx-1">/</span> {pagination.totalPages}
            </div>

            <button
              onClick={() => {
                setPagination(p => ({ ...p, page: p.page + 1 }));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 border border-slate-200 rounded-2xl hover:bg-slate-200 disabled:opacity-40 transition-all font-bold text-sm text-slate-600 hover:text-slate-900"
            >
              NEXT <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </main>

      {/* --- BULK ACTION BAR --- */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
           <div className="bg-white/90 backdrop-blur-2xl border border-indigo-500/30 rounded-full px-8 py-4 flex items-center gap-8 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(99,102,241,0.2)]">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">
                    {selectedIds.length}
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest text-slate-300">Target Nodes Selected</span>
              </div>
              
              <div className="h-4 w-[1px] bg-slate-200" />
              
              <div className="flex items-center gap-4">
                 <button 
                   onClick={() => setShowRemediator(true)}
                   className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-900 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                 >
                    <Zap size={14} /> AI Remediate
                 </button>
                 <button 
                   onClick={() => setSelectedIds([])}
                   className="text-slate-500 hover:text-slate-900 transition-colors text-[10px] font-black uppercase tracking-widest px-4"
                 >
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      )}

      {selectedContact && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead Insight</div>
                <div className="mt-2 text-3xl font-black text-slate-900">
                  {selectedContact.firstname || 'Anonymous'} {selectedContact.lastname || ''}
                </div>
                <div className="mt-1 text-sm text-slate-500 font-semibold">{selectedContact.email || 'No email on file'}</div>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-slate-500 hover:text-slate-900 text-sm font-bold"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-widest">
                Score: {Number(selectedContact.health_score ?? 0).toFixed(1)}
              </span>
              {selectedContact.classification && (
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-widest ${getStatusColor(selectedContact.classification)}`}>
                  {getStatusIcon(selectedContact.classification)}
                  {selectedContact.classification}
                </span>
              )}
              {selectedContact.lifecyclestage && (
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-black uppercase tracking-widest">
                  {selectedContact.lifecyclestage}
                </span>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {buildLeadSignals(selectedContact).map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{signal.label}</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{signal.value}</div>
                </div>
              ))}
              {buildLeadSignals(selectedContact).length === 0 && (
                <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 font-semibold">
                  No engagement signals found for this contact yet.
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Note</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">Generate and push a note to HubSpot</div>
                </div>
                {selectedContact.hubspot_url && (
                  <a
                    href={selectedContact.hubspot_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400"
                  >
                    Open in HubSpot
                  </a>
                )}
              </div>

              <textarea
                className="mt-4 w-full min-h-[96px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Generate a note to prefill this..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={generateNoteDraft}
                  disabled={noteStatus === 'generating' || noteStatus === 'saving'}
                  className="px-4 py-2 rounded-full bg-indigo-500 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-400 transition-colors disabled:opacity-50"
                >
                  {noteStatus === 'generating' ? 'Generating…' : 'Generate Note'}
                </button>
                <button
                  onClick={saveNoteToHubSpot}
                  disabled={!noteDraft.trim() || noteStatus === 'saving' || noteStatus === 'generating'}
                  className="px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {noteStatus === 'saving' ? 'Saving…' : 'Push to HubSpot'}
                </button>
                {noteStatus === 'saved' && (
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Saved ✓</span>
                )}
                {noteStatus === 'error' && (
                  <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">{noteError || 'Error'}</span>
                )}
              </div>
            </div>

            {loadingContactDetails && (
              <div className="mt-6 text-xs text-slate-500 font-semibold uppercase tracking-widest">
                Loading deeper CRM details...
              </div>
            )}
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
                lifecycleStage: activeSegment === 'mm' ? '266772554' : activeSegment === 'customer' ? 'customer' : activeSegment === 'opportunity' ? 'opportunity' : undefined,
                dealType: searchTerm.startsWith('type:') ? searchTerm.replace('type:', '') : undefined,
                dealStage: activeSegment === 'closed-lost' ? 'closedlost' : undefined,
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
