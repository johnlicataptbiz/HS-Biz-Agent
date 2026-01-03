import React, { useEffect, useState } from "react";
import { hubSpotService } from "../services/hubspotService";
import { DataProperty } from "../types";
import {
  Sparkles,
  Database,
  AlertOctagon,
  RefreshCw,
  Layers,
  ShieldCheck,
  Search,
  Filter,
} from "lucide-react";
import AiModal from "../components/AiModal";
import Pagination from "../components/Pagination";
import { getApiUrl } from "../services/config";

const DataModel: React.FC = () => {
  const [properties, setProperties] = useState<DataProperty[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [auditPrompt, setAuditPrompt] = useState("");
  const [isRemediating, setIsRemediating] = useState<string | null>(null);

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
        const realData = await hubSpotService.fetchProperties();
        setProperties(realData);
        setPage(1);
      } catch (e) {
        console.error("Property fetch error:", e);
        setProperties([]);
      }
    } else {
      setProperties([]);
    }
    setIsLoading(false);
  };

  const handleArchive = async (propName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to ARCHIVE the property '${propName}'? This action cannot be easily undone via API.`
      )
    )
      return;

    setIsRemediating(propName);
    try {
      const token = localStorage.getItem("hubspot_access_token");
      const resp = await fetch(getApiUrl("/api/remediate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "archive-property",
          hubspotToken: token,
          payload: { propertyName: propName },
        }),
      });
      const data = await resp.json();
      if (data.success) {
        alert(data.message);
        await loadData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert("Remediation failed.");
    } finally {
      setIsRemediating(null);
    }
  };

  const handleBulkArchive = async () => {
    const redundant = properties.filter((p) => p.redundant);
    if (redundant.length === 0)
      return alert("No redundant properties detected.");

    if (
      !window.confirm(
        `Found ${redundant.length} redundant properties. This will archive THEM ALL. Proceed with mass cleanup?`
      )
    )
      return;

    setIsLoading(true);
    let successCount = 0;
    const token = localStorage.getItem("hubspot_access_token");

    for (const prop of redundant) {
      try {
        const resp = await fetch(getApiUrl("/api/remediate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "archive-property",
            hubspotToken: token,
            payload: { propertyName: prop.name },
          }),
        });
        const data = await resp.json();
        if (data.success) successCount++;
      } catch (e) {
        console.error(`Failed to archive ${prop.name}`);
      }
    }

    alert(
      `Bulk Cleanup Complete: Successfully archived ${successCount} of ${redundant.length} properties.`
    );
    await loadData();
    setIsLoading(false);
  };

  const filteredProperties = properties.filter(
    (p) =>
      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const total = filteredProperties.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProperties = filteredProperties.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-slate-500"}`}
            ></div>
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em]">
              Schema Integrity
            </span>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
            Data <span className="gradient-text">Architecture.</span>
          </h1>
          <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
            Structural audit of your CRM property registry. isolating redundant
            fields and schema technical debt.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            id="refresh-schema-btn"
            onClick={loadData}
            className="p-3 glass-button border-white/5 text-slate-400 hover:text-white transition-all active:scale-90"
            title="Refresh Schema Cache"
            aria-label="Refresh data schema from HubSpot"
          >
            <RefreshCw
              size={20}
              className={`${isLoading ? "animate-spin text-amber-400" : ""}`}
            />
          </button>
          <button
            id="run-audit-btn"
            onClick={() => {
              const redundant = properties.filter((p) => p.redundant);
              const sample = redundant
                .slice(0, 5)
                .map((p) => p.name)
                .join(", ");
              setAuditPrompt(
                `Perform a Root Cause Analysis on this CRM Data Model.\n\n` +
                  `METRICS:\n` +
                  `- Total Properties: ${properties.length}\n` +
                  `- Detected Redundancies: ${redundant.length}\n` +
                  `- Deprecated Fields (Sample): ${sample}\n\n` +
                  `INSTRUCTIONS:\n` +
                  `1. Evaluate the impact of these redundant fields on CRM performance.\n` +
                  `2. Propose a specific property merging or archiving strategy.\n` +
                  `3. Identify potential "technical debt" risks in the Contact schema.`
              );
              setShowAi(true);
            }}
            aria-label="Run architectural audit with AI"
            className="px-8 py-3 premium-gradient text-white rounded-2xl text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2"
          >
            <Sparkles size={18} />
            Run Architectural Audit
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="glass-card p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
            <ShieldCheck className="text-amber-500" size={32} />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider">
              Sync Required
            </h3>
            <p className="text-slate-400 mt-2 font-medium">
              Link your HubSpot instance to visualize and de-duplicate your CRM
              property schema.
            </p>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Database size={24} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                Total Properties
              </p>
              <p className="text-2xl font-bold text-white">
                {properties.length}
              </p>
            </div>
          </div>
          <div className="glass-card p-6 border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <AlertOctagon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                Redundant Detected
              </p>
              <p className="text-2xl font-bold text-white">
                {properties.filter((p) => p.redundant).length}
              </p>
            </div>
          </div>
          <div className="glass-card p-6 border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Layers size={24} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                Audit Score
              </p>
              <p className="text-2xl font-bold text-white">
                {properties.length > 0 ? "Analyzed" : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {properties.length > 0 && (
        <div className="glass-card overflow-hidden border-white/5 shadow-2xl">
          <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <Layers size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">
                Property Registry{" "}
                <span className="text-slate-400 text-sm font-medium ml-2">
                  — Contact Model
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="glass-card px-4 py-2 flex items-center gap-2 border-white/5">
                <label htmlFor="schema-filter-input" className="sr-only">
                  Filter schema
                </label>
                <Search size={14} className="text-slate-400" />
                <input
                  id="schema-filter-input"
                  type="text"
                  placeholder="Filter schema..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter schema properties"
                  className="bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-400 font-bold uppercase tracking-widest w-40"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleBulkArchive}
                  disabled={isLoading || !isConnected}
                  className="glass-button px-6 py-3 text-sm font-bold flex items-center gap-2 border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
                  title="Bulk Cleanup"
                >
                  <AlertOctagon size={16} />
                  Bulk Cleanup Redundant
                </button>
                <button
                  onClick={() => {
                    setAuditPrompt(
                      "Analyze the current schema for property redundancy and usage gaps."
                    );
                    setShowAi(true);
                  }}
                  className="glass-button px-6 py-3 text-sm font-bold flex items-center gap-2"
                  title="AI Schema Audit"
                >
                  <Sparkles size={16} className="text-amber-500" />
                  AI Schema Audit
                </button>
              </div>
              <button
                id="filter-trigger-btn"
                className="glass-button p-2 text-slate-400 hover:text-white"
                title="Filter Properties"
                aria-label="Filter properties options"
              >
                <Filter size={18} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase text-slate-400 font-extrabold tracking-[0.2em]">
                  <th className="px-8 py-6">Architectural Identity</th>
                  <th className="px-8 py-6">Data Primitive</th>
                  <th className="px-8 py-6">Logical Group</th>
                  <th className="px-8 py-6">Utilization (Est)</th>
                  <th className="px-8 py-6 text-right">Heuristic Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagedProperties.map((prop) => (
                  <tr
                    key={prop.name}
                    className="hover:bg-white/5 transition-all group"
                  >
                    <td className="px-8 py-6">
                      <div className="font-bold text-white group-hover:text-amber-400 transition-colors text-base tracking-tight">
                        {prop.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-bold tracking-widest uppercase font-mono">
                        ID: {prop.name}
                      </div>
                    </td>
                    <td className="px-8 py-6 lowercase">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest border border-white/10 px-2 py-1 rounded-lg">
                        {prop.type}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold text-slate-400 font-medium">
                        {prop.group}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${Number(prop.usage) > 50 ? "bg-emerald-500" : "bg-amber-500"}`}
                            style={{ width: `${prop.usage || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-extrabold italic">
                          {prop.usage !== null ? `${prop.usage}%` : "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {prop.redundant ? (
                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-extrabold uppercase tracking-widest border border-rose-500/20 shadow-lg shadow-rose-500/5">
                            <AlertOctagon size={14} />
                            REDUNDANT ARCHITECTURE
                          </span>
                          <button
                            onClick={() => handleArchive(prop.name)}
                            disabled={isRemediating === prop.name}
                            className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest flex items-center gap-1 group/btn"
                          >
                            {isRemediating === prop.name ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : (
                              <RefreshCw
                                size={10}
                                className="group-hover/btn:rotate-180 transition-transform"
                              />
                            )}
                            Execute Archive
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-400 text-[10px] font-extrabold uppercase tracking-widest border border-white/5">
                          ANALYZED NODE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            className="pt-2"
          />
        </div>
      )}

      <AiModal
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        contextType="data"
        contextName="Contact Schema Architecture"
        initialPrompt={auditPrompt}
      />
    </div>
  );
};

export default DataModel;
