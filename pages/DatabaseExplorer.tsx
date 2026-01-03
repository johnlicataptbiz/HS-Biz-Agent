import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  MoreHorizontal,
  ExternalLink,
  ShieldCheck,
  Zap,
  Trash2,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { getApiUrl } from "../services/config";

const DatabaseExplorer: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadContacts = async () => {
    // Initially pull from mirror if possible, else fallback to 100 for dev
    try {
      const resp = await fetch(
        getApiUrl(
          "/api/hubspot/crm/v3/objects/contacts?limit=50&properties=email,firstname,lastname,lifecyclestage,hubspot_owner_id"
        )
      );
      if (resp.ok) {
        const data = await resp.json();
        setContacts(data.results || []);
      }
    } catch (e) {
      console.error("Failed to load contacts", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const filtered = contacts.filter((c) =>
    `${c.properties.firstname} ${c.properties.lastname} ${c.properties.email}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-white italic tracking-tighter">
            Database <span className="gradient-text">Explorer.</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
            High-Performance Governance of 40,000+ CRM Lead Records.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="SEARCH ENTIRE MIRROR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white font-bold uppercase tracking-widest text-xs focus:outline-none focus:border-indigo-500/50 transition-all shadow-2xl"
            />
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button className="flex items-center justify-center gap-3 p-4 glass-card bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20 text-indigo-400 font-black uppercase tracking-widest text-[10px] transition-all">
          <Zap size={14} /> AI Health Audit
        </button>
        <button className="flex items-center justify-center gap-3 p-4 glass-card bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-black uppercase tracking-widest text-[10px] transition-all">
          <UserPlus size={14} /> Bulk Reassign
        </button>
        <button className="flex items-center justify-center gap-3 p-4 glass-card bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 text-rose-400 font-black uppercase tracking-widest text-[10px] transition-all">
          <Trash2 size={14} /> Purge Inactive
        </button>
        <button className="flex items-center justify-center gap-3 p-4 glass-card bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 font-black uppercase tracking-widest text-[10px] transition-all">
          <Filter size={14} /> Advanced Filter
        </button>
      </div>

      {/* Main Table */}
      <div className="glass-card overflow-hidden border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Contact Identity
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Growth Phase
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Owner Mapping
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                Operational Logic
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw
                      size={32}
                      className="text-indigo-500 animate-spin"
                    />
                    <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">
                      Accessing Mirror Persistence Layer
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-white/[0.03] transition-colors group"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/5 flex items-center justify-center text-indigo-400 font-black text-xs italic">
                        {contact.properties.firstname?.[0]}
                        {contact.properties.lastname?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase italic tracking-tight">
                          {contact.properties.firstname}{" "}
                          {contact.properties.lastname}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          {contact.properties.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                      {contact.properties.lifecyclestage || "Lead"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50"></div>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter italic">
                        {contact.properties.hubspot_owner_id
                          ? "Assigned"
                          : "Unassigned"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title="Open in HubSpot"
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        title="More Options"
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="p-6 border-t border-white/5 flex justify-between items-center bg-white/[0.01]">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Displaying {filtered.length} of {contacts.length} Records
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all">
              Previous
            </button>
            <button className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-500/20 transition-all">
              Next Module
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseExplorer;
