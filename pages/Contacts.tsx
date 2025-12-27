import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Segment, LeadStatus } from '../types';
import { Users, RefreshCw, Sparkles, ShieldCheck, List, UserCheck, UserX, Clock, Filter, AlertCircle, ArrowRight, Trash2, Trophy } from 'lucide-react';
import AiModal from '../components/AiModal';
import Pagination from '../components/Pagination';

const Contacts: React.FC = () => {
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
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showListAi, setShowListAi] = useState(false);
  const [listPrompt, setListPrompt] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

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
        const [segmentData, healthData] = await Promise.all([
          hubSpotService.fetchSegments(),
          hubSpotService.scanContactOrganization()
        ]);
        setSegments(segmentData);
        setPage(1);
        setContactHealth(healthData);
      } catch (e) {
        console.error("Data fetch error:", e);
      }
    }
    setIsLoading(false);
  };

  const total = segments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSegments = segments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const topLists = [...segments]
    .sort((a, b) => (b.contactCount || 0) - (a.contactCount || 0))
    .slice(0, 15)
    .map((seg) => `- ${seg.name} (${seg.contactCount} contacts, ${seg.isDynamic ? 'dynamic' : 'static'})`)
    .join('\n');

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.3em]">Organization Engine</span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Lists & <span className="gradient-text">Contacts.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Audit your contact database health and segment organization.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={loadData}
            className="p-3 glass-button border-white/5 text-slate-400 hover:text-white transition-all active:scale-90"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button 
            id="clean-up-contacts-btn"
            onClick={() => setShowAi(true)}
            className="px-8 py-3 premium-gradient text-white rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Clean Up Contacts
          </button>
        </div>
      </div>

      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                 <ShieldCheck className="text-amber-400" size={32} />
             </div>
             <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-white uppercase tracking-wider">Connect Required</h3>
                 <p className="text-slate-400 mt-2 font-medium">Connect your HubSpot instance to analyze your contact database.</p>
             </div>
         </div>
      )}

      {/* Contact Health Summary */}
      {/* Lead Status Funnel - 9 Point Logic */}
      {isConnected && (
        <div className="space-y-6">
          <div className="flex justify-between items-end">
             <h2 className="text-xl font-bold text-white uppercase tracking-wider">Lead Status Funnel</h2>
             <div className="flex gap-2">
                <div className="px-3 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                    {contactHealth.statusBreakdown['Trash']} Trash
                </div>
                <div className="px-3 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                    {contactHealth.statusBreakdown['Active Client']} Active
                </div>
             </div>
          </div>
          
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
                <div key={status.id} className={`glass-card p-4 relative overflow-hidden group hover:-translate-y-1 transition-all ${status.border ? 'border-dashed border-slate-600' : ''}`}>
                   {status.pulse && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>}
                   <div className="flex justify-between items-start mb-2">
                      <div className={`p-2 rounded-lg ${status.color} bg-opacity-20 text-white`}>
                          <status.icon size={16} />
                      </div>
                      <span className="text-2xl font-extrabold text-white">
                          {contactHealth.statusBreakdown[status.id as LeadStatus] || 0}
                      </span>
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{status.id}</p>
                   {status.id === 'Unclassified' && (contactHealth.statusBreakdown['Unclassified'] > 0) && (
                       <button 
                         onClick={() => {
                            setListPrompt(
                                `Help me classify these ${contactHealth.statusBreakdown['Unclassified']} unclassified contacts.\n` + 
                                `Analyze their properties and verify if they match the 'New', 'Nurture', or 'Trash' buckets.\n` + 
                                `Return a plan to bulk update their 'Lead Status' property.`
                            );
                            setShowListAi(true);
                         }}
                         className="mt-3 w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                       >
                           Details <ArrowRight size={10} />
                       </button>
                   )}
                </div>
             ))}
          </div>
        </div>
      )}

      {/* Lists/Segments */}
      {isConnected && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">Active Lists</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{segments.length} lists found</span>
              <button
                onClick={() => {
                  setListPrompt(
                    [
                      'Propose a list consolidation plan based on the lists below.',
                      'Group similar lists, identify redundancies, and suggest merges with rationale.',
                      'Return a property_migration_spec with a concise merge plan in spec.json and spec.yaml.',
                      'If write actions are possible, include spec.apiCalls for list merge or list update operations.',
                      '',
                      topLists || '(no lists available)'
                    ].join('\n')
                  );
                  setShowListAi(true);
                }}
                className="px-4 py-2 glass-button text-[10px] font-extrabold uppercase tracking-widest text-slate-300 hover:text-white"
              >
                Consolidate Lists
              </button>
            </div>
          </div>
          
          {segments.length === 0 && !isLoading && (
            <div className="glass-card p-12 text-center">
              <List className="mx-auto text-slate-400 mb-4" size={40} />
              <p className="text-slate-400">No lists found in your portal.</p>
            </div>
          )}

          {segments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagedSegments.map((seg) => (
                <div key={seg.id} className="glass-card p-6 hover:-translate-y-1 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <List size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate group-hover:text-indigo-400 transition-colors">{seg.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{seg.contactCount.toLocaleString()} contacts</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          seg.isDynamic ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                        }`}>
                          {seg.isDynamic ? 'Dynamic' : 'Static'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            pageSizeOptions={[6, 12, 24, 48]}
            className="pt-2"
          />
        </div>
      )}

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="workflow"
        contextName="Contact Organization"
      />
      <AiModal 
        isOpen={showListAi} 
        onClose={() => setShowListAi(false)} 
        contextType="data"
        contextName="List Consolidation"
        initialPrompt={listPrompt}
      />
    </div>
  );
};

export default Contacts;
