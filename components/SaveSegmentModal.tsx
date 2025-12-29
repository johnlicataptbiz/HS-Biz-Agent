import React, { useState } from 'react';
import { X, Save, Layers } from 'lucide-react';
import { getApiUrl } from '../services/config';

interface SaveSegmentModalProps {
  onClose: () => void;
  queryConfig: any;
  onSave?: (segment: any) => void;
}

const SaveSegmentModal: React.FC<SaveSegmentModalProps> = ({ onClose, queryConfig, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch(getApiUrl('/api/segments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          query_config: queryConfig,
          icon: 'Layers'
        })
      });
      const data = await resp.json();
      if (onSave) onSave(data);
      onClose();
    } catch (e) {
      console.error('Failed to save segment', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
               <Layers size={20} />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white">Save Segment</h3>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Create Smart View</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Segment Name</label>
              <input 
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition-colors font-medium"
                 placeholder="e.g. High Value Unassigned"
                 autoFocus
              />
           </div>

           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description (Optional)</label>
              <textarea 
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition-colors font-medium h-24 resize-none"
                 placeholder="Describe this view..."
              />
           </div>
           
           <div className="pt-2">
              <button 
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold tracking-wide uppercase text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {saving ? (
                   <>Saving...</>
                ) : (
                   <><Save size={16} /> Save View</>
                )}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SaveSegmentModal;
