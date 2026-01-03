import React, { useEffect, useState, useMemo } from "react";
import { hubSpotService } from "../services/hubspotService";
import {
  leadStatusService,
  IntelligenceContact,
} from "../services/leadStatusService";
import { Segment, LeadStatus } from "../types";
import {
  Users,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  List,
  UserCheck,
  UserX,
  Clock,
  Filter,
  AlertCircle,
  ArrowRight,
  Trash2,
  Trophy,
  Tag,
  Eye,
  Layers,
  ChevronRight,
  CheckCircle2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Brain,
  Zap,
} from "lucide-react";
import AiModal from "../components/AiModal";
import Pagination from "../components/Pagination";
import { getApiUrl } from "../services/config";

const Contacts: React.FC = () => {
  const [view, setView] = useState<"funnel" | "list">("funnel");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [contactHealth, setContactHealth] = useState({
    statusBreakdown: {
      New: 0,
      Hot: 0,
      Nurture: 0,
      Watch: 0,
      Unqualified: 0,
      "Past Client": 0,
      "Active Client": 0,
      Employee: 0,
      Rejected: 0,
      Trash: 0,
      Unclassified: 0,
    } as Record<LeadStatus, number>,
    totalScanned: 0,
    unclassified: 0,
    unassigned: 0,
    inactive: 0,
    healthScore: 0,
  });
  const [intelContacts, setIntelContacts] = useState<IntelligenceContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showListAi, setShowListAi] = useState(false);
  const [listPrompt, setListPrompt] = useState("");
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [isBulkScanning, setIsBulkScanning] = useState(false);

  // Intelligence Sorting & Pagination
  const [intelPage, setIntelPage] = useState(1);
  const [intelPageSize, setIntelPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "createdate",
    direction: "desc",
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  useEffect(() => {
    loadData();
    window.addEventListener("hubspot_connection_changed", loadData);
    return () =>
      window.removeEventListener("hubspot_connection_changed", loadData);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const validation = await hubSpotService.validateConnection();
    setIsConnected(validation.success);

    if (validation.success) {
      try {
        const [segmentData, healthData, intelData] = await Promise.all([
          hubSpotService.fetchSegments(),
          hubSpotService.scanContactOrganization(),
          leadStatusService.fetchIntelligenceContacts(100),
        ]);
        setSegments(segmentData);
        setContactHealth(healthData);
        setIntelContacts(intelData);
      } catch (e) {
        console.error("Data fetch error:", e);
      }
    }
    setIsLoading(false);
  };

  const executeBulkLabeling = async () => {
    if (
      !window.confirm(
        `Apply intelligence labels to ${intelContacts.length} contacts in HubSpot?`
      )
    )
      return;

    setIsExecuting(true);
    try {
      const updates = intelContacts.map((c) => ({
        id: c.id,
        status: c.status,
      }));
      const result = await leadStatusService.batchSync(updates);
      alert(
        `Successfully labeled ${result.success} contacts. ${result.failed} failed.`
      );
      await loadData();
    } catch (e) {
      alert("Execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  const runBrainScan = async (contact: IntelligenceContact) => {
    if (scanningId) return;
    setScanningId(contact.id);
    try {
      const updated = await leadStatusService.deepScanContact(contact);
      setIntelContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? updated : c))
      );
    } catch (e) {
      console.error("Scan failed");
    } finally {
      setScanningId(null);
    }
  };

  const executeBulkBrainScan = async () => {
    if (
      !window.confirm(
        `Run Intelligent Brain Scan on ${intelContacts.length} contacts? This will analyze notes and properties for granular tagging.`
      )
    )
      return;

    setIsBulkScanning(true);
    try {
      for (let i = 0; i < intelContacts.length; i++) {
        const contact = intelContacts[i];
        setScanningId(contact.id);
        const updated = await leadStatusService.deepScanContact(contact);
        setIntelContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? updated : c))
        );
      }
      alert("Deep Intelligence Scan Complete.");
    } catch (e) {
      alert("Bulk scan failed.");
    } finally {
      setIsBulkScanning(false);
      setScanningId(null);
    }
  };

  const filteredIntel = useMemo(() => {
    let sorted = [...intelContacts];

    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
          case "strategic_score":
            aValue = a.rawProperties.strategic_score || 0;
            bValue = b.rawProperties.strategic_score || 0;
            break;
          case "risk_level":
            const riskMap = { High: 3, Medium: 2, Low: 1 };
            aValue =
              riskMap[a.rawProperties.risk_level as keyof typeof riskMap] || 0;
            bValue =
              riskMap[b.rawProperties.risk_level as keyof typeof riskMap] || 0;
            break;
          case "lastActivityDays":
            aValue = a.lastActivityDays;
            bValue = b.lastActivityDays;
            break;
          case "associatedDeals":
            aValue = a.associatedDeals;
            bValue = b.associatedDeals;
            break;
          case "createdate":
            aValue = new Date(a.rawProperties.createdate || 0).getTime();
            bValue = new Date(b.rawProperties.createdate || 0).getTime();
            break;
          default:
            aValue = a.name;
            bValue = b.name;
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [intelContacts, sortConfig]);

  const pagedIntel = filteredIntel.slice(
    (intelPage - 1) * intelPageSize,
    intelPage * intelPageSize
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-indigo-500 animate-pulse" : "bg-slate-500"}`}
            ></div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">
              Lead Velocity Intelligence
            </span>
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
            Database <span className="gradient-text">Brain.</span>
          </h1>
          <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
            AI-powered lead classification and membership tracking for
            high-velocity sales.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex p-1 bg-slate-100 border border-slate-200 rounded-2xl">
            <button
              onClick={() => setView("funnel")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === "funnel" ? "bg-indigo-500 text-slate-900 shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Layers size={14} /> Funnel
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === "list" ? "bg-indigo-500 text-slate-900 shadow-lg" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Users size={14} /> Contacts
            </button>
          </div>

          <button
            onClick={executeBulkBrainScan}
            disabled={isBulkScanning || !isConnected}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 border-2 ${
              isBulkScanning
                ? "bg-slate-700 text-slate-600 border-slate-600"
                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20"
            }`}
          >
            {isBulkScanning ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <Brain size={14} />
            )}
            Scan Intelligence
          </button>

          <button
            onClick={async () => {
              if (!isConnected) return alert("Not connected to HubSpot.");
              if (
                !window.confirm(
                  "Run a dry-run to identify lead status changes?"
                )
              )
                return;
              try {
                setIsExecuting(true);
                const resp = await fetch(getApiUrl("/api/lead-status-sync"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ dryRun: true }),
                });
                const data = await resp.json();
                if (!data.success)
                  throw new Error(data.error || "Dry run failed");
                const summary = data.result;
                const proceed = window.confirm(
                  `Dry run scanned ${summary.scanned} contacts and found ${summary.proposedCount} changes. Apply changes now?`
                );
                if (proceed) {
                  const applyResp = await fetch(
                    getApiUrl("/api/lead-status-sync"),
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dryRun: false }),
                    }
                  );
                  const applyData = await applyResp.json();
                  if (!applyData.success)
                    throw new Error(applyData.error || "Apply failed");
                  alert(
                    `Applied updates: ${applyData.result.applied.success} succeeded, ${applyData.result.applied.failed} failed.`
                  );
                  await loadData();
                }
              } catch (e: any) {
                console.error("Sync failed", e);
                alert("Lead status sync failed: " + (e?.message || e));
              } finally {
                setIsExecuting(false);
              }
            }}
            disabled={isExecuting || !isConnected}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 border-2 ${
              isExecuting
                ? "bg-slate-700 text-slate-600 border-slate-600"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
            }`}
          >
            Sync Lead Status
          </button>

          <button
            onClick={executeBulkLabeling}
            disabled={isExecuting || !isConnected}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 ${
              isExecuting
                ? "bg-slate-700 text-slate-600"
                : "premium-gradient text-slate-900 shadow-indigo-500/20 hover:scale-105 active:scale-95"
            }`}
          >
            {isExecuting ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <CheckCircle2 size={14} />
            )}
            Sync HubSpot
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="glass-card p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
            <ShieldCheck className="text-amber-400" size={32} />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
              Connection Required
            </h3>
            <p className="text-slate-600 mt-2 font-medium">
              Link your HubSpot portal to run organizational heuristics.
            </p>
          </div>
        </div>
      )}

      {/* VIEW: Funnel Summary */}
      {isConnected && view === "funnel" && (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { id: "New", color: "bg-blue-500", icon: Sparkles },
              { id: "Hot", color: "bg-rose-500", icon: Trophy, pulse: true },
              { id: "Nurture", color: "bg-amber-500", icon: Clock },
              { id: "Watch", color: "bg-purple-500", icon: AlertCircle },
              {
                id: "Active Client",
                color: "bg-emerald-500",
                icon: ShieldCheck,
              },
              { id: "Employee", color: "bg-cyan-500", icon: Users },
              { id: "Past Client", color: "bg-slate-500", icon: UserCheck },
              { id: "Unqualified", color: "bg-slate-600", icon: Filter },
              { id: "Rejected", color: "bg-red-500", icon: UserX },
              { id: "Trash", color: "bg-gray-700", icon: Trash2 },
              {
                id: "Unclassified",
                color: "bg-slate-800",
                icon: AlertCircle,
                border: true,
              },
            ].map((status: any) => (
              <div
                key={status.id}
                className={`glass-card p-5 relative overflow-hidden group hover:-translate-y-1 transition-all ${status.border ? "border-dashed border-slate-600" : ""}`}
                title={`View ${status.id} contacts`}
              >
                {status.pulse && (
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                )}
                <div className="flex justify-between items-start mb-3">
                  <div
                    className={`p-2.5 rounded-xl ${status.color} bg-opacity-20 text-slate-900`}
                  >
                    <status.icon size={18} />
                  </div>
                  <span className="text-3xl font-extrabold text-slate-900">
                    {contactHealth.statusBreakdown[status.id as LeadStatus] ||
                      0}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] truncate">
                  {status.id}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wider flex items-center gap-3">
                <List className="text-indigo-400" />
                Active Segments
              </h2>
              <button
                onClick={() => {
                  const sample = segments
                    .slice(0, 10)
                    .map((s) => `${s.name} (${s.contactCount})`)
                    .join(", ");
                  setListPrompt(
                    `Analyze these HubSpot lists for redundancy and consolidation:\n\n` +
                      `LISTS: ${sample}\n\n` +
                      `INSTRUCTIONS:\n` +
                      `1. Identify which lists likely have significant overlap (e.g. 'Newsletter' vs 'Blog Subs').\n` +
                      `2. Propose a 'Master List' architecture.\n` +
                      `3. Provide a 'merge_spec' in JSON if possible.`
                  );
                  setShowListAi(true);
                }}
                className="px-4 py-2 glass-button border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/10 flex items-center gap-2"
                title="Run list consolidation analysis"
              >
                <Sparkles size={14} />
                Analyze Segments
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {segments.slice(0, 6).map((seg) => (
                <div
                  key={seg.id}
                  className="glass-card p-6 group hover:border-indigo-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-slate-200 group-hover:bg-indigo-500 group-hover:text-slate-900 transition-all">
                      <List size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-400 transition-colors uppercase italic tracking-tight">
                        {seg.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold mt-1 tracking-widest uppercase">
                        {seg.contactCount.toLocaleString()} Contacts
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Contact List Intelligence */}
      {isConnected && view === "list" && (
        <div className="animate-in slide-in-from-right-4 duration-500 space-y-6">
          <div className="glass-card overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th
                    className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-2">
                      Contact
                      {sortConfig.key === "name" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-2">
                      Heuristic Status
                      {sortConfig.key === "status" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort("strategic_score")}
                  >
                    <div className="flex items-center gap-2">
                      Strategic Score
                      {sortConfig.key === "strategic_score" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort("risk_level")}
                  >
                    <div className="flex items-center gap-2">
                      Risk Level
                      {sortConfig.key === "risk_level" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort("lastActivityDays")}
                  >
                    <div className="flex items-center gap-2">
                      Activity
                      {sortConfig.key === "lastActivityDays" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-right cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => handleSort("associatedDeals")}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Context
                      {sortConfig.key === "associatedDeals" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-30" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagedIntel.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-400 transition-colors flex items-center gap-2 flex-wrap">
                          {contact.name}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              contact.status === "Hot"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : contact.status === "Active Client"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : contact.status === "Employee"
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                  : contact.status === "Nurture"
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                    : contact.status === "Watch"
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                      : contact.status === "New"
                                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                        : contact.status === "Unqualified"
                                          ? "bg-slate-500/20 text-slate-600 border border-slate-500/30"
                                          : contact.status === "Past Client"
                                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                            : contact.status === "Rejected"
                                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                              : contact.status === "Trash"
                                                ? "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                                                : "bg-slate-500/20 text-slate-600 border border-slate-500/30"
                            }`}
                          >
                            {contact.status}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          {contact.email}
                        </p>
                        {contact.inference && (
                          <p className="text-[10px] text-indigo-300 mt-2 font-medium italic leading-tight max-w-xs animate-in fade-in slide-in-from-left-2 duration-500">
                            <span className="text-indigo-500 font-black not-italic mr-1">
                              AI:
                            </span>
                            "{contact.inference}"
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            contact.status === "Hot"
                              ? "bg-rose-500"
                              : contact.status === "Active Client"
                                ? "bg-emerald-500"
                                : contact.status === "Employee"
                                  ? "bg-cyan-500"
                                : contact.status === "New"
                                  ? "bg-blue-500"
                                  : "bg-slate-600"
                          }`}
                        ></div>
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                          {contact.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                            style={{
                              width: `${contact.rawProperties.strategic_score}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs font-black text-slate-900">
                          {contact.rawProperties.strategic_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                          contact.rawProperties.risk_level === "High"
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                            : contact.rawProperties.risk_level === "Medium"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        }`}
                      >
                        {contact.rawProperties.risk_level} Risk
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-300">
                          {contact.lastActivityDays} Days Ago
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          Last Site Visit
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-indigo-400">
                            {contact.associatedDeals} Associated Deals
                          </span>
                          {contact.associatedCompany && (
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.1em]">
                              Target Account
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => runBrainScan(contact)}
                          disabled={scanningId === contact.id}
                          className={`p-2 rounded-lg border transition-all ${
                            contact.deepScanned
                              ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                              : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                          }`}
                          title="Run Deep Brain Scan (AI Notes Analysis)"
                        >
                          {scanningId === contact.id ? (
                            <RefreshCw className="animate-spin" size={16} />
                          ) : (
                            <Brain size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={intelPage}
            pageSize={intelPageSize}
            totalItems={intelContacts.length}
            onPageChange={setIntelPage}
            onPageSizeChange={setIntelPageSize}
            className="justify-end"
          />
        </div>
      )}

      <AiModal
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        contextType="workflow"
        contextName="Contact Organization"
      />

      <AiModal
        isOpen={showListAi}
        onClose={() => setShowListAi(false)}
        contextType="segment_consolidation"
        contextName="Segment Intelligence"
        initialPrompt={listPrompt}
      />
    </div>
  );
};

export default Contacts;
