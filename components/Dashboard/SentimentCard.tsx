import React from 'react';
import { Brain, Quote, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentData {
  mood: string;
  score: number;
  analysis: string;
  themes: string[];
}

interface SentimentCardProps {
  data: SentimentData | null;
  loading: boolean;
}

export const SentimentCard: React.FC<SentimentCardProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="glass-card p-6 h-full flex flex-col justify-center items-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analyzing Market Vibes...</p>
      </div>
    );
  }

  if (!data) return null;

  const scoreColor = data.score > 70 ? 'text-emerald-400' : data.score > 40 ? 'text-amber-400' : 'text-rose-400';
  const TrendIcon = data.score > 70 ? TrendingUp : data.score > 40 ? Minus : TrendingDown;

  return (
    <div className="glass-card p-6 h-full relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Brain size={80} className="text-indigo-400" />
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Market Intelligence</span>
          <h3 className="text-xl font-black text-white mt-1 uppercase tracking-tighter">Current Vibe</h3>
        </div>
        <div className={`flex items-center gap-1 font-mono font-bold ${scoreColor}`}>
          <TrendIcon size={16} />
          {data.score}/100
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Quote size={14} className="text-slate-500" />
            <span className={`text-sm font-black uppercase tracking-widest ${scoreColor}`}>{data.mood}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed italic">
            "{data.analysis}"
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Recurring Themes</p>
          <div className="flex flex-wrap gap-2">
            {data.themes.map((theme, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                {theme}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
