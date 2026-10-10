import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Shield, AlertTriangle, Scale, PhoneCall, BookOpen, MapPin } from 'lucide-react';

export default function RegionalGuidance() {
  const [guidance, setGuidance] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('india');

  useEffect(() => {
    loadGuidance();
  }, []);

  const loadGuidance = async () => {
    try {
      const data = await api.getRegionalGuidance();
      setGuidance(data);
    } catch (e) {
      console.error(e);
    }
  };

  if (!guidance) return null;

  const currentRegion = guidance.regions.find(r => r.region_id === selectedRegion) || guidance.regions[0];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 w-full space-y-6">
      {/* Risk-Reduction Disclaimer (Limitation 9) */}
      <div className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-5 md:p-6 text-rose-200 shadow-xl space-y-2">
        <div className="flex items-center gap-2.5 text-rose-400 font-bold text-base">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Safety & Liability Disclaimer</span>
        </div>
        <p className="text-xs leading-relaxed text-rose-200/90">
          {guidance.disclaimer}
        </p>
      </div>

      {/* Regional Laws & Norms (Limitation 8) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-100">Regional Legal Frameworks & Norms</h2>
              <p className="text-xs text-slate-400">Restricted roads, local etiquette, and emergency protocols</p>
            </div>
          </div>

          {/* Region Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            {guidance.regions.map(r => (
              <button
                key={r.region_id}
                onClick={() => setSelectedRegion(r.region_id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedRegion === r.region_id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Region Content */}
        <div className="space-y-5">
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Legal Classification</span>
            <div className="text-sm font-semibold text-slate-200 mt-1">{currentRegion.legal_status}</div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> Operational Rules & Restrictions
            </h3>
            <div className="grid gap-3">
              {currentRegion.rules.map((rule, idx) => (
                <div key={idx} className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                  {rule}
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Helplines */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-rose-400" /> Regional Emergency Helplines
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(currentRegion.emergency_numbers).map(([key, num]) => (
                <a
                  key={key}
                  href={`tel:${num}`}
                  className="bg-slate-950 hover:bg-slate-800 p-3 rounded-2xl border border-slate-800 flex flex-col transition text-center group"
                >
                  <span className="text-[10px] text-slate-400 capitalize">{key.replace('_', ' ')}</span>
                  <span className="text-base font-black text-rose-400 group-hover:text-rose-300 mt-1">{num}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
