import React, { useEffect, useState } from 'react';
import { getDataProperties } from '../services/mockService';
import { hubSpotService } from '../services/hubspotService';
import { DataProperty } from '../types';
import { Sparkles, Database, AlertOctagon, RefreshCw } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Data Model</h1>
              {source === 'hubspot' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Live Data</span>
              )}
            </div>
            <p className="text-slate-500 mt-1">Audit and clean up your CRM properties.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={loadData}
                className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                title="Refresh Data"
            >
                <RefreshCw size={16} className={`${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
                onClick={() => setShowAi(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2"
            >
                <Sparkles size={16} />
                Run Schema Audit
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Database size={18} className="text-indigo-500" />
                Contact Properties
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                Object: Contact
            </span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                    <tr>
                        <th className="px-6 py-3">Property Name</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Group</th>
                        <th className="px-6 py-3">Usage % (Est)</th>
                        <th className="px-6 py-3">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {properties.map((prop) => (
                        <tr key={prop.name} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">{prop.label}</div>
                                <div className="text-xs text-slate-400 font-mono">{prop.name}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 capitalize">{prop.type}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{prop.group}</td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${prop.usage > 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} 
                                            style={{ width: `${prop.usage}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-500">{prop.usage}%</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                {prop.redundant ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-xs font-medium border border-rose-100">
                                        <AlertOctagon size={12} />
                                        Redundant
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 text-slate-600 text-xs font-medium border border-slate-100">
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