import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Copy, ExternalLink, Key, Shield, Code } from 'lucide-react';
import { hubSpotService } from '../services/hubspotService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const config = hubSpotService.getAuthConfig();
      setClientId(config.clientId);
      setClientSecret(config.clientSecret);
      setRedirectUri(config.redirectUri);
      
      // Auto-check if we have a valid token already
      if (hubSpotService.getToken()) {
        setConnectionStatus('checking');
        hubSpotService.validateConnection().then(result => {
          setConnectionStatus(result.success ? 'success' : 'error');
          if (!result.success) setErrorMessage(result.error || "Connection invalid");
        });
      }
    }
  }, [isOpen]);

  // Listener for popup completion
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
        if (event.data?.type === 'HUBSPOT_OAUTH_CODE') {
            setConnectionStatus('checking');
            // Give it a moment for the token exchange to finish in the background
            setTimeout(async () => {
                const result = await hubSpotService.validateConnection();
                setConnectionStatus(result.success ? 'success' : 'error');
                if (!result.success) setErrorMessage(result.error || "OAuth failed verification");
            }, 1000);
        }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  const handleConnect = async () => {
    setErrorMessage('');
    
    if (!clientId || !clientSecret) {
        setErrorMessage("Please provide both Client ID and Client Secret.");
        return;
    }

    // Save config first
    hubSpotService.saveAuthConfig(clientId, clientSecret);
    
    try {
        // initiateOAuth is async due to PKCE generation
        const popup = await hubSpotService.initiateOAuth();
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            setErrorMessage("Popup blocked! Please allow popups for this site.");
        }
    } catch (e: any) {
        setErrorMessage(e.message || "Failed to open connection window");
    }
  };

  const handleManualCodeSubmit = async () => {
    if (!manualCode.trim()) return;
    setConnectionStatus('checking');
    setErrorMessage('');
    
    // Save config first just in case
    hubSpotService.saveAuthConfig(clientId, clientSecret);

    try {
        await hubSpotService.exchangeCodeForToken(manualCode.trim());
        const result = await hubSpotService.validateConnection();
        setConnectionStatus(result.success ? 'success' : 'error');
        
        if (!result.success) {
            setErrorMessage(result.error || "Token accepted but connection check failed.");
        } else {
            setManualCode('');
        }
    } catch (e: any) {
        console.error(e);
        setConnectionStatus('error');
        setErrorMessage(e.message || "Failed to exchange code.");
    }
  };

  const handleDisconnect = () => {
    hubSpotService.disconnect();
    setConnectionStatus('idle');
    setErrorMessage('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg">
                <Key className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Connect HubSpot App</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg space-y-3">
            <div className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                    <ExternalLink className="text-indigo-600" size={18} />
                </div>
                <div className="text-xs text-indigo-900 leading-relaxed">
                  <p className="font-semibold mb-1">Setup Instructions (PKCE Enabled)</p>
                  <ul className="list-disc list-inside space-y-1 text-indigo-800 opacity-90">
                    <li>Go to your <strong>HubSpot Developer Account</strong></li>
                    <li>Create an App (or use an existing one)</li>
                    <li>Copy Client ID & Secret from Auth tab</li>
                    <li>Add the Redirect URI below to your app settings</li>
                  </ul>
                </div>
            </div>
            
            <div className="pl-8">
               <div className="flex items-center gap-2 mb-1">
                 <Shield size={12} className="text-indigo-600" />
                 <p className="font-semibold text-xs text-indigo-900">Required Scopes</p>
               </div>
               <div className="bg-white/60 p-2 rounded border border-indigo-100 text-[10px] font-mono text-indigo-800 h-24 overflow-y-auto">
                 <p className="font-bold mb-1 border-b border-indigo-100 pb-1">Full Scope List (Scroll)</p>
                 <div className="grid grid-cols-1 gap-0.5 opacity-80">
                    <span>account-info.security.read</span>
                    <span>accounting</span>
                    <span>actions</span>
                    <span>analytics.behavioral_events.send</span>
                    <span>automation</span>
                    <span>automation.sequences.enrollments.write</span>
                    <span>automation.sequences.read</span>
                    <span>behavioral_events.event_definitions.read_write</span>
                    <span>business-intelligence</span>
                    {/* Removed: Enterprise Only Scopes (business_units, collector) */}
                    <span>communication_preferences.read</span>
                    <span>communication_preferences.read_write</span>
                    <span>communication_preferences.statuses.batch.read</span>
                    <span>communication_preferences.statuses.batch.write</span>
                    <span>communication_preferences.write</span>
                    <span>content</span>
                    <span>conversations.custom_channels.read</span>
                    <span>conversations.custom_channels.write</span>
                    <span>conversations.read</span>
                    <span>conversations.visitor_identification.tokens.create</span>
                    <span>conversations.write</span>
                    {/* Removed: Enterprise Only (dealsplits) */}
                    <span>crm.export</span>
                    <span>crm.extensions_calling_transcripts.read</span>
                    <span>crm.extensions_calling_transcripts.write</span>
                    <span>crm.import</span>
                    <span>crm.lists.read</span>
                    <span>crm.lists.write</span>
                    <span>crm.objects.appointments.read</span>
                    <span>crm.objects.appointments.write</span>
                    <span>crm.objects.carts.read</span>
                    <span>crm.objects.carts.write</span>
                    <span>crm.objects.commercepayments.read</span>
                    <span>crm.objects.commercepayments.write</span>
                    <span>crm.objects.companies.read</span>
                    <span>crm.objects.companies.write</span>
                    <span>crm.objects.contacts.read</span>
                    <span>crm.objects.contacts.write</span>
                    <span>crm.objects.courses.read</span>
                    <span>crm.objects.courses.write</span>
                    <span>crm.objects.custom.read</span>
                    <span>crm.objects.custom.write</span>
                    <span>crm.objects.deals.read</span>
                    <span>crm.objects.deals.write</span>
                    <span>crm.objects.feedback_submissions.read</span>
                    <span>crm.objects.goals.read</span>
                    <span>crm.objects.goals.write</span>
                    <span>crm.objects.invoices.read</span>
                    <span>crm.objects.invoices.write</span>
                    <span>crm.objects.leads.read</span>
                    <span>crm.objects.leads.write</span>
                    <span>crm.objects.line_items.read</span>
                    <span>crm.objects.line_items.write</span>
                    <span>crm.objects.listings.read</span>
                    <span>crm.objects.listings.write</span>
                    <span>crm.objects.marketing_events.read</span>
                    <span>crm.objects.marketing_events.write</span>
                    <span>crm.objects.orders.read</span>
                    <span>crm.objects.orders.write</span>
                    <span>crm.objects.owners.read</span>
                    <span>crm.objects.partner-clients.read</span>
                    <span>crm.objects.partner-clients.write</span>
                    <span>crm.objects.partner-services.read</span>
                    <span>crm.objects.partner-services.write</span>
                    <span>crm.objects.products.read</span>
                    <span>crm.objects.products.write</span>
                    <span>crm.objects.projects.read</span>
                    <span>crm.objects.projects.write</span>
                    <span>crm.objects.quotes.read</span>
                    <span>crm.objects.quotes.write</span>
                    <span>crm.objects.services.read</span>
                    <span>crm.objects.services.write</span>
                    <span>crm.objects.subscriptions.read</span>
                    <span>crm.objects.subscriptions.write</span>
                    <span>crm.objects.users.read</span>
                    <span>crm.objects.users.write</span>
                    <span>crm.pipelines.orders.read</span>
                    <span>crm.pipelines.orders.write</span>
                    <span>crm.schemas.appointments.read</span>
                    <span>crm.schemas.appointments.write</span>
                    <span>crm.schemas.carts.read</span>
                    <span>crm.schemas.carts.write</span>
                    <span>crm.schemas.commercepayments.read</span>
                    <span>crm.schemas.commercepayments.write</span>
                    <span>crm.schemas.companies.read</span>
                    <span>crm.schemas.companies.write</span>
                    <span>crm.schemas.contacts.read</span>
                    <span>crm.schemas.contacts.write</span>
                    <span>crm.schemas.courses.read</span>
                    <span>crm.schemas.courses.write</span>
                    <span>crm.schemas.custom.read</span>
                    <span>crm.schemas.deals.read</span>
                    <span>crm.schemas.deals.write</span>
                    <span>crm.schemas.invoices.read</span>
                    <span>crm.schemas.invoices.write</span>
                    <span>crm.schemas.line_items.read</span>
                    <span>crm.schemas.listings.read</span>
                    <span>crm.schemas.listings.write</span>
                    <span>crm.schemas.orders.read</span>
                    <span>crm.schemas.orders.write</span>
                    <span>crm.schemas.projects.read</span>
                    <span>crm.schemas.projects.write</span>
                    <span>crm.schemas.quotes.read</span>
                    <span>crm.schemas.services.read</span>
                    <span>crm.schemas.services.write</span>
                    <span>crm.schemas.subscriptions.read</span>
                    <span>crm.schemas.subscriptions.write</span>
                    <span>ctas.read</span>
                    <span>e-commerce</span>
                    <span>external_integrations.forms.access</span>
                    <span>files</span>
                    <span>files.ui_hidden.read</span>
                    <span>forms</span>
                    <span>forms-uploaded-files</span>
                    <span>hubdb</span>
                    <span>integration-sync</span>
                    <span>integrations.zoom-app.playbooks.read</span>
                    <span>marketing-email</span>
                    <span>marketing.campaigns.read</span>
                    <span>marketing.campaigns.revenue.read</span>
                    <span>marketing.campaigns.write</span>
                    <span>media_bridge.read</span>
                    <span>media_bridge.write</span>
                    <span>oauth</span>
                    <span>record_images.signed_urls.read</span>
                    <span>sales-email-read</span>
                    <span>scheduler.meetings.meeting-link.read</span>
                    <span>settings.billing.write</span>
                    <span>settings.currencies.read</span>
                    <span>settings.currencies.write</span>
                    <span>settings.security.security_health.read</span>
                    <span>settings.users.read</span>
                    <span>settings.users.teams.read</span>
                    <span>settings.users.teams.write</span>
                    <span>settings.users.write</span>
                    <span>social</span>
                    <span>tax_rates.read</span>
                    <span>tickets</span>
                    <span>timeline</span>
                    <span>transactional-email</span>
                 </div>
               </div>
               <p className="text-[10px] text-indigo-600 mt-1 italic">
                 *Requesting exact match to configured app scopes.
               </p>
            </div>
          </div>

          {/* Config Form */}
          <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Redirect URI</label>
                <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono break-all flex items-center">
                        {redirectUri}
                    </code>
                    <button 
                        onClick={() => copyToClipboard(redirectUri)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        title="Copy to clipboard"
                    >
                        <Copy size={16} />
                    </button>
                </div>
                <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-md flex gap-2 items-start">
                    <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-amber-800 leading-tight">
                        <strong>Important:</strong> If you see a "Redirect URL mismatch" error, copy this exact URL and update your HubSpot App settings.
                    </p>
                </div>
             </div>

             <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                    <input
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret</label>
                    <input
                        type="password"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        placeholder="••••••••••••••••••••••"
                    />
                </div>
             </div>
          </div>
          
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
                <Code size={16} className="text-slate-400" />
                <label className="text-sm font-medium text-slate-700">Manual Entry / Private App Token</label>
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Paste OAuth code OR Private App Token (pat-)..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm font-mono placeholder:font-sans"
                />
                <button 
                    onClick={handleManualCodeSubmit}
                    disabled={!manualCode.trim() || connectionStatus === 'checking'}
                    className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Verify
                </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
                If OAuth fails (CORS error), create a Private App in HubSpot and paste the Access Token (starts with <code>pat-</code>) here.
            </p>
          </div>

          {connectionStatus === 'success' && (
             <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-600 flex items-center justify-between animate-in fade-in">
               <div className="flex items-center gap-2">
                 <Check size={14} />
                 <span className="font-medium">Successfully Connected</span>
               </div>
               <button onClick={handleDisconnect} className="underline hover:text-emerald-800">Disconnect</button>
             </div>
          )}

          {connectionStatus === 'error' && (
             <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600 flex items-center gap-2 animate-in fade-in">
               <AlertCircle size={14} className="flex-shrink-0" />
               <span className="font-medium break-all">{errorMessage || "Connection failed. Check Token & Scopes."}</span>
             </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
          
          <button 
            onClick={handleConnect}
            disabled={connectionStatus === 'success'}
            className={`flex items-center gap-2 px-6 py-2 text-white text-sm font-medium rounded-lg transition-all shadow-sm ${
              connectionStatus === 'success' 
                ? 'bg-emerald-500 cursor-default' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {connectionStatus === 'success' ? (
               <>Authorized</>
            ) : (
               <>
                 Authenticate with OAuth
                 <ExternalLink size={14} />
               </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;