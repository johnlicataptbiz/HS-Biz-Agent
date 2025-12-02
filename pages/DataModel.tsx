import React, { useEffect, useState } from 'react';
import { getDataProperties } from '../services/mockService';
import { hubSpotService } from '../services/hubspotService';
import { DataProperty } from '../types';
import { Sparkles, Database, AlertOctagon, RefreshCw, CheckCircle2, Layers } from 'lucide-react';
import AiModal from '../components/AiModal';

const DataModel: React.FC = () => {
  const [properties, setProperties] = useState<DataProperty[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<'demo' | 'hubspot'>('demo');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const token = hubSpotService.getToken();
    if (token) {
      const realData = await hubSpotService.fetchProperties();
      if (realData.length > 0) {
        setProperties(realData);
        setSource('hubspot');
      } else {
        const mockData = await getDataProperties();
        setProperties(mockData);
        setSource('demo');
      }
    } else {
      const mockData = await getDataProperties();
      setProperties(mockData);
      setSource('demo');
    }
    setIsLoading(false);
  };

  const getUsageColor = (usage: number) => {
    if (usage >= 70) return 'from-emerald-500 to-teal-500';
    if (usage >= 40) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-pink-500';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
              Data Model
            </h1>
            {source === 'hubspot' && (
              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25">
                Live Data
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">Audit and clean up your CRM properties.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={`${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAi(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
          >
            <Sparkles size={16} />
            Run Schema Audit
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Contact Properties</h3>
              <p className="text-xs text-slate-500">{properties.length} properties found</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg flex items-center gap-1.5">
              <Layers size={12} />
              Object: Contact
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Property Name</th>
                <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Group</th>
                <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Usage</th>
                <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {properties.map((prop) => (
                <tr key={prop.name} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full bg-gradient-to-b ${getUsageColor(prop.usage)}`} />
                      <div>
                        <div className="font-semibold text-slate-900">{prop.label}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{prop.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium capitalize border border-slate-200">
                      {prop.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{prop.group}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${getUsageColor(prop.usage)}`} 
                          style={{ width: `${prop.usage}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 w-10">{prop.usage}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {prop.redundant ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                        <AlertOctagon size={12} />
                        Redundant
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                        <CheckCircle2 size={12} />
                        Healthy
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AiModal 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        contextType="data"
        contextName="Contact Schema"
      />
    </div>
  );
};

export default DataModel;