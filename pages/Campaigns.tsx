import React, { useEffect, useState } from 'react';
import { hubSpotService } from '../services/hubspotService';
import { Campaign } from '../types';
import { Sparkles, Megaphone, TrendingUp, DollarSign, Users, RefreshCw, ArrowUpRight, Target, Calendar, BarChart3 } from 'lucide-react';
import AiModal from '../components/AiModal';

// Mock campaigns for demo mode
const getMockCampaigns = (): Campaign[] => [
  { id: '1', name: 'Q4 PT Clinic Outreach', status: 'active', type: 'email', leads: 245, conversions: 18, aiScore: 87, budget: 5000, spent: 3200 },
  { id: '2', name: 'Pain-Free Living Webinar', status: 'active', type: 'event', leads: 156, conversions: 42, aiScore: 92, budget: 2000, spent: 1800 },
  { id: '3', name: 'Holiday Wellness Promo', status: 'paused', type: 'email', leads: 89, conversions: 7, aiScore: 68, budget: 1500, spent: 750 },
  { id: '4', name: 'New Patient Welcome', status: 'active', type: 'nurture', leads: 312, conversions: 56, aiScore: 94, budget: 0, spent: 0 },
  { id: '5', name: 'Reactivation - 90 Day', status: 'completed', type: 'email', leads: 178, conversions: 23, aiScore: 81, budget: 1000, spent: 1000 },
];

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showGeneralAi, setShowGeneralAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<'demo' | 'hubspot'>('demo');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const token = hubSpotService.getToken();
    if (token) {
      const realData = await hubSpotService.fetchCampaigns();
      if (realData.length > 0) {
        setCampaigns(realData);
        setSource('hubspot');
      } else {
        setCampaigns(getMockCampaigns());
        setSource('demo');
      }
    } else {
      setCampaigns(getMockCampaigns());
      setSource('demo');
    }
    setIsLoading(false);
  };

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'paused': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'completed': return 'bg-slate-50 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return Megaphone;
      case 'event': return Calendar;
      case 'nurture': return Users;
      default: return Target;
    }
  };

  // Calculate totals
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + (c.spent || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
              Campaigns
            </h1>
            {source === 'hubspot' && (
              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25">
                Live Data
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">Marketing campaigns and performance tracking.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={`${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowGeneralAi(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Sparkles size={16} />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Campaigns', value: activeCampaigns, icon: Target, color: 'from-indigo-500 to-purple-500' },
          { label: 'Total Leads', value: totalLeads.toLocaleString(), icon: Users, color: 'from-emerald-500 to-teal-500' },
          { label: 'Conversions', value: totalConversions, icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
          { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}`, icon: DollarSign, color: 'from-pink-500 to-rose-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.color}`}>
                <stat.icon size={18} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign) => {
          const TypeIcon = getTypeIcon(campaign.type);
          const conversionRate = campaign.leads > 0 ? ((campaign.conversions / campaign.leads) * 100).toFixed(1) : '0';
          
          return (
            <div 
              key={campaign.id} 
              className="group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
            >
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
              
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl shadow-lg shadow-pink-500/25">
                    <TypeIcon className="w-5 h-5 text-white" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border capitalize ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                
                {/* Title & Type */}
                <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-900 transition-colors mb-2">
                  {campaign.name}
                </h3>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-6 capitalize">
                  <Megaphone size={14} className="text-slate-400" />
                  {campaign.type} Campaign
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Leads</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{campaign.leads}</p>
                  </div>
                  <div className="text-center border-x border-slate-200">
                    <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Conv.</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{campaign.conversions}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Rate</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <p className="text-lg font-bold text-slate-900">{conversionRate}%</p>
                    </div>
                  </div>
                </div>

                {/* AI Score */}
                <div className="mt-4 flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={14} className="text-indigo-600" />
                    <span className="text-xs font-medium text-indigo-700">AI Score</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    campaign.aiScore >= 85 ? 'text-emerald-600' : 
                    campaign.aiScore >= 70 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {campaign.aiScore}/100
                  </span>
                </div>

                {/* Action Button */}
                <button 
                  onClick={() => setSelectedCampaign(campaign)}
                  className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-700 font-semibold text-sm hover:from-indigo-100 hover:to-purple-100 transition-all flex items-center justify-center gap-2 group/btn"
                >
                  <Sparkles size={16} />
                  Optimize with AI
                  <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AiModal 
        isOpen={!!selectedCampaign} 
        onClose={() => setSelectedCampaign(null)} 
        contextType="workflow"
        contextId={selectedCampaign?.id}
        contextName={selectedCampaign?.name}
        initialPrompt={selectedCampaign ? `Analyze the "${selectedCampaign.name}" ${selectedCampaign.type} campaign. It has ${selectedCampaign.leads} leads, ${selectedCampaign.conversions} conversions (${((selectedCampaign.conversions / selectedCampaign.leads) * 100).toFixed(1)}% rate), and an AI score of ${selectedCampaign.aiScore}/100. Suggest optimizations for higher conversion rates and ROI.` : ''}
      />

      <AiModal 
        isOpen={showGeneralAi} 
        onClose={() => setShowGeneralAi(false)} 
        contextType="workflow"
        contextName="New Campaign"
        initialPrompt="Design a new marketing campaign for a PT clinic. Include: target audience, messaging strategy, recommended channels (email, ads, events), content calendar, and KPIs to track. Focus on patient acquisition and reactivation."
      />
    </div>
  );
};

export default Campaigns;
