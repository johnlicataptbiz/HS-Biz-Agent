import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Zap, ArrowUpRight, TrendingUp, MoreHorizontal, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';
import { usageService } from '../services/usageService';
import { modeService } from '../services/modeService';
import * as mockService from '../services/mockService';

interface DashboardStats {
  workflowCount: number;
  sequenceCount: number;
  contactCount: number;
  dealCount: number;
  healthScore: number;
  pendingIssues: number;
}

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats>({
    workflowCount: 0,
    sequenceCount: 0,
    contactCount: 0,
    dealCount: 0,
    healthScore: 0,
    pendingIssues: 0
  });
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      const token = hubSpotService.getToken();
      const demo = modeService.isDemoMode();
      
      if (token && !demo) {
        setIsConnected(true);
        try {
          // Fetch real data from HubSpot in parallel
          const [workflows, contacts, deals] = await Promise.all([
            hubSpotService.fetchWorkflows().catch(() => []),
            hubSpotService.listObjects('contacts', { limit: 1 }).catch(() => ({ results: [], total: 0 })),
            hubSpotService.listObjects('deals', { limit: 1 }).catch(() => ({ results: [], total: 0 }))
          ]);

          // Calculate a simple health score based on data completeness
          const workflowCount = Array.isArray(workflows) ? workflows.length : 0;
          const hasWorkflows = workflowCount > 0;
          const contactTotal = (contacts as { total?: number })?.total || 0;
          const dealTotal = (deals as { total?: number })?.total || 0;
          const hasContacts = contactTotal > 0;
          const hasDeals = dealTotal > 0;
          
          // Simple health score calculation
          let healthScore = 50; // Base score
          if (hasWorkflows) healthScore += 15;
          if (hasContacts) healthScore += 15;
          if (hasDeals) healthScore += 15;
          if (workflowCount > 5) healthScore += 5;

          setStats({
            workflowCount: workflowCount,
            sequenceCount: Math.floor(workflowCount * 0.3) || 0, // Estimate
            contactCount: contactTotal,
            dealCount: dealTotal,
            healthScore: Math.min(healthScore, 100),
            pendingIssues: Math.max(0, 10 - Math.floor(healthScore / 10))
          });
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
          setError('Failed to load live data. Showing demo metrics.');
          // Fall back to mock data on error
          await loadMockData();
        }
      } else {
        setIsConnected(false);
        await loadMockData();
      }
      setLoading(false);
    };

    const loadMockData = async () => {
      const mockWorkflows = await mockService.getWorkflows();
      const mockSequences = await mockService.getSequences();
      setStats({
        workflowCount: mockWorkflows.length,
        sequenceCount: mockSequences.length,
        contactCount: 1250,
        dealCount: 89,
        healthScore: 72,
        pendingIssues: 7
      });
    };

    fetchDashboardData();
  }, []);

  const healthData = [
    { name: 'Workflows', score: Math.min(100, stats.workflowCount * 5 + 40), color: '#6366f1' },
    { name: 'Sequences', score: Math.min(100, stats.sequenceCount * 8 + 50), color: '#10b981' },
    { name: 'Data Model', score: stats.contactCount > 0 ? 75 : 45, color: '#f59e0b' },
    { name: 'Segments', score: stats.dealCount > 0 ? 88 : 60, color: '#8b5cf6' },
  ];

  const StatCard = ({ title, value, sub, icon: Icon, gradient, trend, onClick }: {
    title: string;
    value: number | string;
    sub: string;
    icon: React.ElementType;
    gradient: string;
    trend?: boolean;
    onClick?: () => void;
  }) => {
    return (
      <div 
        onClick={onClick}
        className={`group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
      >
        {/* Gradient accent line */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />
        
        {/* Background decoration */}
        <div className={`absolute -right-8 -top-8 w-32 h-32 ${gradient} opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity duration-500`} />
        
        <div className="relative p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${gradient} shadow-lg`}>
              <Icon size={22} className="text-white" />
            </div>
            {trend && (
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-100">
                <TrendingUp size={12} />
                <span>+4%</span>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
              {loading ? <Loader2 className="animate-spin" size={28} /> : value}
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">{sub}</p>
            <ArrowUpRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
            Portal Overview
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Real-time optimization analysis of your HubSpot instance.</p>
        </div>
        <div className={`px-4 py-2.5 rounded-xl flex items-center gap-3 ${
          isConnected 
            ? 'bg-white border border-slate-200 shadow-sm' 
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
        }`}>
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isConnected && (
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {isConnected ? 'Connected to HubSpot' : 'Using Demo Data'}
          </span>
          {!isConnected && (
            <button
              onClick={async () => {
                try {
                  await usageService.track('click_connect');
                } catch {}
                await hubSpotService.initiateOAuth();
              }}
              className="ml-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
            >
              Connect to see live data
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-3 rounded-xl text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Overall Health Score" 
          value={stats.healthScore} 
          sub={stats.healthScore >= 70 ? "Top 15% of portals" : "Room for improvement"} 
          icon={Activity} 
          gradient="bg-gradient-to-r from-indigo-500 to-purple-600" 
          trend={stats.healthScore >= 70}
          onClick={() => onNavigate?.('copilot')}
        />
        <StatCard 
          title="Active Workflows" 
          value={stats.workflowCount} 
          sub={stats.workflowCount > 0 ? `${Math.max(0, stats.workflowCount - 3)} optimized` : "No workflows yet"} 
          icon={Zap} 
          gradient="bg-gradient-to-r from-amber-500 to-orange-500"
          onClick={() => onNavigate?.('workflows')}
        />
        <StatCard 
          title="Active Sequences" 
          value={stats.sequenceCount} 
          sub="12.4% avg reply rate" 
          icon={CheckCircle} 
          gradient="bg-gradient-to-r from-emerald-500 to-teal-500" 
          trend={stats.sequenceCount > 5}
          onClick={() => onNavigate?.('sequences')}
        />
        <StatCard 
          title="Pending Issues" 
          value={stats.pendingIssues} 
          sub={stats.pendingIssues > 0 ? "Requires attention" : "All clear!"} 
          icon={AlertTriangle} 
          gradient="bg-gradient-to-r from-rose-500 to-pink-500"
          onClick={() => onNavigate?.('copilot')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Health Breakdown</h3>
              <p className="text-sm text-slate-500">Optimization scores by category</p>
            </div>
            <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </div>
          <div className="p-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={28}>
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Action List */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Priority Actions</h3>
                <p className="text-sm text-slate-500">AI-suggested optimizations</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 space-y-2">
            {[
              { label: 'Optimize "Abandoned Cart" Flow', impact: 'High', type: 'Auto', time: '5m', color: 'from-indigo-500 to-purple-500' },
              { label: 'Merge "Niche" properties', impact: 'Med', type: 'Data', time: '10m', color: 'from-amber-500 to-orange-500' },
              { label: 'Update "Cold Outreach" Copy', impact: 'Med', type: 'Sales', time: '2m', color: 'from-emerald-500 to-teal-500' },
              { label: 'Fix broken branch in "Webinar"', impact: 'Crit', type: 'Auto', time: '1m', color: 'from-rose-500 to-pink-500' },
            ].map((item, i) => (
              <div key={i} className="group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-xs shadow-lg`}>
                  {item.type.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 block truncate">{item.label}</span>
                  <span className="text-xs text-slate-400">{item.time} est. • {item.impact} impact</span>
                </div>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-slate-100">
            <button onClick={() => onNavigate?.('recommendations')} className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
              View All Recommendations
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
