import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';

const Workflows = lazy(() => import('./pages/Workflows'));
const Sequences = lazy(() => import('./pages/Sequences'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const ContactsExplorer = lazy(() => import('./pages/ContactsExplorer'));
const DataModel = lazy(() => import('./pages/DataModel'));
const BreezeTools = lazy(() => import('./pages/BreezeTools'));
const CoPilot = lazy(() => import('./pages/CoPilot'));
const Reports = lazy(() => import('./pages/Reports'));
const JourneyMap = lazy(() => import('./pages/JourneyMap'));
const Organization = lazy(() => import('./pages/Organization'));
const RevOps = lazy(() => import('./pages/RevOps'));
const DatabaseExplorer = lazy(() => import('./pages/DatabaseExplorer'));
const DataQuality = lazy(() => import('./pages/DataQuality'));
const Attribution = lazy(() => import('./pages/Attribution'));
const PipelineVelocity = lazy(() => import('./pages/PipelineVelocity'));

const WinLoss = lazy(() => import('./pages/WinLoss'));
const AssetIntelligence = lazy(() => import('./pages/AssetIntelligence'));
const Segments = lazy(() => import('./pages/Segments'));
const AiChat = lazy(() => import('./components/AiChat'));
const AiModal = lazy(() => import('./components/AiModal'));
import { ChatResponse } from './types';
import { hubSpotService } from './services/hubspotService';
import { User, Bell, Search } from 'lucide-react';
import AppTour from './components/AppTour';
import SettingsModal from './components/SettingsModal';


interface GlobalModalState {
  isOpen: boolean;
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
  initialPrompt: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('active_tab') || 'dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  // CRITICAL: Handle OAuth Popup Early (before any app logic)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const savedState = localStorage.getItem('hubspot_oauth_state');
    // If we're in a popup window with an OAuth code, close immediately
    if (window.opener && code && state && savedState && state === savedState) {
      console.log('🪟 OAuth popup detected - sending code to opener and closing...');
      window.opener.postMessage({ type: 'HUBSPOT_OAUTH_CODE', code, state }, window.location.origin);
      setTimeout(() => {
        window.close();
      }, 100);
      return; // Stop the rest of the app from loading
    }
  }, []);

  // Example: How to use improved initiateOAuth (call this from your login/connect button)
  // const handleConnect = () => {
  //   hubSpotService.initiateOAuth(false, setOauthError);
  // };

  useEffect(() => {
    console.log("🚀 HS-Biz-Agent: Sprint 6 RevOps - Version 1.0.1 Loaded");
    localStorage.setItem('active_tab', activeTab);
    const url = new URL(window.location.href);
    if (url.pathname !== `/${activeTab}` && activeTab !== 'dashboard') {
        window.history.pushState({}, '', `/${activeTab}${url.search}`);
    }
  }, [activeTab]);

  useEffect(() => {
    // Handle deep linking on initial load
    const path = window.location.pathname.substring(1);
    const validTabs = ['dashboard', 'reports', 'copilot', 'workflows', 'sequences', 'campaigns', 'contacts', 'datamodel', 'breezetools', 'journey', 'organization', 'revops', 'database', 'data-quality', 'attribution', 'segments', 'assets', 'win-loss', 'velocity'];
    if (path && validTabs.includes(path)) {
        setActiveTab(path);
    }
    
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
      case 'contacts': return <ContactsExplorer />;
      case 'datamodel': return <DataModel />;
      case 'breezetools': return <BreezeTools />;
      case 'journey': return <JourneyMap />;
      case 'organization': return <Organization />;
      case 'revops': return <RevOps />;
      case 'database': return <DatabaseExplorer />;
      case 'data-quality': return <DataQuality />;
      case 'attribution': return <Attribution />;
      case 'segments': return <Segments onNavigate={setActiveTab} />;
      case 'assets': return <AssetIntelligence onNavigate={setActiveTab} />;
      case 'win-loss': return <WinLoss />;
      case 'velocity': return <PipelineVelocity />;
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
        return (
          <div className="flex h-screen bg-black">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onSettingsClick={() => setIsSettingsOpen(true)} onTourClick={() => setIsTourOpen(true)} />
            <main className="flex-1 overflow-y-auto">
              {oauthError && (
                <div className="bg-red-700 text-white px-4 py-2 text-center font-bold z-50">
                  OAuth Error: {oauthError}
                </div>
              )}
              {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
              {activeTab === 'workflows' && <Suspense fallback={<div>Loading...</div>}><Workflows /></Suspense>}
              {activeTab === 'sequences' && <Suspense fallback={<div>Loading...</div>}><Sequences /></Suspense>}
              {activeTab === 'campaigns' && <Suspense fallback={<div>Loading...</div>}><Campaigns /></Suspense>}
              {activeTab === 'contacts' && <Suspense fallback={<div>Loading...</div>}><ContactsExplorer /></Suspense>}
              {activeTab === 'datamodel' && <Suspense fallback={<div>Loading...</div>}><DataModel /></Suspense>}
              {activeTab === 'breezetools' && <Suspense fallback={<div>Loading...</div>}><BreezeTools /></Suspense>}
              {activeTab === 'copilot' && <Suspense fallback={<div>Loading...</div>}><CoPilot /></Suspense>}
              {activeTab === 'reports' && <Suspense fallback={<div>Loading...</div>}><Reports /></Suspense>}
              {activeTab === 'journey' && <Suspense fallback={<div>Loading...</div>}><JourneyMap /></Suspense>}
              {activeTab === 'organization' && <Suspense fallback={<div>Loading...</div>}><Organization /></Suspense>}
              {activeTab === 'revops' && <Suspense fallback={<div>Loading...</div>}><RevOps /></Suspense>}
              {activeTab === 'database' && <Suspense fallback={<div>Loading...</div>}><DatabaseExplorer /></Suspense>}
              {activeTab === 'data-quality' && <Suspense fallback={<div>Loading...</div>}><DataQuality /></Suspense>}
              {activeTab === 'attribution' && <Suspense fallback={<div>Loading...</div>}><Attribution /></Suspense>}
              {activeTab === 'segments' && <Suspense fallback={<div>Loading...</div>}><Segments /></Suspense>}
              {activeTab === 'assets' && <Suspense fallback={<div>Loading...</div>}><AssetIntelligence /></Suspense>}
              {activeTab === 'win-loss' && <Suspense fallback={<div>Loading...</div>}><WinLoss /></Suspense>}
              {activeTab === 'velocity' && <Suspense fallback={<div>Loading...</div>}><PipelineVelocity /></Suspense>}
              <AiChat onTriggerAction={handleAiAction} />
              <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
              <AppTour isOpen={isTourOpen} onClose={handleTourDismiss} />
            </main>
          </div>
        );
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
