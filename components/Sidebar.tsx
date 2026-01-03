import React, { useEffect, useState } from 'react';
import { LayoutDashboard as DashboardIcon, GitFork as WorkflowsIcon, Mail as SequencesIcon, Database as DataIcon, Bot as CopilotIcon, Hammer as ToolsIcon, Settings as SettingsIcon, BrainCircuit as AppIcon, Megaphone as CampaignsIcon, Users as ContactsIcon, BarChart3 as ReportsIcon, Map as JourneyIcon, Table as TableIcon, ShieldCheck, Zap, TrendingUp,  Search,
  Layers, FileText, Trophy
} from 'lucide-react';
import SyncStatus from './SyncStatus';
import { hubSpotService } from '../services/hubspotService';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsClick?: () => void;
  onTourClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onSettingsClick, onTourClick }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
        const token = hubSpotService.getToken();
        setIsConnected(!!token);
    };
    checkAuth();
    window.addEventListener('hubspot_connection_changed', checkAuth);
    return () => window.removeEventListener('hubspot_connection_changed', checkAuth);
  }, []);

  const navGroups = [
    {
      title: 'Main',
      items: [
        { id: 'contacts', label: 'Directory', icon: DashboardIcon },
      ]
    },
    {
      title: 'Business Ops',
      items: [
        { id: 'contacts', label: 'Directory', icon: ContactsIcon },
        { id: 'assets', label: 'Content Performance', icon: FileText },
        { id: 'win-loss', label: 'Win/Loss Trends', icon: Trophy },
        { id: 'velocity', label: 'Deal Pace', icon: Zap },
        { id: 'reports', label: 'Revenue Reports', icon: ReportsIcon },
        { id: 'attribution', label: 'Marketing Impact', icon: TrendingUp },
        { id: 'workflows', label: 'Workflows', icon: WorkflowsIcon },
      ]
    },
    {
      title: 'Data Health',
      items: [
        { id: 'data-model', label: 'Data Cleaner', icon: ShieldCheck },
        { id: 'data-quality', label: 'Data Quality', icon: ShieldCheck },
        { id: 'segments', label: 'Customer Groups', icon: Layers },
        { id: 'journey', label: 'Customer Journey', icon: JourneyIcon },
        { id: 'lead-scoring', label: 'Lead Scoring', icon: TrendingUp },
      ]
    },
    {
      title: 'Strategy',
      items: [
        { id: 'copilot', label: 'AI Assistant', icon: CopilotIcon },
        { id: 'strategic-audit', label: 'System Check', icon: Zap },
      ]
    }
  ];

  return (
    <div id="sidebar-container" className="w-72 bg-white text-slate-900 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-200 z-50 shadow-xl">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => onTabChange('dashboard')}>
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/15 blur-2xl rounded-full group-hover:bg-indigo-500/25 transition-all duration-500"></div>
            <svg width="240" height="52" viewBox="0 0 240 52" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 transition-transform duration-500 group-hover:scale-105 text-slate-900">
              {/* Outer Square */}
              <rect x="2" y="4" width="44" height="44" rx="8" stroke="currentColor" strokeWidth="2" />
              {/* Inner Square/Diamond container */}
              <rect x="10" y="12" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.25" />
              {/* Central Diamond */}
              <path d="M24 18L32 26L24 34L16 26L24 18Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              
              {/* Divider Line */}
              <line x1="56" y1="10" x2="56" y2="42" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
              
              {/* Branding Text - Core UI */}
              <text x="68" y="27" fill="currentColor" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '24px', letterSpacing: '-0.03em'}}>Core UI</text>
              <text x="148" y="26" fill="currentColor" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '8px', opacity: 0.6, letterSpacing: '0.05em'}}>by PT Biz</text>
              
              {/* Strategic Sub-text - Integrated */}
              <text x="69" y="42" fill="currentColor" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '6.5px', opacity: 0.45, letterSpacing: '0.15em', textTransform: 'uppercase'}}>Strategic Operations Platform</text>
            </svg>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent space-y-8">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="px-4 mb-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{group.title}</p>
            </div>
            {group.items.map((item) => (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onTabChange(item.id)}
                aria-label={`Navigate to ${item.label}`}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                  activeTab === item.id
                    ? 'bg-indigo-600/10 text-slate-900 border border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.1)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${
                  activeTab === item.id ? 'bg-indigo-500 text-slate-900' : 'bg-slate-100 group-hover:bg-slate-200 text-slate-600'
                }`}>
                    <item.icon size={16} />
                </div>
                <span className="font-bold text-xs uppercase tracking-tight">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-6">
        <div className="bg-slate-100 rounded-3xl p-5 border border-slate-200 space-y-4">
            <div id="connection-status" className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Portal Connection</p>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 animate-pulse'}`}></div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-200 overflow-hidden">
                    <img src="https://ui-avatars.com/api/?name=HS&background=4f46e5&color=fff" alt="HubSpot" className="w-full h-full object-cover" />
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">{isConnected ? 'HubSpot Active' : 'Demo Instance'}</p>
        <p className="text-[10px] text-slate-500 font-medium truncate">{isConnected ? 'Pro Enterprise Plan' : 'Simulation Mode'}</p>
                </div>
            </div>
        </div>
        
      <div className="p-6 border-t border-slate-200 space-y-4">
        <SyncStatus />
        <div className="flex gap-2">
           <button 
             className="flex-1 py-3 px-4 glass-button rounded-2xl flex items-center justify-center gap-2 group transition-all hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200" 
             onClick={onSettingsClick} 
             title="Settings"
           >
              <SettingsIcon size={16} className="group-hover:rotate-90 transition-transform duration-500" />
           </button>
           <button 
             className="flex-1 py-3 px-4 glass-button rounded-2xl flex items-center justify-center gap-2 group transition-all hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200" 
             onClick={onTourClick} 
             title="Replay Tour"
           >
              <span className="text-[10px] font-black uppercase tracking-widest">Guide</span>
           </button>
        </div>
        <div className="text-center">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Operator Console v2.5</p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Sidebar;
