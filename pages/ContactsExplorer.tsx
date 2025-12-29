import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, RefreshCw, ExternalLink, User, Building, Mail, Phone, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getApiUrl } from '../services/config';

interface Contact {
  id: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  lifecyclestage: string | null;
  hubspot_owner_id: string | null;
  health_score: number | null;
  phone: string | null;
  company: string | null;
  jobtitle: string | null;
  lead_status: string | null;
  source: string | null;
  deals: string | null;
  hubspot_url: string | null;
  last_modified: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const lifecycleColors: Record<string, string> = {
  subscriber: 'bg-gray-500',
  lead: 'bg-blue-500',
  marketingqualifiedlead: 'bg-purple-500',
  salesqualifiedlead: 'bg-orange-500',
  opportunity: 'bg-yellow-500',
  customer: 'bg-green-500',
  evangelist: 'bg-pink-500',
  other: 'bg-gray-400'
};

const ContactsExplorer: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [sortField, setSortField] = useState('last_modified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sortField,
        order: sortOrder,
        ...(search && { search }),
        ...(lifecycleFilter && { lifecyclestage: lifecycleFilter })
      });

      const resp = await fetch(`${getApiUrl('/api/contacts')}?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setContacts(data.contacts);
        setPagination(data.pagination);
      }
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, lifecycleFilter, sortField, sortOrder]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getLifecycleLabel = (stage: string | null) => {
    if (!stage) return 'Unknown';
    return stage.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  };

  return (
    <div className="contacts-explorer">
      <div className="contacts-header">
        <div className="header-title">
          <h1>Contact Database</h1>
          <span className="contact-count">{pagination.total.toLocaleString()} contacts</span>
        </div>
        
        <div className="header-actions">
          <form onSubmit={handleSearch} className="search-form">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>

          <select
            value={lifecycleFilter}
            onChange={(e) => {
              setLifecycleFilter(e.target.value);
              setPagination(p => ({ ...p, page: 1 }));
            }}
            className="lifecycle-filter"
          >
            <option value="">All Stages</option>
            <option value="subscriber">Subscriber</option>
            <option value="lead">Lead</option>
            <option value="marketingqualifiedlead">MQL</option>
            <option value="salesqualifiedlead">SQL</option>
            <option value="opportunity">Opportunity</option>
            <option value="customer">Customer</option>
          </select>

          <button onClick={fetchContacts} className="refresh-btn" disabled={loading} title="Refresh Table">
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>

          <button 
            onClick={async () => {
              if (confirm('Recalculate all 39k+ health scores in background?')) {
                const resp = await fetch(getApiUrl('/api/contacts/process-scores'), { method: 'POST' });
                if (resp.ok) alert('Batch score processing started! Refresh in a few minutes to see results.');
              }
            }} 
            className="process-scores-btn" 
            title="Batch Recalculate Scores"
          >
            AI Recalculate
          </button>
        </div>
      </div>

      <div className="contacts-table-wrapper">
        <table className="contacts-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('health_score')} className="sortable score-col">
                Score {sortField === 'health_score' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('firstname')} className="sortable">
                Name {sortField === 'firstname' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('email')} className="sortable">
                Email {sortField === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Company</th>
              <th onClick={() => handleSort('lifecyclestage')} className="sortable">
                Stage {sortField === 'lifecyclestage' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Source</th>
              <th>Deals</th>
              <th onClick={() => handleSort('last_modified')} className="sortable">
                Last Modified {sortField === 'last_modified' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="loading-row">
                  <Loader2 size={24} className="spinning" />
                  <span>Loading contacts...</span>
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">No contacts found</td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id}>
                  <td className="score-cell">
                    <div className={`health-score ${
                      (contact.health_score || 0) >= 80 ? 'hot' : 
                      (contact.health_score || 0) >= 60 ? 'active' : 
                      (contact.health_score || 0) >= 40 ? 'passive' : 'cold'
                    }`}>
                      {contact.health_score || '0'}
                    </div>
                  </td>
                  <td className="name-cell">
                    <User size={16} />
                    <span>{contact.firstname || ''} {contact.lastname || ''}</span>
                    {contact.jobtitle && <small>{contact.jobtitle}</small>}
                  </td>
                  <td className="email-cell">
                    <Mail size={14} />
                    <span>{contact.email || '—'}</span>
                  </td>
                  <td className="company-cell">
                    {contact.company ? (
                      <>
                        <Building size={14} />
                        <span>{contact.company}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`lifecycle-badge ${lifecycleColors[contact.lifecyclestage || 'other']}`}>
                      {getLifecycleLabel(contact.lifecyclestage)}
                    </span>
                  </td>
                  <td className="source-cell">{contact.source || '—'}</td>
                  <td className="deals-cell">{contact.deals || '0'}</td>
                  <td className="date-cell">{formatDate(contact.last_modified)}</td>
                  <td className="actions-cell">
                    {contact.hubspot_url && (
                      <a href={contact.hubspot_url} target="_blank" rel="noopener noreferrer" title="Open in HubSpot">
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-controls">
        <button
          onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
          disabled={pagination.page <= 1 || loading}
        >
          <ChevronLeft size={18} />
          Previous
        </button>
        <span className="page-info">
          Page {pagination.page} of {pagination.totalPages || 1}
        </span>
        <button
          onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
          disabled={pagination.page >= pagination.totalPages || loading}
        >
          Next
          <ChevronRight size={18} />
        </button>
      </div>

      <style>{`
        .contacts-explorer {
          padding: 24px;
          max-width: 100%;
          overflow-x: auto;
        }

        .contacts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-title {
          display: flex;
          align-items: baseline;
          gap: 12px;
        }

        .header-title h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .contact-count {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
          padding: 4px 10px;
          border-radius: 12px;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .search-form {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 8px 12px;
          gap: 8px;
          min-width: 280px;
        }

        .search-form input {
          background: transparent;
          border: none;
          color: #fff;
          outline: none;
          width: 100%;
          font-size: 0.9rem;
        }

        .search-form input::placeholder {
          color: rgba(255,255,255,0.5);
        }

        .lifecycle-filter {
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .refresh-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .refresh-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .contacts-table-wrapper {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
        }

        .contacts-table {
          width: 100%;
          border-collapse: collapse;
        }

        .contacts-table th {
          text-align: left;
          padding: 14px 16px;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.6);
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .contacts-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .contacts-table th.sortable:hover {
          color: #fff;
        }

        .contacts-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #fff;
          font-size: 0.9rem;
        }

        .contacts-table tr:hover td {
          background: rgba(255,255,255,0.03);
        }

        .name-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .name-cell small {
          display: block;
          color: rgba(255,255,255,0.5);
          font-size: 0.75rem;
        }

        .email-cell, .company-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lifecycle-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          color: #fff;
        }

        .source-cell, .deals-cell, .date-cell {
          color: rgba(255,255,255,0.7);
        }

        .actions-cell a {
          color: rgba(255,255,255,0.6);
          transition: color 0.2s;
        }

        .actions-cell a:hover {
          color: #6366f1;
        }

        .loading-row, .empty-row {
          text-align: center;
          padding: 48px !important;
          color: rgba(255,255,255,0.5);
        }

        .process-scores-btn {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
          border: none;
          color: #fff;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: transform 0.2s, opacity 0.2s;
        }

        .process-scores-btn:hover {
          transform: translateY(-1px);
          opacity: 0.9;
        }

        .score-col {
          width: 80px;
          text-align: center !important;
        }

        .score-cell {
          text-align: center;
        }

        .health-score {
          display: inline-block;
          width: 32px;
          height: 32px;
          line-height: 32px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.8rem;
          background: rgba(255,255,255,0.1);
        }

        .health-score.hot {
          background: #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
        }

        .health-score.active {
          background: #f59e0b;
        }

        .health-score.passive {
          background: #3b82f6;
        }

        .health-score.cold {
          background: #64748b;
        }

        .loading-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .pagination-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 24px;
        }

        .pagination-controls button {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }

        .pagination-controls button:hover:not(:disabled) {
          background: rgba(255,255,255,0.2);
        }

        .pagination-controls button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          color: rgba(255,255,255,0.6);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
};

export default ContactsExplorer;
