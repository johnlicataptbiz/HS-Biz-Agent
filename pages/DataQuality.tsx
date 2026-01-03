import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Trash2, Mail, User, Building2, Clock, RefreshCw, Zap, Eye, Ban, TrendingDown, Filter, Download, Ghost } from 'lucide-react';
import { getApiUrl } from '../services/config';
import { organizationService } from '../services/organizationService';
import { hubSpotService } from '../services/hubspotService';

interface DataIssue {
  id: string;
  type: 'missing_email' | 'missing_owner' | 'stale_record' | 'ghost_opp' | 'lifecycle_mismatch' | 'duplicate';
  severity: 'critical' | 'warning' | 'info';
  contactId: string;
  contactName: string;
  description: string;
  recommendation: string;
}

interface QualityMetrics {
  totalContacts: number;
  missingEmails: number;
  missingOwners: number;
  staleRecords: number;
  ghostOpps: number;
  duplicates: number;
  overallScore: number;
}

const DataQuality: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [issues, setIssues] = useState<DataIssue[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    runQualityScan();
  }, []);

  const runQualityScan = async () => {
    setLoading(true);
    setScanning(true);
    try {
      // Fetch contacts from database
      const resp = await fetch(`${getApiUrl('/api/contacts')}?limit=500`);
      if (!resp.ok) throw new Error('Failed to fetch contacts');
      const data = await resp.json();
      const contacts = data.contacts || [];

      // Analyze for issues
      const foundIssues: DataIssue[] = [];
      let missingEmails = 0;
      let missingOwners = 0;
      let staleRecords = 0;
      let ghostOpps = 0;

      const now = Date.now();
      const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      for (const contact of contacts) {
        const name = `${contact.firstname || 'Unknown'} ${contact.lastname || ''}`.trim();

        // Missing Email
        if (!contact.email) {
          missingEmails++;
          foundIssues.push({
            id: `email-${contact.id}`,
            type: 'missing_email',
            severity: 'critical',
            contactId: contact.id,
            contactName: name,
            description: 'Contact has no email address',
            recommendation: 'Add email or archive record'
          });
        }

        // Missing Owner
        if (!contact.hubspot_owner_id) {
          missingOwners++;
          foundIssues.push({
            id: `owner-${contact.id}`,
            type: 'missing_owner',
            severity: 'warning',
            contactId: contact.id,
            contactName: name,
            description: 'No assigned owner',
            recommendation: 'Assign to sales rep or use round-robin'
          });
        }

        // Stale Record (>90 days)
        const lastMod = contact.last_modified ? new Date(contact.last_modified).getTime() : 0;
        if (lastMod && lastMod < ninetyDaysAgo) {
          staleRecords++;
          foundIssues.push({
            id: `stale-${contact.id}`,
            type: 'stale_record',
            severity: 'info',
            contactId: contact.id,
            contactName: name,
            description: `No activity in 90+ days`,
            recommendation: 'Review for re-engagement or archival'
          });
        }

        // Ghost Opportunity (Opportunity stage with no recent activity)
        if (contact.lifecyclestage === 'opportunity' && lastMod < thirtyDaysAgo) {
          ghostOpps++;
          foundIssues.push({
            id: `ghost-${contact.id}`,
            type: 'ghost_opp',
            severity: 'critical',
            contactId: contact.id,
            contactName: name,
            description: 'Opportunity with no activity in 30+ days',
            recommendation: 'Follow up immediately or update stage'
          });
        }
      }

      // Calculate overall score
      const totalIssues = missingEmails + missingOwners + staleRecords + ghostOpps;
      const issueRate = contacts.length > 0 ? totalIssues / contacts.length : 0;
      const overallScore = Math.max(0, Math.min(100, Math.round((1 - issueRate) * 100)));

      setMetrics({
        totalContacts: contacts.length,
        missingEmails,
        missingOwners,
        staleRecords,
        ghostOpps,
        duplicates: 0, // Not implemented yet
        overallScore
      });
      setIssues(foundIssues);
    } catch (e) {
      console.error('Quality scan failed:', e);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  const filteredIssues = activeFilter === 'all' 
    ? issues 
    : issues.filter(i => i.type === activeFilter);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'warning': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'missing_email': return <Mail size={16} className="text-rose-400" />;
      case 'missing_owner': return <User size={16} className="text-amber-400" />;
      case 'stale_record': return <Clock size={16} className="text-slate-600" />;
      case 'ghost_opp': return <Ghost size={16} className="text-purple-400" />;
      default: return <AlertTriangle size={16} />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 p-10">
      {/* Header */}
      <header className="flex justify-between items-end mb-12">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data Intelligence</span>
            <div className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Quality Engine</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter leading-none mb-4 uppercase">Data Quality</h1>
          <p className="text-slate-600 text-sm max-w-lg">Identify and resolve data hygiene issues across your CRM. Maintain architectural integrity for high-velocity automation.</p>
        </div>

        <button
          onClick={runQualityScan}
          disabled={scanning}
          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50"
        >
          {scanning ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
          {scanning ? 'Scanning...' : 'Run Quality Scan'}
        </button>
      </header>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-6 gap-6 mb-12">
          <div className="col-span-2 glass-panel p-8 border-slate-200 bg-gradient-to-br from-indigo-500/5 to-transparent">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Health Index</span>
              <ShieldCheck size={20} className="text-indigo-400" />
            </div>
            <div className="flex items-end gap-3">
              <span className={`text-6xl font-black italic ${
                metrics.overallScore >= 80 ? 'text-emerald-400' :
                metrics.overallScore >= 60 ? 'text-amber-400' : 'text-rose-400'
              }`}>{metrics.overallScore}</span>
              <span className="text-slate-500 font-bold mb-2">/ 100</span>
            </div>
            <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  metrics.overallScore >= 80 ? 'bg-emerald-500' :
                  metrics.overallScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${metrics.overallScore}%` }}
              />
            </div>
          </div>

          <div className="glass-panel p-6 border-slate-200 hover:border-rose-500/30 transition-all cursor-pointer" onClick={() => setActiveFilter('missing_email')}>
            <Mail size={20} className="text-rose-400 mb-4" />
            <span className="text-3xl font-black text-slate-900">{metrics.missingEmails}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Missing Emails</p>
          </div>

          <div className="glass-panel p-6 border-slate-200 hover:border-amber-500/30 transition-all cursor-pointer" onClick={() => setActiveFilter('missing_owner')}>
            <User size={20} className="text-amber-400 mb-4" />
            <span className="text-3xl font-black text-slate-900">{metrics.missingOwners}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">No Owner</p>
          </div>

          <div className="glass-panel p-6 border-slate-200 hover:border-purple-500/30 transition-all cursor-pointer" onClick={() => setActiveFilter('ghost_opp')}>
            <Ghost size={20} className="text-purple-400 mb-4" />
            <span className="text-3xl font-black text-slate-900">{metrics.ghostOpps}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Ghost Opps 👻</p>
          </div>

          <div className="glass-panel p-6 border-slate-200 hover:border-slate-500/30 transition-all cursor-pointer" onClick={() => setActiveFilter('stale_record')}>
            <Clock size={20} className="text-slate-600 mb-4" />
            <span className="text-3xl font-black text-slate-900">{metrics.staleRecords}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Stale Records</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-4 mb-8">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filter:</span>
        {['all', 'missing_email', 'missing_owner', 'ghost_opp', 'stale_record'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              activeFilter === filter 
                ? 'bg-indigo-600 text-slate-900' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {filter === 'all' ? 'All Issues' : filter.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Issues Table */}
      <div className="glass-panel border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Issue</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Recommendation</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-8 bg-slate-100" />
                  </tr>
                ))
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No issues detected</p>
                  </td>
                </tr>
              ) : (
                filteredIssues.slice(0, 50).map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        {getTypeIcon(issue.type)}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-slate-900">{issue.contactName}</span>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">ID: {issue.contactId}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm text-slate-300">{issue.description}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs text-slate-600">{issue.recommendation}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {filteredIssues.length > 50 && (
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-center">
            <span className="text-xs text-slate-500 font-bold">Showing 50 of {filteredIssues.length} issues</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataQuality;
