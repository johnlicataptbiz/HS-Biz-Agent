import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, LogIn, LogOut, Sparkles, Key, ExternalLink } from 'lucide-react';
import { useAuth } from './AuthContext';
import { hubSpotService } from '../services/hubspotService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { hasHubSpotConnection, portalId, refreshAuth } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPatInput, setShowPatInput] = useState(false);
  const [patToken, setPatToken] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen, hasHubSpotConnection]);

  const checkConnection = async () => {
    if (hasHubSpotConnection) {
      setConnectionStatus('checking');
      try {
        const result = await hubSpotService.validateConnection();
        setConnectionStatus(result.success ? 'success' : 'error');
        if (!result.success) {
          setErrorMessage(result.error || "Connection invalid");
        }
      } catch {
        setConnectionStatus('error');
        setErrorMessage("Failed to validate connection");
      }
    } else {
      setConnectionStatus('idle');
    }
  };

  const handleConnect = async () => {
    setErrorMessage('');
    setConnectionStatus('checking');
    
    try {
      await hubSpotService.initiateOAuth();
      // OAuth will redirect, so we don't need to do anything else here
    } catch (e: unknown) {
      const error = e as Error;
      setConnectionStatus('error');
      setErrorMessage(error.message || "Failed to start connection");
    }
  };

  const handleDisconnect = async () => {
    // TODO: Add server endpoint to disconnect HubSpot
    // For now, just refresh auth state
    await refreshAuth();
    setConnectionStatus('idle');
    setErrorMessage('');
    setShowPatInput(false);
    setPatToken('');
  };

  const handlePatConnect = async () => {
    if (!patToken.trim()) {
      setErrorMessage('Please enter a Private App Token');
      return;
    }
    
    if (!patToken.trim().startsWith('pat-')) {
      setErrorMessage('Token must start with "pat-"');
      return;
    }
    
    setConnectionStatus('checking');
    setErrorMessage('');
    
    try {
      // Exchange PAT token via server (now stores in DB)
      await hubSpotService.exchangeCodeForToken(patToken.trim());
      
      // Refresh auth to get updated hasHubSpotConnection
      await refreshAuth();
      
      // Verify the connection works
      const result = await hubSpotService.validateConnection();
      if (result.success) {
        setConnectionStatus('success');
        setShowPatInput(false);
        setPatToken('');
      } else {
        setConnectionStatus('error');
        setErrorMessage(result.error || 'Invalid token');
      }
    } catch (e: unknown) {
      setConnectionStatus('error');
      setErrorMessage((e as Error).message || 'Failed to connect');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">HubSpot Connection</h3>
                <p className="text-white/70 text-sm">Connect your HubSpot portal</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {connectionStatus === 'success' || (hasHubSpotConnection && connectionStatus !== 'error') ? (
            /* Connected State */
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Connected!</h4>
                <p className="text-slate-500 text-sm mt-1">
                  Your HubSpot portal is connected and ready.
                </p>
                {portalId && (
                  <p className="text-xs text-slate-400 mt-2">
                    Portal ID: {portalId}
                  </p>
                )}
              </div>
              
              <a
                href={`https://app.hubspot.com/home/${portalId || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
              >
                Open HubSpot Portal
                <ExternalLink size={14} />
              </a>
              
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleDisconnect}
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <LogOut size={18} />
                  Disconnect
                </button>
              </div>
            </div>
          ) : connectionStatus === 'checking' ? (
            /* Loading State */
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
              <p className="text-slate-500 mt-4">Connecting to HubSpot...</p>
            </div>
          ) : (
            /* Not Connected State */
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                  <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984 2.21 2.21 0 00-4.42 0c0 .873.515 1.622 1.255 1.977v2.853a5.037 5.037 0 00-2.881 1.678l-6.63-4.144a2.553 2.553 0 00.072-.588 2.558 2.558 0 00-5.116 0 2.558 2.558 0 002.558 2.558c.511 0 .985-.152 1.385-.41l6.392 3.994a5.075 5.075 0 00-.094.954c0 .343.035.677.1 1l-2.437.987a2.14 2.14 0 00-1.945-1.25 2.145 2.145 0 000 4.29 2.145 2.145 0 002.138-2.012l2.61-1.057a5.08 5.08 0 003.503 2.49v2.676a2.198 2.198 0 00-1.267 1.984 2.21 2.21 0 004.42 0 2.2 2.2 0 00-1.255-1.984v-2.677a5.087 5.087 0 10-2.59-9.4z"/>
                </svg>
              </div>
              
              <div>
                <h4 className="text-xl font-semibold text-slate-900">Connect Your HubSpot</h4>
                <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                  Securely connect your HubSpot portal to analyze and optimize your marketing automation.
                </p>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                  <AlertCircle size={16} />
                  {errorMessage}
                </div>
              )}

              {showPatInput ? (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={patToken}
                    onChange={(e) => setPatToken(e.target.value)}
                    placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowPatInput(false); setPatToken(''); setErrorMessage(''); }}
                      className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePatConnect}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleConnect}
                    className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    <LogIn size={20} />
                    Connect with OAuth
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white text-slate-400">or</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowPatInput(true)}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Key size={18} />
                    Use Private App Token
                  </button>
                </>
              )}

              <p className="text-xs text-slate-400">
                OAuth redirects to HubSpot for authorization. Private App Tokens can be created in HubSpot Settings → Integrations → Private Apps.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
