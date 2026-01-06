import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Campaign, Form } from '../types';
import { Megaphone, RefreshCw, Sparkles, ShieldCheck, TrendingUp, FileText, Download, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import AiModal from '../components/AiModal';
import Pagination from '../components/Pagination';

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'forms'>('campaigns');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [portalId, setPortalId] = useState<number | null>(null);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignPageSize, setCampaignPageSize] = useState(9);
  const [leadMagnetPage, setLeadMagnetPage] = useState(1);
  const [leadMagnetPageSize, setLeadMagnetPageSize] = useState(6);
  const [formPage, setFormPage] = useState(1);
  const [formPageSize, setFormPageSize] = useState(12);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [aiModal, setAiModal] = useState<{isOpen: boolean, contextName: string, initialPrompt: string, contextType: any}>({
      isOpen: false,
      contextName: '',
      initialPrompt: '',
      contextType: 'workflow'
  });

  useEffect(() => {
    loadData();
    window.addEventListener('hubspot_connection_changed', loadData);
    return () => window.removeEventListener('hubspot_connection_changed', loadData);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);
    setValidationError(validation.success ? null : (validation.error || "Connection Failed"));
    
    if (validation.success) {
      try {
        const portal = await hubSpotService.getPortalId();
        setPortalId(portal);
        const [campData, formData] = await Promise.all([
            hubSpotService.fetchCampaigns(),
            hubSpotService.fetchForms()
        ]);
        setCampaigns(campData);
        setForms(formData);
        setCampaignPage(1);
        setLeadMagnetPage(1);
        setFormPage(1);
      } catch (e) {
        console.error("Campaign fetch error:", e);
        setCampaigns([]);
        setForms([]);
      }
    } else {
      setCampaigns([]);
      setForms([]);
      setPortalId(null);
    }
    setIsLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'PAUSED': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'COMPLETED': return 'text-slate-600 bg-slate-100 border-slate-200';
      default: return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  const getScoreColor = (score: number) => {
      if (score > 80) return 'text-emerald-400';
      if (score > 50) return 'text-amber-400';
      return 'text-rose-400';
  };

  const formatNumber = (value: number | undefined | null) => {
      if (!value) return '0';
      return value.toLocaleString();
  };

  const formatDate = (value?: string | number | null) => {
      if (!value) return 'N/A';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
  };

  const getHubSpotCampaignUrl = (campaign: Campaign) => {
      if (!portalId) return null;
      return `https://app.hubspot.com/marketing/${portalId}/campaigns/${campaign.id}`;
  };

  const triggerOptimize = (item: any, type: 'campaign' | 'form') => {
      const isCampaign = type === 'campaign';
      const score = item.aiScore;
      
      let prompt = "";
      if (score < 50) {
          prompt = `Analyze why "${item.name}" has such a low performance score (${score}%). Help me fix the architecture or content to improve engagement.`;
      } else if (score < 80) {
          prompt = `"${item.name}" is performing okay (${score}%), but I want to reach elite levels (>90%). Suggest 3 specific optimizations for better conversion.`;
      } else {
          prompt = `"${item.name}" is a top performer (${score}%). How can I replicate this success across other ${isCampaign ? 'campaigns' : 'lead magnets'}?`;
      }

      setAiModal({
          isOpen: true,
          contextName: item.name,
          initialPrompt: prompt,
          contextType: isCampaign ? 'workflow' : 'data'
      });
  };

  const leadMagnets = forms.filter(f => f.leadMagnet);
  const hasFormsError = forms.length === 0 && isConnected && !isLoading;

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const revenueDiff = (b.revenue || 0) - (a.revenue || 0);
    if (revenueDiff !== 0) return revenueDiff;
    const volumeDiff = (b.contacts || 0) - (a.contacts || 0);
    if (volumeDiff !== 0) return volumeDiff;
    const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return updatedB - updatedA;
  });
  const campaignTotal = sortedCampaigns.length;
  const campaignTotalPages = Math.max(1, Math.ceil(campaignTotal / campaignPageSize));
  const currentCampaignPage = Math.min(campaignPage, campaignTotalPages);
  const pagedCampaigns = sortedCampaigns.slice((currentCampaignPage - 1) * campaignPageSize, currentCampaignPage * campaignPageSize);

  const leadMagnetTotal = leadMagnets.length;
  const leadMagnetTotalPages = Math.max(1, Math.ceil(leadMagnetTotal / leadMagnetPageSize));
  const currentLeadMagnetPage = Math.min(leadMagnetPage, leadMagnetTotalPages);
  const pagedLeadMagnets = leadMagnets.slice((currentLeadMagnetPage - 1) * leadMagnetPageSize, currentLeadMagnetPage * leadMagnetPageSize);

  const formTotal = forms.length;
  const formTotalPages = Math.max(1, Math.ceil(formTotal / formPageSize));
  const currentFormPage = Math.min(formPage, formTotalPages);
  const pagedForms = forms.slice((currentFormPage - 1) * formPageSize, currentFormPage * formPageSize);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.3em]">Marketing Intelligence</span>
          </div>
          <h1 id="campaigns-header" className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Campaign <span className="gradient-text">Intelligence.</span>
          </h1>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            Monitor campaign performance, ROI, and lead capture assets.
          </p>
        </div>
        
        <div className="flex gap-4">
            <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button 
                  onClick={() => setActiveTab('campaigns')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'campaigns' ? 'bg-rose-500 text-slate-900 shadow-lg' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Campaigns
                </button>
                <button 
                  onClick={() => setActiveTab('forms')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'forms' ? 'bg-rose-500 text-slate-900 shadow-lg' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Lead Magnets
                </button>
            </div>

          <button 
            onClick={loadData}
            className="p-3 glass-button border-slate-200 text-slate-600 hover:text-slate-900 transition-all active:scale-90"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={`${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
          <button 
            onClick={() => setAiModal({ isOpen: true, contextName: 'Strategy', initialPrompt: 'Help me plan a new high-leverage marketing strategy...', contextType: 'workflow' })}
            className="px-8 py-3 premium-gradient text-slate-900 rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
              <Sparkles size={18} />
              Plan Strategy
          </button>
        </div>
      </div>

      {!isConnected && (
         <div className="glass-card p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                 <ShieldCheck className="text-rose-400" size={32} />
             </div>
              <div className="max-w-md mx-auto">
                 <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
                     {(validationError === "Authentication Expired" || validationError === "Authentication required") ? "Authorization Required" : "Marketing Hub Required"}
                 </h3>
                 <p className="text-slate-600 mt-2 font-medium">
                     {(validationError === "Authentication Expired" || validationError === "Authentication required" || validationError === "Insufficient Permissions") 
                        ? "Your connection to HubSpot has expired or lacks required scopes. Please re-authorize to continue." 
                        : "Connect your HubSpot instance to view campaigns and forms."}
                 </p>
                                 {(validationError === "Authentication Expired" || validationError === "Authentication required" || validationError === "Insufficient Permissions") && (
                     <button 
                        onClick={() => hubSpotService.initiateOAuth()}
                        className="mt-6 px-8 py-3 premium-gradient text-slate-900 rounded-xl text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg mx-auto flex items-center gap-2"
                     >
                         <ShieldCheck size={18} />
                         Reconnect HubSpot
                     </button>
                 )}
              </div>
          </div>
       )}

      {/* Permissions Warning for 403s */}
      {isConnected && hasFormsError && (
          <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5 flex items-center gap-6">
               <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500">
                   <AlertTriangle size={32} />
               </div>
               <div className="flex-1">
                   <h4 className="font-bold text-slate-900">Action Required: Scopes Missing</h4>
                   <p className="text-sm text-slate-600 mt-1">
                       We couldn't load your forms. Ensure your Connected App has the <code className="text-amber-400 px-1">forms</code> and <code className="text-amber-400 px-1">automation</code> scopes enabled.
                   </p>
               </div>
               <a 
                href="https://developers.hubspot.com/docs/apps/developer-platform/build-apps/manage-apps-in-hubspot" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 glass-button text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-slate-300 hover:text-slate-900 whitespace-nowrap"
               >
                   Setup Scopes
                   <ExternalLink size={14} />
               </a>
          </div>
      )}

      {/* CAMPAIGNS VIEW */}
	      {isConnected && activeTab === 'campaigns' && (
	          <>
	            {campaigns.length > 0 ? (
                <>
	                <div id="campaigns-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {pagedCampaigns.map((camp) => {
                    const isEmail = camp.type === 'EMAIL_BLAST';
                    const isPage = camp.type === 'LANDING_PAGE' || camp.type === 'SITE_PAGE';
                    const volumeLabel = isEmail ? 'Sent' : isPage ? 'Submissions' : 'Contacts';
                    const volumeValue = isEmail ? camp.sent : isPage ? camp.submissions : camp.contacts;
                    const openRate = camp.sent ? Math.round(((camp.opens || 0) / camp.sent) * 100) : 0;
                    const clickRate = camp.sent ? Math.round(((camp.clicks || 0) / camp.sent) * 100) : 0;

                    return (
                    <div
                      key={camp.id}
                      className="glass-card p-8 group hover:-translate-y-1 transition-all duration-500 border-slate-200 hover:border-rose-500/20 cursor-pointer"
                      onClick={() => setSelectedCampaign(camp)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedCampaign(camp);
                        }
                      }}
                    >
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                            <Megaphone size={24} />
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="text-lg font-bold text-slate-900 group-hover:text-rose-500 transition-colors truncate w-full" title={camp.name}>{camp.name}</h3>
                            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">ID: {camp.id}</p>
                        </div>
                        </div>
                        <div className={`text-xl font-black ${getScoreColor(camp.aiScore || 0)}`}>
                            {camp.aiScore}%
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-5">
                        {camp.type && (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
                            {camp.type.replace('_', ' ')}
                          </span>
                        )}
                        {camp.channel && (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            {camp.channel}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-lg border ${getStatusColor(camp.status)}`}>
                          {camp.status || 'Unknown'}
                        </span>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                            <span className="text-slate-500">{volumeLabel}</span>
                            <span className="text-slate-900">{formatNumber(volumeValue || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                            <span className="text-slate-500">Revenue Influence</span>
                            <span className="text-emerald-400 font-black">${(camp.revenue || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                            <span className="text-slate-500">Calculated ROI</span>
                            <span className="text-slate-900">
                                {camp.revenue && camp.budget ? `${Math.round(((camp.revenue - camp.budget) / camp.budget) * 100)}%` : 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                            <span className="text-slate-500">Last Updated</span>
                            <span className="text-slate-900">{formatDate(camp.updatedAt || camp.createdAt)}</span>
                        </div>
                    </div>

                    {(isEmail || isPage) && (
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {isEmail && (
                          <>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Opens</div>
                              <div className="text-base font-bold text-slate-900">{formatNumber(camp.opens || 0)} ({openRate}%)</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Clicks</div>
                              <div className="text-base font-bold text-slate-900">{formatNumber(camp.clicks || 0)} ({clickRate}%)</div>
                            </div>
                          </>
                        )}
                        {isPage && (
                          <>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Visits</div>
                              <div className="text-base font-bold text-slate-900">{formatNumber(camp.visits || 0)}</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Submissions</div>
                              <div className="text-base font-bold text-slate-900">{formatNumber(camp.submissions || 0)}</div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="pt-6 border-t border-slate-200 flex gap-2">
                        <button 
                            onClick={(event) => {
                              event.stopPropagation();
                              triggerOptimize(camp, 'campaign');
                            }}
                            className="flex-1 py-3 premium-gradient rounded-xl text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all text-slate-900"
                        >
                            <Sparkles size={14} />
                            Optimize
                        </button>
                        <button
                          onClick={(event) => event.stopPropagation()}
                          className="w-12 h-11 glass-button flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all"
                        >
                            <TrendingUp size={16} />
                        </button>
                    </div>
                    </div>
                    );
                })}
                </div>
                  <Pagination
                    page={currentCampaignPage}
                    pageSize={campaignPageSize}
                    totalItems={campaignTotal}
                    onPageChange={setCampaignPage}
                    onPageSizeChange={(n) => {
                      setCampaignPageSize(n);
                      setCampaignPage(1);
                    }}
                    pageSizeOptions={[6, 9, 12, 18]}
                    className="pt-2"
                  />
                </>
	            ) : (
	                <div className="glass-card p-20 text-center space-y-6">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto border border-slate-200">
                        <Megaphone className="text-slate-500" size={40} />
                    </div>
                    <div className="max-w-md mx-auto">
                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">No Campaigns Found</h3>
                        <p className="text-slate-600 mt-3 font-medium text-sm leading-relaxed">
                        No marketing campaigns were detected. Create campaigns in HubSpot Marketing Hub to see them here.
                        </p>
                    </div>
                </div>
            )}
          </>
      )}

      {/* FORMS / LEAD MAGNETS VIEW */}
	      {isConnected && activeTab === 'forms' && (
	          <div className="space-y-8">
              {/* Lead Magnets Section */}
	              {leadMagnets.length > 0 && (
	                  <div className="space-y-4">
                      <div className="flex items-center gap-3">
                          <Download className="text-rose-500" size={20} />
                          <h3 className="text-xl font-bold text-slate-900">Detected Lead Magnets</h3>
	                      </div>
	                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
	                          {pagedLeadMagnets.map(form => (
	                              <div key={form.id} className="glass-card p-6 border-rose-500/20 bg-rose-500/5 group">
                                  <div className="flex items-start justify-between">
                                      <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                                          <FileText className="text-rose-500" size={20} />
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                            {form.submissions} Submissions
                                        </div>
                                        <div className={`text-xs font-bold ${getScoreColor(form.aiScore || 0)}`}>
                                            {form.aiScore}% Score
                                        </div>
                                      </div>
                                  </div>
                                  <div className="mt-4">
                                      <h4 className="font-bold text-slate-900 text-lg leading-tight truncate">{form.name}</h4>
                                      <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-widest">{form.id?.slice(0, 12)}</p>
                                  </div>
                                  <div className="mt-6 pt-6 border-t border-slate-200">
                                      <button 
                                        onClick={() => triggerOptimize(form, 'form')}
                                        className="w-full py-3 glass-button text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-500/10 transition-all text-slate-600 hover:text-slate-900"
                                      >
                                        <Sparkles size={14} className="text-rose-500" />
                                        Improve Performance
                                      </button>
                                  </div>
	                              </div>
	                          ))}
	                      </div>
                        <Pagination
                          page={currentLeadMagnetPage}
                          pageSize={leadMagnetPageSize}
                          totalItems={leadMagnetTotal}
                          onPageChange={setLeadMagnetPage}
                          onPageSizeChange={(n) => {
                            setLeadMagnetPageSize(n);
                            setLeadMagnetPage(1);
                          }}
                          pageSizeOptions={[3, 6, 9, 12]}
                          className="pt-2"
                        />
	                  </div>
	              )}

              {/* All Forms Table */}
              <div className="glass-card overflow-hidden">
                  <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <FileText className="text-slate-500" size={20} />
                          <h3 className="text-xl font-bold text-slate-900">All Active Forms</h3>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{forms.length} Total</span>
                  </div>
	                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-extrabold tracking-[0.2em]">
                        <th className="px-8 py-6">Form Name</th>
                        <th className="px-8 py-6">Intelligence</th>
                        <th className="px-8 py-6 text-right">Created</th>
                      </tr>
	                    </thead>
	                    <tbody className="divide-y divide-slate-200">
	                      {pagedForms.map((form) => (
	                        <tr key={form.id} className="hover:bg-slate-50 transition-all group">
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                                {form.name}
                                {form.leadMagnet && <Sparkles size={12} className="text-amber-400" />}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-widest">{form.guid?.slice(0, 16)}</div>
                          </td>
                          <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                  <div className={`text-sm font-black w-10 ${getScoreColor(form.aiScore || 0)}`}>{form.aiScore}%</div>
                                  <button 
                                    onClick={() => triggerOptimize(form, 'form')}
                                    className="p-1.5 opacity-0 group-hover:opacity-100 bg-slate-100 rounded-lg text-slate-600 hover:text-rose-500 transition-all"
                                  >
                                      <Sparkles size={14} />
                                  </button>
                              </div>
                          </td>
                          <td className="px-8 py-6 text-right text-sm text-slate-600 font-medium">
                            {new Date(form.createdAt).toLocaleDateString()}
                          </td>
	                        </tr>
	                      ))}
                      {forms.length === 0 && (
                          <tr>
                              <td colSpan={3} className="px-8 py-12 text-center text-slate-600">No forms found or permission denied.</td>
                          </tr>
                      )}
	                    </tbody>
	                  </table>
                    <div className="p-6 border-t border-slate-200">
                      <Pagination
                        page={currentFormPage}
                        pageSize={formPageSize}
                        totalItems={formTotal}
                        onPageChange={setFormPage}
                        onPageSizeChange={(n) => {
                          setFormPageSize(n);
                          setFormPage(1);
                        }}
                        pageSizeOptions={[10, 12, 20, 50]}
                      />
                    </div>
	              </div>
	          </div>
	      )}

      <AiModal 
        isOpen={aiModal.isOpen} 
        onClose={() => setAiModal(prev => ({ ...prev, isOpen: false }))} 
        contextType={aiModal.contextType}
        contextName={aiModal.contextName}
        initialPrompt={aiModal.initialPrompt}
      />

      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 relative">
            <button
              onClick={() => setSelectedCampaign(null)}
              className="absolute top-6 right-6 text-sm font-bold text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rose-500">Campaign Insight</p>
                <h3 className="text-3xl font-black text-slate-900">{selectedCampaign.name}</h3>
                <p className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-widest">ID: {selectedCampaign.id}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedCampaign.type && (
                  <span className="px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                    {selectedCampaign.type.replace('_', ' ')}
                  </span>
                )}
                {selectedCampaign.channel && (
                  <span className="px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    {selectedCampaign.channel}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border ${getStatusColor(selectedCampaign.status)}`}>
                  {selectedCampaign.status || 'Unknown'}
                </span>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest bg-slate-100 border border-slate-200 ${getScoreColor(selectedCampaign.aiScore || 0)}`}>
                  Score: {selectedCampaign.aiScore || 0}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Contacts / Volume</div>
                  <div className="text-xl font-bold text-slate-900">{formatNumber(selectedCampaign.contacts || 0)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Revenue Influence</div>
                  <div className="text-xl font-bold text-emerald-500">${formatNumber(selectedCampaign.revenue || 0)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Last Updated</div>
                  <div className="text-lg font-bold text-slate-900">{formatDate(selectedCampaign.updatedAt || selectedCampaign.createdAt)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">ROI</div>
                  <div className="text-lg font-bold text-slate-900">
                    {selectedCampaign.revenue && selectedCampaign.budget
                      ? `${Math.round(((selectedCampaign.revenue - selectedCampaign.budget) / selectedCampaign.budget) * 100)}%`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {(selectedCampaign.sent || selectedCampaign.opens || selectedCampaign.clicks || selectedCampaign.submissions || selectedCampaign.visits) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedCampaign.sent !== undefined && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Sent</div>
                      <div className="text-base font-bold text-slate-900">{formatNumber(selectedCampaign.sent || 0)}</div>
                    </div>
                  )}
                  {selectedCampaign.opens !== undefined && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Opens</div>
                      <div className="text-base font-bold text-slate-900">{formatNumber(selectedCampaign.opens || 0)}</div>
                    </div>
                  )}
                  {selectedCampaign.clicks !== undefined && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Clicks</div>
                      <div className="text-base font-bold text-slate-900">{formatNumber(selectedCampaign.clicks || 0)}</div>
                    </div>
                  )}
                  {selectedCampaign.visits !== undefined && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Visits</div>
                      <div className="text-base font-bold text-slate-900">{formatNumber(selectedCampaign.visits || 0)}</div>
                    </div>
                  )}
                  {selectedCampaign.submissions !== undefined && (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Submissions</div>
                      <div className="text-base font-bold text-slate-900">{formatNumber(selectedCampaign.submissions || 0)}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                {getHubSpotCampaignUrl(selectedCampaign) && (
                  <a
                    href={getHubSpotCampaignUrl(selectedCampaign) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2 rounded-xl border border-slate-200 text-xs font-extrabold uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all"
                  >
                    View in HubSpot
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
