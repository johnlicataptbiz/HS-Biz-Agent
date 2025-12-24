import React, { useEffect, useState } from 'react';
import { LayoutDashboard, GitFork, Mail, Database, Settings, BrainCircuit, Bot, Hammer } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onSettingsClick }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check connection on mount and when local storage might change (basic check)
    const token = hubSpotService.getToken();
    setIsConnected(!!token);

    // Listener for storage events (if multiple tabs or dynamic updates needed in future)
    // For now, this just runs on render.
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'copilot', label: 'Co-Pilot', icon: Bot },
    { id: 'workflows', label: 'Workflows', icon: GitFork },
    { id: 'sequences', label: 'Sequences', icon: Mail },
    { id: 'datamodel', label: 'Data Model', icon: Database },
    { id: 'breezetools', label: 'Breeze Tools', icon: Hammer },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">AI Optimizer</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium ${
              activeTab === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={onSettingsClick}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white cursor-pointer transition-colors rounded-md hover:bg-slate-800"
        >
          <Settings size={18} />
          <span className="text-sm font-medium">Settings</span>
        </button>
        <div className="mt-4 px-4">
            <div className="bg-slate-800 rounded p-3">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Portal Status</p>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <p className="text-sm font-medium text-slate-200">
                      {isConnected ? 'Connected' : 'Demo Mode'}
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;