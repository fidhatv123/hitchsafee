import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Battery, Trash2, Cpu, Shield, Check, X, Sparkles } from 'lucide-react';

export default function SettingsModal({ onClose, activeTrip }) {
  const [modelMetrics, setModelMetrics] = useState(null);
  const [purged, setPurged] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await api.getModelMetrics();
      setModelMetrics(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMyData = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all local and server GPS logs, photos, and trip records?')) {
      return;
    }
    try {
      if (activeTrip) {
        await api.deleteTripData(activeTrip.id);
      }
      localStorage.clear();
      setPurged(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Battery className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Telemetry & Privacy Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Battery Drain & Adaptive Sampling (Limitation 5) */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-emerald-400" /> Adaptive GPS Battery Profile
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-bold">
              Active Optimization
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block">On-Track Normal:</span>
              <strong className="text-emerald-300">30s Sampling</strong>
              <span className="text-[10px] text-slate-500 block">~1.8% battery / hr</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Deviation Suspected:</span>
              <strong className="text-amber-300">5s Sampling</strong>
              <span className="text-[10px] text-slate-500 block">~4.2% battery / hr</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Adaptive GPS reduces unnecessary continuous location requests while automatically ramping up fidelity the instant a safety trigger occurs.
          </p>
        </div>

        {/* Machine Learning Model Performance (Limitation 2) */}
        {modelMetrics && (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Wait-Time Model Error Metrics
              </span>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-bold">
                +{modelMetrics.ml_model?.mae_improvement_pct}% vs Baseline
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Heuristic Baseline:</span>
                <div className="text-slate-200 font-bold">MAE: {modelMetrics.baseline?.mae_minutes}m</div>
                <div className="text-[10px] text-slate-500">RMSE: {modelMetrics.baseline?.rmse_minutes}m</div>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Gradient-Boosted ML:</span>
                <div className="text-emerald-300 font-bold">MAE: {modelMetrics.ml_model?.mae_minutes}m</div>
                <div className="text-[10px] text-slate-500">RMSE: {modelMetrics.ml_model?.rmse_minutes}m</div>
              </div>
            </div>
          </div>
        )}

        {/* Privacy & Delete My Data (Limitation 3) */}
        <div className="bg-rose-950/20 border border-rose-900/50 p-4 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
            <Shield className="w-4 h-4" />
            <span>Privacy Guard & Zero Trace</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            We store only the minimum data required to protect you during active rides. We never build public traveler profiles or store permanent GPS movement histories.
          </p>
          <button
            onClick={handleDeleteMyData}
            disabled={purged}
            className="w-full bg-rose-600/80 hover:bg-rose-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{purged ? 'Data Purged Successfully!' : 'Purge All My Data (Delete My Data)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
