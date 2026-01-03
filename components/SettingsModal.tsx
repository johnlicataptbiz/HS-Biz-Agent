import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertCircle, ExternalLink, Shield, Zap, RefreshCw, LogOut, Lock, Globe, ShieldCheck, Copy, Database, Code, Sparkles } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }: SettingsModalProps) => {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedField, setCopiedField] = useState<'token' | 'clientId' | null>(null);

  const isMcpIdent = React.useMemo(() => 
    localStorage.getItem('hubspot_client_id') === '9d7c3c51-862a-4604-9668-cad9bf5aed93'
  , [connectionStatus]);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const checkStatus = async () => {
    if (hubSpotService.getToken()) {
      setConnectionStatus('checking');
      const result = await hubSpotService.validateConnection();
      setConnectionStatus(result.success ? 'success' : 'error');
      if (!result.success) setErrorMessage(result.error || "Connection expired. Please reconnect.");
    } else {
      setConnectionStatus('idle');
    }
  };

  useEffect(() => {
    const handleConnectionChange = () => {
      checkStatus();
    };
    window.addEventListener('hubspot_connection_changed', handleConnectionChange);
    return () => window.removeEventListener('hubspot_connection_changed', handleConnectionChange);
  }, []);

  const handleConnect = async (useMcp: boolean = false) => {
    setErrorMessage('');
    setConnectionStatus('checking');
    try {
        const popup = await hubSpotService.initiateOAuth(useMcp);
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            setConnectionStatus('error');
            setErrorMessage("Popup blocked! Access denied by browser environment.");
        }
    } catch (e: any) {
        setConnectionStatus('error');
        setErrorMessage(e.message || "Failed to start cryptographic handshake.");
    }
  };

  const handleManualCodeSubmit = async () => {
    if (!manualCode.trim()) return;
    setConnectionStatus('checking');
    try {
        await hubSpotService.exchangeCodeForToken(manualCode.trim());
        const result = await hubSpotService.validateConnection();
        setConnectionStatus(result.success ? 'success' : 'error');
        if (!result.success) setErrorMessage(result.error || "Invalid token schema.");
        else setManualCode('');
    } catch (e: any) {
        setConnectionStatus('error');
        setErrorMessage(e.message || "Cryptographic link failed.");
    }
  };

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleDisconnect = () => {
    hubSpotService.disconnect();
    setConnectionStatus('idle');
    setErrorMessage('');
    setShowDisconnectConfirm(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md transition-opacity duration-500" onClick={onClose}></div>

      <div className="relative glass-card border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 shadow-[0_0_100px_rgba(79,70,229,0.2)]">
        <div className="premium-gradient h-1 w-full" />
        
        <div className="p-10 space-y-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-5">
              <div className={`p-5 rounded-[2.5rem] transition-all duration-500 shadow-2xl ${
                connectionStatus === 'success' ? 'bg-emerald-500 text-slate-900 shadow-emerald-500/20' : 'bg-slate-100 text-slate-900 border border-slate-200'
              }`}>
                  {connectionStatus === 'success' ? <ShieldCheck size={32} /> : <Lock size={32} />}
              </div>
              <div>
                <h2 id="modal-title" className="text-3xl font-extrabold text-slate-900 tracking-tighter uppercase italic">Secure Tunnel</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === 'success' ? 'bg-emerald-500 animate-pulse' :
                    connectionStatus === 'checking' ? 'bg-amber-500 animate-ping' : 'bg-slate-700'
                  }`} />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-600">
                    {connectionStatus === 'success' ? 'Channel Encrypted' :
                     connectionStatus === 'checking' ? 'Synchronizing Nodes...' : 'Connection Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <button 
              id="close-settings-btn"
              onClick={onClose}
              title="Close Settings"
              className="p-3 text-slate-600 hover:text-slate-900 glass-button border-transparent transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {connectionStatus !== 'success' ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <p id="modal-description" className="text-slate-600 font-medium leading-relaxed italic">
                  Launch the secure OAuth 2.0 PKCE handshake to bridge your production data with the AI Heuristic Engine.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-100 border border-slate-200 p-4 rounded-3xl">
                        <Globe size={18} className="text-indigo-400 mb-2" />
                        <p className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">Global Sync</p>
                    </div>
                    <div className="bg-slate-100 border border-slate-200 p-4 rounded-3xl">
                        <Shield size={18} className="text-emerald-400 mb-2" />
                        <p className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">Audited Auth</p>
                    </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  id="standard-auth-btn"
                  onClick={() => handleConnect(false)}
                  disabled={connectionStatus === 'checking'}
                  aria-label="Connect using Standard Optimizer OAuth"
                  title="Connect using Standard Optimizer OAuth"
                  className="w-full py-6 px-8 premium-gradient text-slate-900 rounded-3xl font-extrabold uppercase tracking-[0.2em] text-sm shadow-2xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="flex items-center gap-4">
                     {connectionStatus === 'checking' ? <RefreshCw className="animate-spin" size={20} /> : "Standard Optimizer"}
                     <ExternalLink size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                  <span className="text-[9px] text-slate-900/70 font-bold normal-case tracking-normal">Recommended for full Dashboard, Workflows & Sequence Audits</span>
                </button>

                <button 
                  id="mcp-auth-btn"
                  onClick={() => handleConnect(true)}
                  disabled={connectionStatus === 'checking'}
                  aria-label="Force User-Level Auth using MCP"
                  title="Force User-Level Auth using MCP"
                  className="w-full py-5 px-8 glass-button border-indigo-500/30 text-indigo-300 rounded-3xl font-extrabold uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-500/10 transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="flex items-center gap-4">
                     Force User-Level Auth (MCP)
                     <Zap size={14} className="group-hover:animate-pulse" />
                  </div>
                  <span className="text-[9px] text-indigo-400/60 font-bold normal-case tracking-normal">For connecting external desktop agents (Limited Dashboard Access)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="p-10 bg-emerald-500/5 border border-emerald-500/10 rounded-[3rem] space-y-6 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5">
                    <ShieldCheck size={100} className="text-emerald-500" />
                </div>
                <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-500/20 relative z-10">
                  <Check className="text-slate-900" size={36} />
                </div>
                <div className="relative z-10 space-y-2">
                  <h3 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tighter italic">Handshake Verified</h3>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.3em]">AI Stream Active</p>
                    <p className="text-[10px] font-bold text-slate-900/60 uppercase tracking-widest">
                      Ident: {isMcpIdent ? 'MCP Bridge' : 'Standard Optimizer'}
                    </p>
                  </div>
                </div>
              </div>

              {!showDisconnectConfirm ? (
                <button 
                  id="terminate-link-btn"
                  onClick={() => setShowDisconnectConfirm(true)}
                  aria-label="Terminate portal link"
                  className="w-full py-5 text-[10px] font-extrabold text-rose-400 hover:text-slate-900 glass-button border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                >
                  <LogOut size={16} />
                  Terminate Link
                </button>
              ) : (
                <div className="flex gap-3 animate-in fade-in zoom-in-95 duration-200">
                  <button 
                    onClick={handleDisconnect}
                    className="flex-1 py-5 bg-rose-600 text-slate-900 rounded-2xl font-extrabold uppercase tracking-widest text-[10px] hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/20"
                  >
                    Confirm Termination
                  </button>
                  <button 
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="px-6 py-5 glass-button text-slate-600 font-extrabold uppercase tracking-widest text-[10px] hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} className="text-rose-400 shrink-0" />
              <div className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest leading-relaxed">
                Exception: {errorMessage}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-slate-200 space-y-4">
            <button 
              id="toggle-diagnostics-btn"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced ? "true" : "false"}
              aria-controls="diagnostics-panel"
              className="text-[10px] font-extrabold text-slate-600 hover:text-slate-200 uppercase tracking-[0.2em] transition-colors mx-auto block"
            >
              {showAdvanced ? 'Collapse Diagnostics' : 'Bypass OAuth or View Metadata?'}
            </button>
            
            {showAdvanced && (
              <div id="diagnostics-panel" className="space-y-6 animate-in fade-in duration-500">
                {/* Metadata Section for MCP Inspector */}
                <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">MCP Bridge Metadata</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Bearer Token (For Inspector)</p>
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 bg-black/40 border border-slate-200 rounded-xl font-mono text-[10px] text-indigo-300 truncate">
                          {hubSpotService.getToken() || 'None Detected'}
                        </div>
                        <button 
                          id="copy-token-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(hubSpotService.getToken());
                            setCopiedField('token');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          className={`p-2 glass-button border-slate-200 transition-colors ${copiedField === 'token' ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-900'}`}
                          title="Copy Token"
                          aria-label="Copy bearer token"
                        >
                          {copiedField === 'token' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">MCP Client ID</p>
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 bg-black/40 border border-slate-200 rounded-xl font-mono text-[10px] text-slate-600">
                          9d7c3c51-862a-4604-9668-cad9bf5aed93
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText('9d7c3c51-862a-4604-9668-cad9bf5aed93');
                            setCopiedField('clientId');
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          className={`p-2 glass-button border-slate-200 transition-colors ${copiedField === 'clientId' ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-900'}`}
                          title="Copy Client ID"
                        >
                          {copiedField === 'clientId' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <a 
                        href="https://modelcontextprotocol.io/inspector" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-2xl text-[10px] font-bold text-indigo-300 uppercase tracking-widest transition-all"
                      >
                        <Code size={14} />
                        Open MCP Inspector
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="manual-token-input" className="sr-only">Private Access Token</label>
                  <div className="flex gap-3">
                    <input
                      id="manual-token-input"
                      type="password"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Private Access Token..."
                      aria-label="Enter Private Access Token for manual bridge"
                      className="flex-1 px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl outline-none text-xs text-indigo-300 font-mono font-bold focus:border-indigo-500/50 transition-all"
                    />
                    <button 
                      id="manual-bridge-btn"
                      onClick={handleManualCodeSubmit}
                      disabled={!manualCode.trim() || connectionStatus === 'checking'}
                      aria-label="Submit manual token"
                      className="px-6 py-4 glass-button border-slate-200 text-slate-900 text-[10px] font-extrabold uppercase tracking-widest disabled:opacity-50"
                    >
                      Bridge
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-slate-600 text-center leading-relaxed font-bold uppercase tracking-widest">
                  Manual token entry bypasses the OAuth sequence if needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')!
  );
};

export default SettingsModal;