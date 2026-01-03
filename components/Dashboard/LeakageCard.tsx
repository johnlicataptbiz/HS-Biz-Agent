import React, { useEffect, useState } from "react";
import {
  performanceService,
  LeakageReport,
} from "../../services/performanceService";
import {
  AlertCircle,
  TrendingDown,
  Clock,
  ArrowRight,
  DollarSign,
  Users,
} from "lucide-react";
import { getApiUrl } from "../../services/config";

const LeakageCard: React.FC = () => {
  const [report, setReport] = useState<LeakageReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeakage = async () => {
      try {
        const data = await performanceService.detectRevenueLeakage();
        setReport(data);
      } catch (e) {
        console.error("Leakage scan failed", e);
      } finally {
        setLoading(false);
      }
    };
    loadLeakage();
  }, []);

  if (loading)
    return (
      <div className="glass-card p-6 h-full flex flex-col justify-center items-center space-y-3 animate-pulse">
        <div className="w-12 h-12 bg-rose-500/10 rounded-full"></div>
        <div className="h-4 w-24 bg-white/5 rounded"></div>
      </div>
    );

  if (!report || (report.stalledDeals === 0 && report.coldLeads === 0))
    return null;

  return (
    <div className="glass-card p-6 h-full border-rose-500/20 bg-rose-500/5 flex flex-col justify-between group transition-all duration-500 hover:bg-rose-500/10">
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 group-hover:scale-110 transition-transform">
            <TrendingDown size={24} />
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
              Revenue Leakage
            </p>
            <h3 className="text-2xl font-black text-white decoration-rose-500/30 underline decoration-2 underline-offset-4">
              ${report.potentialRevenueAtRisk.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-2">
              <Clock size={14} className="text-rose-500" /> Stalled Deals
            </span>
            <span className="text-white">{report.stalledDeals}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-2">
              <Users size={14} className="text-rose-500" /> Inactive Leads
            </span>
            <span className="text-white">{report.coldLeads}</span>
          </div>
        </div>
      </div>

      <button
        onClick={async () => {
          const token = localStorage.getItem("hubspot_access_token");
          if (!token) return;
          setLoading(true);
          try {
            const resp = await fetch(getApiUrl("/api/remediate"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "fix-leakage",
                hubspotToken: token,
                payload: {
                  stalledDeals: report.stalledDeals,
                  coldLeads: report.coldLeads,
                },
              }),
            });
            if (resp.ok) {
              const data = await resp.json();
              alert(data.message);
            }
          } catch (e) {
            console.error("Remediation failed", e);
          } finally {
            setLoading(false);
          }
        }}
        className="mt-6 w-full py-3 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
      >
        Fix Leakage <ArrowRight size={14} />
      </button>
    </div>
  );
};

export default LeakageCard;
