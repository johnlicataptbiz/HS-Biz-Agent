import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import Sequences from './pages/Sequences';
import Campaigns from './pages/Campaigns';
import DataModel from './pages/DataModel';
import BreezeTools from './pages/BreezeTools';
import CoPilot from './pages/CoPilot';
import AuthPage from './pages/AuthPage';
import AiChat from './components/AiChat';
import AiModal from './components/AiModal';
import SettingsModal from './components/SettingsModalSimple';
import Recommendations from './pages/Recommendations';
import { ChatResponse } from './types';
import { authService } from './services/authService';
import { Loader2 } from 'lucide-react';

interface GlobalModalState {
  isOpen: boolean;
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
  initialPrompt: string;
}

// Main app content (shown when logged in)
const MainApp: React.FC = () => {
  const { user, hasHubSpotConnection, portalId, logout, refreshAuth } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [globalModal, setGlobalModal] = useState<GlobalModalState>({
    isOpen: false,
    contextType: 'workflow',
    initialPrompt: ''
  });

  // Handle OAuth callback (HubSpot redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
      // Exchange code for HubSpot token via authenticated endpoint
      (async () => {
        try {
          const response = await authService.apiRequest('/api/oauth/token', {
            method: 'POST',
            body: JSON.stringify({ code, redirect_uri: window.location.origin })
          });
          
          if (response.ok) {
            // Clear the code from URL and refresh auth state
            window.history.replaceState({}, '', window.location.pathname);
            await refreshAuth();
          } else {
            const error = await response.json();
            console.error('OAuth Error:', error);
            alert('Failed to connect HubSpot. Please try again.');
          }
        } catch (error) {
          console.error('OAuth Error:', error);
        }
      })();
    }
  }, [refreshAuth]);

  const handleAiAction = (action: NonNullable<ChatResponse['action']>) => {
    if (action.type === 'OPEN_MODAL') {
      setGlobalModal({
        isOpen: true,
        contextType: action.payload.contextType,
        initialPrompt: action.payload.initialPrompt
      });
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />;
      case 'copilot': return <CoPilot />;
      case 'workflows': return <Workflows />;
      case 'sequences': return <Sequences />;
      case 'campaigns': return <Campaigns />;
      case 'datamodel': return <DataModel />;
      case 'breezetools': return <BreezeTools />;
      case 'recommendations': return <Recommendations />;
      default: return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-indigo-50/30 flex overflow-x-hidden">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-72 min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-30 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
            <span className="font-semibold text-slate-800 capitalize">
              {activeTab === 'datamodel' ? 'Data Model' : activeTab === 'breezetools' ? 'Breeze Tools' : activeTab === 'copilot' ? 'Co-Pilot' : activeTab}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 text-xs text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full ${hasHubSpotConnection ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {hasHubSpotConnection ? `Portal ${portalId || 'Connected'}` : 'HubSpot not connected'}
            </div>
            
            {/* User Menu */}
            <div className="relative group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-indigo-500/25 cursor-pointer">
                {getInitials()}
              </div>
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-8">
          {renderContent()}
        </main>
      </div>

      <AiChat onTriggerAction={handleAiAction} />
      
      <AiModal 
        isOpen={globalModal.isOpen}
        onClose={() => setGlobalModal(prev => ({ ...prev, isOpen: false }))}
        contextType={globalModal.contextType}
        initialPrompt={globalModal.initialPrompt}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

// App wrapper with auth
const AppContent: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AuthPage />;
  }

  return <MainApp />;
};

// Root App with AuthProvider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
