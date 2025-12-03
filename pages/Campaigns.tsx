import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import * as mockService from '../services/mockService';
import { Campaign } from '../types';
import { Megaphone, RefreshCw, Sparkles, ArrowUpRight, Search, TrendingUp, Users, DollarSign, Calendar, PlayCircle, PauseCircle, FileEdit, CheckCircle2 } from 'lucide-react';
import AiModal from '../components/AiModal';

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'draft' | 'completed'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const token = hubSpotService.getToken();

    if (token) {
      setIsConnected(true);
      try {
        const data = await hubSpotService.fetchCampaigns();
        setCampaigns(data);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        const mockData = await mockService.getCampaigns();
        setCampaigns(mockData);
      }
    } else {
      setIsConnected(false);
      const mockData = await mockService.getCampaigns();
      setCampaigns(mockData);
    }
    setIsLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getStatusIcon = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return <PlayCircle size={16} className="text-emerald-600" />;
      case 'paused': return <PauseCircle size={16} className="text-amber-600" />;
      case 'draft': return <FileEdit size={16} className="text-slate-400" />;
      case 'completed': return <CheckCircle2 size={16} className="text-indigo-600" />;
    }
  };

  const getStatusStyle = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'paused': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'draft': return 'bg-slate-50 text-slate-600 border-slate-200';
      case 'completed': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalLeads = campaigns.reduce((acc, c) => acc + c.leads, 0);
  const totalConversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + (c.spent || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
            Campaigns
          </h1>
          <p className="text-slate-500 mt-1">
            {isConnected ? 'Live data from HubSpot' : 'Demo mode - Connect HubSpot for live data'}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setShowAi(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Sparkles size={16} />
            Plan Campaign
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
          {(['all', 'active', 'paused', 'draft', 'completed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filterStatus === filter
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Campaigns</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{campaigns.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Leads</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalLeads.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Conversions</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{totalConversions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Spent</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">${totalSpent.toLocaleString()}</p>
        </div>
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map((campaign) => (
            <div 
              key={campaign.id}
              className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                    <Megaphone size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-indigo-900 transition-colors">
                      {campaign.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border ${getStatusStyle(campaign.status)}`}>
                        {getStatusIcon(campaign.status)}
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                      <span>{campaign.type}</span>
                      {campaign.startDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {campaign.startDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm">
                      <Users size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-700">{campaign.leads.toLocaleString()} leads</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <TrendingUp size={14} className="text-emerald-500" />
                      <span className="font-medium text-emerald-600">{campaign.conversions} conversions</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${getScoreColor(campaign.aiScore)}`}>
                    {campaign.aiScore}
                  </div>
                  <button
                    onClick={() => setSelectedCampaign(campaign)}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles size={14} />
                    Analyze
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredCampaigns.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <Megaphone size={40} className="mx-auto mb-4 text-slate-300" />
              <p className="font-medium">No campaigns found</p>
              <p className="text-sm mt-1">Try adjusting your filters or connect to HubSpot</p>
            </div>
          )}
        </div>
      )}

      {/* AI Modal for selected campaign */}
      <AiModal
        isOpen={!!selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        contextType="workflow"
        contextName={selectedCampaign?.name}
        initialPrompt={selectedCampaign ? `Analyze the "${selectedCampaign.name}" marketing campaign.\n\nCurrent metrics:\n- Status: ${selectedCampaign.status}\n- Type: ${selectedCampaign.type}\n- Leads Generated: ${selectedCampaign.leads}\n- Conversions: ${selectedCampaign.conversions}\n- Budget Spent: $${selectedCampaign.spent || 0}\n- AI Score: ${selectedCampaign.aiScore}/100\n\nProvide recommendations to improve campaign performance for PT Biz.` : ''}
      />

      {/* AI Modal for new campaign */}
      <AiModal
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        contextType="workflow"
        contextName="New Campaign"
        initialPrompt="Plan a new HubSpot marketing campaign for PT Biz. We target Physical Therapy clinic owners for our coaching programs.\n\nConsider these campaign types:\n1. Webinar promotion campaign\n2. Podcast listener conversion\n3. Paid ads (Facebook/LinkedIn) retargeting\n4. Email nurture campaign\n5. Referral program launch\n\nGenerate a campaign plan with target audience, channels, messaging, and expected KPIs."
      />
    </div>
  );
};

export default Campaigns;
