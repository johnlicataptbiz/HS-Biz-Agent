import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';

const Workflows = lazy(() => import('./pages/Workflows'));
const Sequences = lazy(() => import('./pages/Sequences'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Contacts = lazy(() => import('./pages/Contacts'));
const DataModel = lazy(() => import('./pages/DataModel'));
const BreezeTools = lazy(() => import('./pages/BreezeTools'));
const CoPilot = lazy(() => import('./pages/CoPilot'));
const Reports = lazy(() => import('./pages/Reports'));
const Pipelines = lazy(() => import('./pages/Pipelines'));

import AiChat from './components/AiChat';
import AiModal from './components/AiModal';
import SettingsModal from './components/SettingsModal';
import { ChatResponse } from './types';
import { hubSpotService } from './services/hubspotService';
import { User, Bell, Search } from 'lucide-react';
import AppTour from './components/AppTour';

interface GlobalModalState {
  isOpen: boolean;
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
  initialPrompt: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('active_tab') || 'dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  
  useEffect(() => {
    localStorage.setItem('active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
      // Check for first-time user tour (Intelligence Engine version)
      const hasSeenTour = localStorage.getItem('has_seen_tour_intel_v2');
      if (!hasSeenTour) {
          // Slight delay to ensure DOM is ready and page-state is stable
          setTimeout(() => setIsTourOpen(true), 1500);
      }
  }, []);

  const handleTourDismiss = () => {
      setIsTourOpen(false);
      localStorage.setItem('has_seen_tour_intel_v2', 'true');
  };
  const [globalModal, setGlobalModal] = useState<GlobalModalState>({
    isOpen: false,
    contextType: 'workflow',
    initialPrompt: ''
  });

  const processedCodesRef = React.useRef<Set<string>>(new Set());

  // Handle OAuth Popup Callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'HUBSPOT_OAUTH_CODE') {
        const { code, state } = event.data;
        
        const savedState = localStorage.getItem('hubspot_oauth_state');
        if (!state || !savedState || state !== savedState) {
          if (import.meta.env.DEV) console.warn('OAuth callback ignored (state mismatch/missing).');
          return;
        }

        if (code && !processedCodesRef.current.has(code)) {
          processedCodesRef.current.add(code);
          try {
            console.log("🧩 App: Received OAuth code message, initiating exchange.");
            await hubSpotService.exchangeCodeForToken(code);
          } catch (error) {
            console.error('OAuth Message Exchange Failed:', error);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Check if we have a code in the current window (direct redirect)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const savedState = localStorage.getItem('hubspot_oauth_state');
    const startedAtRaw = localStorage.getItem('hubspot_oauth_started_at');
    const startedAt = startedAtRaw ? Number(startedAtRaw) : NaN;
    const isFresh = Number.isFinite(startedAt) && Date.now() - startedAt < 60 * 60 * 1000;
    
    if (code && state && savedState && state === savedState && isFresh && !processedCodesRef.current.has(code)) {
      processedCodesRef.current.add(code);
      if (window.opener) {
        // We are a popup, notify parent
        window.opener.postMessage({ type: 'HUBSPOT_OAUTH_CODE', code, state }, window.location.origin);
        try {
          window.close();
        } catch {
          // Ignore
        }
      } else {
        // We are the main window, exchange code directly
        hubSpotService.exchangeCodeForToken(code).then(() => {
          // Clean up URL
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }).catch(err => {
          console.error('Direct OAuth Exchange Failed:', err);
        });
      }
    } else if (import.meta.env.DEV && code) {
      console.warn('OAuth code present but ignored (missing/mismatched state or stale request).');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
      case 'reports': return <Reports />;
      case 'copilot': return <CoPilot />;
      case 'workflows': return <Workflows />;
      case 'sequences': return <Sequences />;
      case 'campaigns': return <Campaigns />;
      case 'contacts': return <Contacts />;
      case 'datamodel': return <DataModel />;
      case 'breezetools': return <BreezeTools />;
      case 'journey': return <Pipelines />;
      default: return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex font-['Outfit']">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onSettingsClick={() => setIsSettingsOpen(true)}
        onTourClick={() => setIsTourOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-72 flex flex-col min-h-screen">
        {/* Top Floating Header */}
        <header className="h-24 sticky top-0 z-40 px-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                <h1 id="active-tab-heading" className="text-sm font-extrabold uppercase tracking-[0.4em] text-slate-400">
                  {activeTab.replace(/([A-Z])/g, ' $1').trim()}
                </h1>
            </div>
            
            <div className="flex items-center gap-6">
              <button 
                id="global-search-btn"
                className="hidden md:flex items-center gap-2 glass-button px-4 py-2 text-slate-400 hover:text-white transition-colors"
                aria-label="Search heuristics"
              >
                <Search size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Search Heuristics...</span>
              </button>
              
              <div className="relative">
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-[#0f172a] z-10"></div>
                <button className="p-2.5 glass-button border-white/5 text-slate-400 hover:text-white transition-colors" title="View Notifications" aria-label="View notifications">
                  <Bell size={18} />
                </button>
              </div>

              <div className="flex items-center gap-3 glass-button px-3 py-1.5 pr-4 border-white/5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-indigo-500/20">
                  <User size={16} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Admin Console</span>
              </div>
            </div>
        </header>

        <main id="main-content" className="p-10 flex-1 overflow-x-hidden" aria-labelledby="active-tab-heading" role="main">
          <Suspense fallback={
            <div className="h-full w-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          }>
            {renderContent()}
          </Suspense>
        </main>

        <footer className="p-10 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em]">Jack Licata Design Co • Modern Intelligence</p>
        </footer>
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

      <AppTour 
        isOpen={isTourOpen}
        onClose={handleTourDismiss}
        onComplete={handleTourDismiss}
        onNavigate={setActiveTab}
      />
    </div>
  );
};

export default App;
