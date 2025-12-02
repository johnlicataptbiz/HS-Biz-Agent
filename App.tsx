import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import Sequences from './pages/Sequences';
import DataModel from './pages/DataModel';
import BreezeTools from './pages/BreezeTools';
import CoPilot from './pages/CoPilot';
import AiChat from './components/AiChat';
import AiModal from './components/AiModal';
import SettingsModal from './components/SettingsModalSimple';
import { ChatResponse } from './types';
import { hubSpotService } from './services/hubspotService';

interface GlobalModalState {
  isOpen: boolean;
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool';
  initialPrompt: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [globalModal, setGlobalModal] = useState<GlobalModalState>({
    isOpen: false,
    contextType: 'workflow',
    initialPrompt: ''
  });

  // Handle OAuth Popup Callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security check: ensure message is from our own window/popup logic if needed
      // For this environment, we just check the type
      if (event.data?.type === 'HUBSPOT_OAUTH_CODE') {
        const { code } = event.data;
        if (code) {
          try {
            await hubSpotService.exchangeCodeForToken(code);
            // Notify the popup (or the app) that auth is done
            // In this flow, we just refresh the UI state by saving token
            window.location.reload(); 
          } catch (error) {
            console.error('OAuth Error:', error);
            alert('Failed to exchange token. Check console.');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Check if we are the popup window itself OR direct redirect
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // If we have an opener (popup mode), send to parent
      if (window.opener) {
        window.opener.postMessage({ type: 'HUBSPOT_OAUTH_CODE', code }, '*');
        window.close();
      } else {
        // Direct redirect mode - handle token exchange here
        (async () => {
          try {
            await hubSpotService.exchangeCodeForToken(code);
            // Clear the code from URL and reload
            window.history.replaceState({}, '', window.location.pathname);
            window.location.reload();
          } catch (error) {
            console.error('OAuth Error:', error);
            alert('Failed to exchange token. Check console.');
          }
        })();
      }
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
      case 'dashboard': return <Dashboard />;
      case 'copilot': return <CoPilot />;
      case 'workflows': return <Workflows />;
      case 'sequences': return <Sequences />;
      case 'datamodel': return <DataModel />;
      case 'breezetools': return <BreezeTools />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-64">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-8 flex items-center justify-between">
            <div className="font-bold text-slate-800 capitalize">
              {activeTab.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                JD
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

export default App;