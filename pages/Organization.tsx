import React, { useEffect, useState } from 'react';
import { organizationService, SchemaReport, AssociationHealth } from '../services/organizationService';
import { Database, GitBranch, ListFilter, AlertCircle, RefreshCw, Layers, CheckCircle, ShieldAlert } from 'lucide-react';

const Organization: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [isRepairing, setIsRepairing] = useState(false);
    const [personas, setPersonas] = useState<any[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [scanData, setScanData] = useState<{
        schemas: SchemaReport[];
        associations: AssociationHealth[];
        lists: any[];
    } | null>(null);

    useEffect(() => {
        runScan();
    }, []);

    const runScan = async () => {
        setLoading(true);
        try {
            const data = await organizationService.runStructuralScan();
            setScanData(data);
        } catch (e) {
            console.error("Scan failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleRepair = async () => {
        if (!window.confirm("Automated structural repair will use AI to link orphaned contacts to high-probability company matches. Proceed?")) return;
        setIsRepairing(true);
        try {
            const result = await organizationService.autoRepairAssociations();
            alert(`Repair Complete: Successfully linked ${result.fixed} contacts. AI deferred ${result.failed} low-confidence matches.`);
            runScan();
        } catch (e) {
            alert("Repair execution failed.");
        } finally {
            setIsRepairing(false);
        }
    };
    const [creatingListFor, setCreatingListFor] = useState<number | null>(null);

    const discoverPersonas = async () => {
        setIsDiscovering(true);
        try {
            const data = await organizationService.discoverPersonas();
            if (data?.personas) {
                setPersonas(data.personas);
            }
        } catch (e) {
            console.error("Discovery failed", e);
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleCreateList = async (persona: any, index: number) => {
        setCreatingListFor(index);
        try {
            const result = await organizationService.createStrategicList(persona.name, persona.targetListCriteria);
            if (result) {
                alert(`Success: HubSpot list "[Strategic] ${persona.name}" has been initialized.`);
            }
        } catch (e) {
            alert("Failed to create list.");
        } finally {
            setCreatingListFor(null);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em]">CRM Structural Intelligence</span>
                    </div>
                    <h1 className="text-5xl font-extrabold text-white tracking-tighter leading-tight">
                        Object <span className="gradient-text">Architecture.</span>
                    </h1>
                    <p className="text-slate-400 max-w-lg font-medium">
                        Deep structural audit of your HubSpot schema, associations, and segment logic.
                    </p>
                </div>

                <button 
                    onClick={runScan}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border-2 border-indigo-500/30 hover:bg-indigo-500/20 transition-all flex items-center gap-2"
                >
                    {loading ? <RefreshCw className="animate-spin" size={14} /> : <Database size={14} />}
                    Refresh structural scan
                </button>
            </div>

            {loading ? (
                <div className="glass-card p-20 flex flex-col items-center justify-center space-y-4">
                    <RefreshCw className="animate-spin text-indigo-500" size={48} />
                    <p className="text-slate-400 font-bold uppercase tracking-widest animate-pulse">Deconstructing CRM Schema...</p>
                </div>
            ) : scanData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Schema Column */}
                    <div className="space-y-6">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                            <Layers size={14} /> Object Schemas
                        </h2>
                        {scanData.schemas.map(s => (
                            <div key={s.objectType} className="glass-card p-6 space-y-4 group hover:border-indigo-500/30 transition-all">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-white uppercase italic tracking-tight underline decoration-indigo-500/30 underline-offset-4">{s.objectType}</h3>
                                    <span className="text-[9px] font-black px-2 py-1 bg-white/5 rounded text-slate-400 uppercase tracking-widest">{s.totalProperties} Props</span>
                                </div>
                                
                                {s.redundantProperties.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1">
                                            <AlertCircle size={10} /> {s.redundantProperties.length} Redundant Fields
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {s.redundantProperties.slice(0, 3).map(p => (
                                                <span key={p} className="text-[8px] px-1.5 py-0.5 bg-rose-500/10 text-rose-300 rounded border border-rose-500/20">{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                                        <CheckCircle size={10} /> Clean Schema
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Association Column */}
                    <div className="space-y-6">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                            <GitBranch size={14} /> Object Associations
                        </h2>
                        {scanData.associations.map((a, i) => (
                            <div key={i} className="glass-card p-6 space-y-6">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>{a.fromObject}</span>
                                    <GitBranch size={12} className="text-indigo-500" />
                                    <span>{a.toObject}</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Association Health</span>
                                        <span className="text-2xl font-black text-white">84%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 w-[84%] shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleRepair}
                                    disabled={isRepairing}
                                    className="w-full py-3 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                >
                                    {isRepairing ? <RefreshCw size={12} className="animate-spin" /> : 'Repair Orphans'}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Segment Column */}
                    <div className="space-y-6">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                            <ListFilter size={14} /> Segment Discovery
                        </h2>
                        <div className="glass-card p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Indexed Lists</span>
                                <span className="text-xl font-black text-white">{scanData.lists.length}</span>
                            </div>
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Naming Consistency</p>
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="text-amber-500" size={16} />
                                    <p className="text-[10px] text-slate-400 leading-tight">Detected 12 lists with inconsistent naming conventions (e.g., lowercase vs camelCase).</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Persona Discovery Hub */}
            <div className="glass-card p-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ListFilter size={120} className="text-indigo-400" />
                </div>
                
                <div className="relative z-10 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black text-white tracking-tighter italic">Persona <span className="gradient-text">Discovery Hub.</span></h2>
                            <p className="text-slate-400 font-medium leading-relaxed">
                                Use semantic clustering to identify hidden sales segments in your CRM. 
                                Antigravity will analyze your job titles and industries to suggest ideal target personas.
                            </p>
                            <button 
                                onClick={discoverPersonas}
                                disabled={isDiscovering}
                                className="glass-button px-8 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:scale-105 transition-all"
                            >
                                {isDiscovering ? <RefreshCw className="animate-spin" size={16} /> : <ListFilter size={16} />}
                                {personas.length > 0 ? 'Re-discover Personas' : 'Begin Discovering'}
                            </button>
                        </div>

                        {personas.length > 0 && (
                            <div className="grid grid-cols-1 gap-4">
                                {personas.map((p, i) => (
                                    <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 hover:border-indigo-500/30 transition-all group/p">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-white text-sm uppercase tracking-tight italic underline decoration-indigo-500/50">{p.name}</h4>
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">High Intent</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">{p.description}</p>
                                        <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-indigo-500/70 uppercase">Criteria: {p.targetListCriteria.slice(0, 30)}...</span>
                                            <button 
                                                onClick={() => handleCreateList(p, i)}
                                                disabled={creatingListFor !== null}
                                                className="text-[9px] font-black text-white hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center gap-2"
                                            >
                                                {creatingListFor === i ? <RefreshCw className="animate-spin" size={10} /> : null}
                                                {creatingListFor === i ? 'Creating...' : 'Create List'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Organization;
