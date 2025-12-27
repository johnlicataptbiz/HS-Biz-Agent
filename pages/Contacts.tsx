import React, { useEffect, useState, useMemo } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { leadStatusService, IntelligenceContact } from '../services/leadStatusService';
import { Segment, LeadStatus } from '../types';
import { Users, RefreshCw, Sparkles, ShieldCheck, List, UserCheck, UserX, Clock, Filter, AlertCircle, ArrowRight, Trash2, Trophy, Tag, Eye, Layers, ChevronRight, CheckCircle2 } from 'lucide-react';
import AiModal from '../components/AiModal';
import Pagination from '../components/Pagination';

const Contacts: React.FC = () => {
  const [view, setView] = useState<'funnel' | 'list'>('funnel');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [contactHealth, setContactHealth] = useState({
    statusBreakdown: { 
      'New': 0, 'Hot': 0, 'Nurture': 0, 'Watch': 0, 'Unqualified': 0, 
      'Past Client': 0, 'Active Client': 0, 'Rejected': 0, 'Trash': 0, 'Unclassified': 0 
    } as Record<LeadStatus, number>,
    totalScanned: 0,
    unclassified: 0,
    unassigned: 0,
    inactive: 0,
    healthScore: 0
  });
  const [intelContacts, setIntelContacts] = useState<IntelligenceContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showListAi, setShowListAi] = useState(false);
  const [listPrompt, setListPrompt] = useState('');
  
  // Intelligence Pagination
  const [intelPage, setIntelPage] = useState(1);
  const [intelPageSize, setIntelPageSize] = useState(10);

  useEffect(() => {
    loadData();
    window.addEventListener('hubspot_connection_changed', loadData);
    return () => window.removeEventListener('hubspot_connection_changed', loadData);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);
    
    if (validation.success) {
      try {
        const [segmentData, healthData, intelData] = await Promise.all([
          hubSpotService.fetchSegments(),
          hubSpotService.scanContactOrganization(),
          leadStatusService.fetchIntelligenceContacts(100)
        ]);
        setSegments(segmentData);
        setContactHealth(healthData);
        setIntelContacts(intelData);
      } catch (e) {
        console.error("Data fetch error:", e);
      }
    }
    setIsLoading(false);
  };

  const executeBulkLabeling = async () => {
    if (!window.confirm(`Apply intelligence labels to ${intelContacts.length} contacts in HubSpot?`)) return;
    
    setIsExecuting(true);
    try {
        const updates = intelContacts.map(c => ({ id: c.id, status: c.status }));
        const result = await leadStatusService.batchSync(updates);
        alert(`Successfully labeled ${result.success} contacts. ${result.failed} failed.`);
        await loadData();
    } catch (e) {
        alert("Execution failed.");
    } finally {
        setIsExecuting(false);
    }
  };

  const filteredIntel = useMemo(() => {
      // Future: Add filtering by status here
      return intelContacts;
  }, [intelContacts]);

  const pagedIntel = filteredIntel.slice((intelPage - 1) * intelPageSize, intelPage * intelPageSize);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.3em]">Organization Engine</span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Database <span className="gradient-text">Intelligence.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Advanced 9-point classification, B2B association tracking, and automated lead tagging.
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl">
             <button 
               onClick={() => setView('funnel')}
               className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'funnel' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
                <Layers size={14} /> Funnel
             </button>
             <button 
               onClick={() => setView('list')}
               className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'list' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
             >
                <Users size={14} /> Contacts
             </button>
          </div>
          <button 
            onClick={executeBulkLabeling}
            disabled={isExecuting || !isConnected}
            className={`px-8 py-3 rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2 ${
                isExecuting ? 'bg-slate-700 text-slate-400' : 'premium-gradient text-white shadow-indigo-500/20'
            }`}
          >
              {isExecuting ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Apply Labels
          </button>
        </div>
      </div>

      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                 <ShieldCheck className="text-amber-400" size={32} />
             </div>
             <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-white uppercase tracking-wider">Connection Required</h3>
                 <p className="text-slate-400 mt-2 font-medium">Link your HubSpot portal to run organizational heuristics.</p>
             </div>
         </div>
      )}

      {/* VIEW: Funnel Summary */}
      {isConnected && view === 'funnel' && (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
             {[
               { id: 'New', color: 'bg-blue-500', icon: Sparkles },
               { id: 'Hot', color: 'bg-rose-500', icon: Trophy, pulse: true },
               { id: 'Nurture', color: 'bg-amber-500', icon: Clock },
               { id: 'Watch', color: 'bg-purple-500', icon: AlertCircle },
               { id: 'Active Client', color: 'bg-emerald-500', icon: ShieldCheck },
               { id: 'Past Client', color: 'bg-slate-500', icon: UserCheck },
               { id: 'Unqualified', color: 'bg-slate-600', icon: Filter },
               { id: 'Rejected', color: 'bg-red-500', icon: UserX },
               { id: 'Trash', color: 'bg-gray-700', icon: Trash2 },
               { id: 'Unclassified', color: 'bg-slate-800', icon: AlertCircle, border: true }
             ].map((status: any) => (
                <div key={status.id} className={`glass-card p-5 relative overflow-hidden group hover:-translate-y-1 transition-all ${status.border ? 'border-dashed border-slate-600' : ''}`}>
                   {status.pulse && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>}
                   <div className="flex justify-between items-start mb-3">
                      <div className={`p-2.5 rounded-xl ${status.color} bg-opacity-20 text-white`}>
                          <status.icon size={18} />
                      </div>
                      <span className="text-3xl font-extrabold text-white">
                          {contactHealth.statusBreakdown[status.id as LeadStatus] || 0}
                      </span>
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] truncate">{status.id}</p>
                </div>
             ))}
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-3">
                 <List className="text-indigo-400" />
                 Active Segments
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {segments.slice(0, 6).map((seg) => (
                <div 
                  key={seg.id} 
                  className="glass-card p-6 group hover:border-indigo-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-white/5 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <List size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors uppercase italic tracking-tight">{seg.name}</h3>
                      <p className="text-xs text-slate-500 font-bold mt-1 tracking-widest uppercase">{seg.contactCount.toLocaleString()} Contacts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Contact List Intelligence */}
      {isConnected && view === 'list' && (
        <div className="animate-in slide-in-from-right-4 duration-500 space-y-6">
           <div className="glass-card overflow-hidden">
               <table className="w-full text-left">
                   <thead className="bg-white/5 border-b border-white/10">
                       <tr>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Heuristic Status</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Strategic Score</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Risk Level</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Activity</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Context</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                       {pagedIntel.map(contact => (
                           <tr key={contact.id} className="hover:bg-white/[0.02] transition-colors group">
                               <td className="px-6 py-4">
                                   <div>
                                       <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{contact.name}</p>
                                       <p className="text-xs text-slate-500 font-medium">{contact.email}</p>
                                   </div>
                               </td>
                               <td className="px-6 py-4">
                                   <div className="flex items-center gap-2">
                                       <div className={`w-2 h-2 rounded-full ${
                                           contact.status === 'Hot' ? 'bg-rose-500' :
                                           contact.status === 'Active Client' ? 'bg-emerald-500' :
                                           contact.status === 'New' ? 'bg-blue-500' : 'bg-slate-600'
                                       }`}></div>
                                       <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{contact.status}</span>
                                   </div>
                               </td>
                               <td className="px-6 py-4">
                                   <div className="flex items-center gap-3">
                                       <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden">
                                           <div 
                                               className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                                               style={{ width: `${contact.rawProperties.strategic_score}%` }}
                                           ></div>
                                       </div>
                                       <span className="text-xs font-black text-white">{contact.rawProperties.strategic_score}</span>
                                   </div>
                               </td>
                               <td className="px-6 py-4">
                                   <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                                       contact.rawProperties.risk_level === 'High' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                                       contact.rawProperties.risk_level === 'Medium' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                       'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                   }`}>
                                       {contact.rawProperties.risk_level} Risk
                                   </span>
                               </td>
                               <td className="px-6 py-4">
                                   <div className="flex flex-col">
                                       <span className="text-xs font-bold text-slate-300">{contact.lastActivityDays} Days Ago</span>
                                       <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Last Site Visit</span>
                                   </div>
                               </td>
                               <td className="px-6 py-4 text-right">
                                   <div className="flex flex-col items-end">
                                       <span className="text-xs font-bold text-indigo-400">{contact.associatedDeals} Associated Deals</span>
                                       {contact.associatedCompany && <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.1em]">Target Account</span>}
                                   </div>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
           
           <Pagination
                page={intelPage}
                pageSize={intelPageSize}
                totalItems={intelContacts.length}
                onPageChange={setIntelPage}
                onPageSizeChange={setIntelPageSize}
                className="justify-end"
           />
        </div>
      )}

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="workflow"
        contextName="Contact Organization"
      />
    </div>
  );
};

export default Contacts;

