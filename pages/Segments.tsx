import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../services/config';
import { 
    Layers, 
    Ghost, 
    Flame, 
    Moon, 
    Brain, 
    Filter, 
    Sprout,
    Zap,
    Trash2, 
    Plus,
    ArrowRight
} from 'lucide-react';

interface Segment {
    id: number;
    name: string;
    description: string;
    icon: string;
    is_system: boolean;
    query_config: any;
    count?: number;
}

const IconMap: Record<string, any> = {
    Ghost,
    Flame,
    Moon,
    Brain,
    Filter,
    Sprout,
    Zap
};

const Segments: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
    const [segments, setSegments] = useState<Segment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newSegment, setNewSegment] = useState({
        name: '',
        description: '',
        minScore: '',
        lifecycleStage: '',
        classification: '',
        hasOwner: '',
        daysInactive: '',
        hasDeal: '',
        dealType: '',
        dealStageExclude: '',
        leadSource: ''
    });

    useEffect(() => {
        fetchSegments();
    }, []);

    const fetchSegments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(getApiUrl('/api/segments'));
            const data = await res.json();
            setSegments(data);
        } catch (e) {
            console.error('Failed to load segments', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSegmentClick = (segment: Segment) => {
        // Serialize query config and navigate to ContactsExplorer
        const params = new URLSearchParams();
        // Clear any existing params first? No, new URLSearchParams() is empty.
        
        // Add segment queries
        if (segment.query_config.minScore) params.set('minScore', segment.query_config.minScore);
        if (segment.query_config.hasOwner === false) params.set('hasOwner', 'false');
        if (segment.query_config.lifecycleStage) params.set('lifecycle', segment.query_config.lifecycleStage);
        if (segment.query_config.daysInactive) params.set('daysInactive', segment.query_config.daysInactive);
        if (segment.query_config.classification) params.set('classification', segment.query_config.classification);
        if (segment.query_config.dealType) params.set('dealType', segment.query_config.dealType);
        if (segment.query_config.hasDeal) params.set('hasDeal', 'true');
        
        // Add system segment name for display context
        params.set('segmentName', segment.name);

        // 1. Update URL with params manually
        const newUrl = `/contacts?${params.toString()}`;
        window.history.pushState({}, '', newUrl);

        // 2. Trigger navigation
        onNavigate('contacts');
    };

    const handleCreateSegment = async () => {
        if (!newSegment.name.trim()) return;
        const query_config: any = {};
        if (newSegment.minScore) query_config.minScore = Number(newSegment.minScore);
        if (newSegment.lifecycleStage) query_config.lifecycleStage = newSegment.lifecycleStage;
        if (newSegment.classification) query_config.classification = newSegment.classification;
        if (newSegment.hasOwner === 'false') query_config.hasOwner = false;
        if (newSegment.hasOwner === 'true') query_config.hasOwner = true;
        if (newSegment.daysInactive) query_config.daysInactive = Number(newSegment.daysInactive);
        if (newSegment.hasDeal === 'true') query_config.hasDeal = true;
        if (newSegment.hasDeal === 'false') query_config.hasDeal = false;
        if (newSegment.dealType) query_config.dealType = newSegment.dealType;
        if (newSegment.dealStageExclude) query_config.dealStageExclude = newSegment.dealStageExclude;
        if (newSegment.leadSource) query_config.leadSource = newSegment.leadSource;

        try {
            const res = await fetch(getApiUrl('/api/segments'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSegment.name,
                    description: newSegment.description,
                    query_config,
                    icon: 'Filter'
                })
            });
            if (res.ok) {
                setShowCreate(false);
                setNewSegment({
                    name: '',
                    description: '',
                    minScore: '',
                    lifecycleStage: '',
                    classification: '',
                    hasOwner: '',
                    daysInactive: '',
                    hasDeal: '',
                    dealType: '',
                    dealStageExclude: '',
                    leadSource: ''
                });
                fetchSegments();
            }
        } catch (e) {
            console.error('Failed to create segment', e);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em]">
                            Intelligence Layers
                        </span>
                    </div>
                    <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter leading-tight">
                        Smart <span className="gradient-text">Segments.</span>
                    </h1>
                    <p className="text-slate-600 max-w-lg font-medium leading-relaxed">
                        Pre-computed views to instantly identify critical groups like Ghosted Opportunities, High Value Orphans, and more.
                    </p>
                </div>
                
                <button
                    onClick={() => setShowCreate(true)}
                    className="glass-button px-6 py-3 flex items-center gap-2 text-slate-300 hover:text-slate-900 group"
                >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                    <span>Create Segment</span>
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    // Skeletons
                    [1,2,3].map(i => (
                        <div key={i} className="h-48 glass-card animate-pulse bg-slate-100" />
                    ))
                ) : (
                    segments.map(seg => {
                        const Icon = IconMap[seg.icon] || Filter;
                        return (
                            <div 
                                key={seg.id}
                                onClick={() => handleSegmentClick(seg)}
                                className="glass-card p-6 group cursor-pointer hover:border-blue-500/30 hover:bg-white/[0.03] transition-all relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight size={20} className="text-blue-400 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300" />
                                </div>

                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors ${
                                    seg.is_system ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700/30 text-slate-600'
                                }`}>
                                    <Icon size={24} />
                                </div>
                                
                                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-200 transition-colors">
                                    {seg.name}
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {seg.description}
                                </p>

                                <div className="mt-6 flex items-center gap-2 justify-between">
                                    <div className="flex items-center gap-2">
                                        {seg.is_system && (
                                            <div className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                System Query
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                        {seg.count ?? 0} Leads
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Create Segment</h3>
                                <p className="text-xs text-slate-600 uppercase tracking-wider">Define your filters</p>
                            </div>
                            <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-slate-900">✕</button>
                        </div>

                        <div className="space-y-4">
                            <input
                                placeholder="Segment name"
                                value={newSegment.name}
                                onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                            />
                            <textarea
                                placeholder="Description (optional)"
                                value={newSegment.description}
                                onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none h-20 resize-none"
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    placeholder="Min Score"
                                    value={newSegment.minScore}
                                    onChange={(e) => setNewSegment({ ...newSegment, minScore: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                />
                                <input
                                    placeholder="Days Inactive"
                                    value={newSegment.daysInactive}
                                    onChange={(e) => setNewSegment({ ...newSegment, daysInactive: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                />
                                <input
                                    placeholder="Lifecycle Stage (e.g. customer)"
                                    value={newSegment.lifecycleStage}
                                    onChange={(e) => setNewSegment({ ...newSegment, lifecycleStage: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                />
                                <input
                                    placeholder="Classification (e.g. Hot)"
                                    value={newSegment.classification}
                                    onChange={(e) => setNewSegment({ ...newSegment, classification: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                />
                                <input
                                    placeholder="Deal Type"
                                    value={newSegment.dealType}
                                    onChange={(e) => setNewSegment({ ...newSegment, dealType: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                />
                                <input
                                    placeholder="Exclude Deal Stages (comma)"
                                    value={newSegment.dealStageExclude}
                                    onChange={(e) => setNewSegment({ ...newSegment, dealStageExclude: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                />
                                <input
                                    placeholder="Lead Source (comma)"
                                    value={newSegment.leadSource}
                                    onChange={(e) => setNewSegment({ ...newSegment, leadSource: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                />
                                <select
                                    value={newSegment.hasOwner}
                                    onChange={(e) => setNewSegment({ ...newSegment, hasOwner: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                >
                                    <option value="">Owner: Any</option>
                                    <option value="true">Has Owner</option>
                                    <option value="false">Unassigned</option>
                                </select>
                                <select
                                    value={newSegment.hasDeal}
                                    onChange={(e) => setNewSegment({ ...newSegment, hasDeal: e.target.value })}
                                    className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none"
                                >
                                    <option value="">Deals: Any</option>
                                    <option value="true">Has Deal</option>
                                    <option value="false">No Deal</option>
                                </select>
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600">Cancel</button>
                                <button onClick={handleCreateSegment} className="px-5 py-2 rounded-xl bg-indigo-500 text-slate-900 font-bold">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Segments;
