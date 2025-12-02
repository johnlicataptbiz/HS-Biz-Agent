import React, { useEffect, useState } from 'react';
import { LayoutDashboard, GitFork, Mail, Database, Settings, BrainCircuit, Bot, Hammer, Zap, ChevronRight } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onSettingsClick }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = hubSpotService.getToken();
    setIsConnected(!!token);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, description: 'Portal health' },
    { id: 'copilot', label: 'Co-Pilot', icon: Bot, description: 'AI assistant', badge: 'AI' },
    { id: 'workflows', label: 'Workflows', icon: GitFork, description: 'Automations' },
    { id: 'sequences', label: 'Sequences', icon: Mail, description: 'Sales outreach' },
    { id: 'datamodel', label: 'Data Model', icon: Database, description: 'CRM schema' },
    { id: 'breezetools', label: 'Breeze Tools', icon: Hammer, description: 'Custom actions', badge: 'Beta' },
  ];

  return (
    <div className="w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* Logo Section */}
      <div className="relative p-6 flex items-center gap-4">
        <div className="relative">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
            <Zap className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            AI Optimizer
          </span>
          <p className="text-xs text-slate-500">HubSpot RevOps</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto scrollbar-hide">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">
          Navigation
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`group relative w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
              activeTab === item.id
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {/* Active indicator */}
            {activeTab === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-full shadow-lg shadow-white/50" />
            )}
            
            <div className={`p-2 rounded-lg transition-colors ${
              activeTab === item.id 
                ? 'bg-white/20' 
                : 'bg-slate-800/50 group-hover:bg-slate-700/50'
            }`}>
              <item.icon size={16} />
            </div>
            
            <div className="flex-1 text-left">
              <span className="block">{item.label}</span>
              <span className={`text-[10px] ${activeTab === item.id ? 'text-indigo-200' : 'text-slate-500'}`}>
                {item.description}
              </span>
            </div>
            
            {item.badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                item.badge === 'AI' 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {item.badge}
              </span>
            )}
            
            {activeTab === item.id && (
              <ChevronRight size={14} className="text-white/50" />
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="relative p-4 space-y-3">
        {/* Connection Status Card */}
        <div className={`rounded-xl p-4 border backdrop-blur-sm ${
          isConnected 
            ? 'bg-emerald-500/10 border-emerald-500/20' 
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Portal Status</p>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          </div>
          <p className={`text-sm font-semibold ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isConnected ? '● Connected' : '○ Demo Mode'}
          </p>
          {!isConnected && (
            <p className="text-[10px] text-slate-500 mt-1">Connect to see live data</p>
          )}
        </div>
        
        {/* Settings Button */}
        <button 
          onClick={onSettingsClick}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white cursor-pointer transition-all duration-200 rounded-xl hover:bg-white/5 group"
        >
          <div className="p-2 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors">
            <Settings size={16} />
          </div>
          <span className="text-sm font-medium">Settings</span>
          <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;