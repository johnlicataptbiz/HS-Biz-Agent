import React, { useEffect, useState } from 'react';
import { LayoutDashboard as DashboardIcon, GitFork as WorkflowsIcon, Mail as SequencesIcon, Database as DataIcon, Bot as CopilotIcon, Hammer as ToolsIcon, Settings as SettingsIcon, BrainCircuit as AppIcon } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onSettingsClick }) => {
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

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: DashboardIcon },
    { id: 'copilot', label: 'Co-Pilot', icon: CopilotIcon },
    { id: 'workflows', label: 'Workflows', icon: WorkflowsIcon },
    { id: 'sequences', label: 'Sequences', icon: SequencesIcon },
    { id: 'datamodel', label: 'Data Model', icon: DataIcon },
    { id: 'breezetools', label: 'Breeze Tools', icon: ToolsIcon },
  ];

  return (
    <div className="w-72 bg-[#0a0f1d] text-white flex flex-col h-screen fixed left-0 top-0 border-r border-white/5 z-50 shadow-2xl">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onTabChange('dashboard')}>
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full group-hover:bg-indigo-500/40 transition-all duration-500"></div>
            <img src="/logo.png" alt="AI Optimizer" className="w-12 h-12 object-contain relative z-10 transition-transform duration-500 group-hover:scale-110" />
          </div>
          <div className="relative z-10">
            <span className="font-extrabold text-xl tracking-tighter block leading-none gradient-text uppercase italic">AI Optimizer</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1.5 block">Premium Heuristics</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-3 mt-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="px-4 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Menu</p>
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            id={`nav-link-${item.id}`}
            onClick={() => onTabChange(item.id)}
            aria-label={`Navigate to ${item.label}`}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
              activeTab === item.id
                ? 'bg-indigo-600/10 text-white border border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.1)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${
              activeTab === item.id ? 'bg-indigo-500 text-white' : 'bg-slate-800/50 group-hover:bg-slate-700'
            }`}>
                <item.icon size={18} />
            </div>
            <span className="font-semibold text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6">
        <div className="bg-white/5 rounded-3xl p-5 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Portal Connection</p>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 animate-pulse'}`}></div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/5 overflow-hidden">
                    <img src="https://ui-avatars.com/api/?name=HS&background=4f46e5&color=fff" alt="HubSpot" className="w-full h-full object-cover" />
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">{isConnected ? 'HubSpot Active' : 'Demo Instance'}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{isConnected ? 'Pro Enterprise Plan' : 'Simulation Mode'}</p>
                </div>
            </div>

            <button 
                id="portal-settings-btn"
                onClick={onSettingsClick}
                aria-label="Open portal settings"
                className="w-full py-2.5 glass-button flex items-center justify-center gap-2 text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all"
            >
                <SettingsIcon size={14} />
                Portal Settings
            </button>
        </div>
        
        <p className="mt-6 text-center text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Powered by Gemini 2.0</p>
      </div>
    </div>
  );
};

export default Sidebar;