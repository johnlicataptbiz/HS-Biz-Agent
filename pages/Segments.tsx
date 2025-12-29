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
    count?: number; // Placeholder for future count stats
}

const IconMap: Record<string, any> = {
    Ghost,
    Flame,
    Moon,
    Brain,
    Filter
};

const Segments: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
    const [segments, setSegments] = useState<Segment[]>([]);
    const [isLoading, setIsLoading] = useState(false);

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
                    <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
                        Smart <span className="gradient-text">Segments.</span>
                    </h1>
                    <p className="text-slate-400 max-w-lg font-medium leading-relaxed">
                        Pre-computed views to instantly identify critical groups like Ghosted Opportunities, High Value Orphans, and more.
                    </p>
                </div>
                
                <button className="glass-button px-6 py-3 flex items-center gap-2 text-slate-300 hover:text-white group">
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                    <span>Create Segment</span>
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    // Skeletons
                    [1,2,3].map(i => (
                        <div key={i} className="h-48 glass-card animate-pulse bg-white/5" />
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
                                    seg.is_system ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700/30 text-slate-400'
                                }`}>
                                    <Icon size={24} />
                                </div>
                                
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-200 transition-colors">
                                    {seg.name}
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {seg.description}
                                </p>

                                {seg.is_system && (
                                    <div className="mt-6 flex items-center gap-2">
                                        <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            System Query
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default Segments;
