import React from 'react';
import { TrendingUp, Calendar, Zap } from 'lucide-react';

interface VelocityForecasterProps {
  velocityScore: number;
  totalPipelineValue: number;
}

export const VelocityForecaster: React.FC<VelocityForecasterProps> = ({ velocityScore, totalPipelineValue }) => {
  // Projection Heuristic: Velocity Score * Pipeline / 200 (normalized)
  const projection = Math.round((velocityScore / 100) * totalPipelineValue * 0.4); // 40% close rate weight
  const velocityColor = velocityScore > 80 ? 'text-emerald-400' : velocityScore > 50 ? 'text-blue-400' : 'text-amber-400';
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <TrendingUp size={80} className={velocityColor} />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg bg-slate-800 ${velocityColor}`}>
          <Zap size={20} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Revenue Velocity Forecast</h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-slate-600 text-sm">30-Day Projection</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">${projection.toLocaleString()}</span>
            <span className={`text-sm font-medium ${velocityColor}`}>
              {velocityScore > 75 ? '↑ High Momentum' : '→ Stable'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800">
            <p className="text-slate-500 text-xs mb-1">Velocity Score</p>
            <p className="text-lg font-mono font-bold text-slate-900">{velocityScore}/100</p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800">
            <p className="text-slate-500 text-xs mb-1">Pipeline Health</p>
            <p className="text-lg font-mono font-bold text-slate-900">Optimized</p>
          </div>
        </div>

        <div className="pt-4 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-800">
          <Calendar size={14} />
          <span>Next Forecast: {new Date(Date.now() + 86400000).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
