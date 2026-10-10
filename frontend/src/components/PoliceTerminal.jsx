import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Shield, Radio, PhoneCall, MapPin, Camera, AlertTriangle, ExternalLink, CheckCircle, RefreshCw } from 'lucide-react';

export default function PoliceTerminal() {
  const [stations, setStations] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [stData, dosData] = await Promise.all([
        api.getPoliceStations(),
        api.getPoliceDossiers()
      ]);
      setStations(stData);
      setDossiers(dosData);
      if (dosData.length > 0 && !selectedDossier) {
        setSelectedDossier(dosData[0]);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full gap-4 p-3 md:p-6 overflow-y-auto">
      {/* Left: Police Stations Directory & Incoming Intercepts */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        {/* Active Intercept Alert Queue */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-black text-rose-300 flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Incoming Emergency Intercepts</span>
            </h3>
            <span className="text-[10px] bg-rose-950 text-rose-200 border border-rose-800 px-2 py-0.5 rounded font-bold">
              {dossiers.length} Alerts
            </span>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {dossiers.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No active police emergency dispatches. Trigger "Missed Destination" in Live Ride or Demo Simulator to transmit an alert.
              </div>
            ) : (
              dossiers.map((dos, idx) => {
                const isSelected = selectedDossier?.id === dos.id;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDossier(dos)}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-rose-950/60 border-rose-500 text-rose-100 shadow-lg'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1 font-bold">
                      <span className="text-rose-400 font-mono">Case #{dos.id.substring(0, 12)}</span>
                      <span className="text-[10px] text-slate-500">{new Date(dos.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs font-semibold">{dos.police_station_name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{dos.message}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Local Police Stations Directory */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 flex-1">
          <h3 className="text-sm font-black text-slate-200 flex items-center gap-2 pb-2 border-b border-slate-800">
            <Shield className="w-4 h-4 text-emerald-400" /> Highway Police Stations
          </h3>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {stations.map((st) => (
              <div key={st.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
                <div className="font-bold text-slate-100 flex items-center justify-between">
                  <span>{st.name}</span>
                  <span className="text-[10px] text-rose-400 font-mono">{st.control_room}</span>
                </div>
                <div className="text-[11px] text-slate-400">{st.jurisdiction}</div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px]">
                  <span className="text-emerald-400 font-medium">{st.highway_unit}</span>
                  <a href={`tel:${st.phone}`} className="text-blue-400 hover:underline">{st.phone}</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Selected Police Dossier Detail View */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 overflow-y-auto">
        {selectedDossier ? (
          <>
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                  CRITICAL INCIDENT DOSSIER
                </span>
                <h2 className="text-xl font-black text-slate-100 mt-1">
                  {selectedDossier.police_station_name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Emergency Intercept Dossier Ref: <span className="font-mono text-slate-200">{selectedDossier.id}</span>
                </p>
              </div>
              <a
                href="tel:112"
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-rose-950"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call PCR 112</span>
              </a>
            </div>

            {/* Vehicle Plate Photo Evidence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" /> Number Plate Evidence Photo
                </span>
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-700">
                  <img
                    src={selectedDossier.plate_photo_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80'}
                    alt="Number Plate"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-rose-950/90 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-700">
                    TRANSMITTED WITH DISPATCH
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <span className="text-xs font-bold text-slate-300 block pb-1 border-b border-slate-800">
                  Incident Telemetry & Itinerary
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dispatch Status:</span>
                    <span className="text-emerald-400 font-bold">TRANSMITTED TO HIGHWAY PATROL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="text-slate-200">{new Date(selectedDossier.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recipient Station:</span>
                    <span className="text-slate-200 font-semibold">{selectedDossier.recipient}</span>
                  </div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed">
                  {selectedDossier.message}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-slate-500 text-sm">
            Select an emergency dispatch from the list to view law enforcement evidence and the number plate photo.
          </div>
        )}
      </div>
    </div>
  );
}
