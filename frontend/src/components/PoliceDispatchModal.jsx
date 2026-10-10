import React, { useState } from 'react';
import { Shield, AlertTriangle, PhoneCall, MapPin, Car, Camera, CheckCircle2, Copy, ExternalLink, X, Radio } from 'lucide-react';

export default function PoliceDispatchModal({ trip, policeDossier, platePhotoUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('primary'); // 'primary' or 'police'
  const [customPhone, setCustomPhone] = useState(() => {
    return trip?.trusted_contact_phone || localStorage.getItem('hitchsafe_demo_user_phone') || '+91 98450 12345';
  });

  const sampleDefaultPlatePhoto = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80';
  const effectivePlatePhoto = platePhotoUrl || trip?.plate_photo_data || trip?.plate_photo_path || sampleDefaultPlatePhoto;

  const stationName = policeDossier?.nearest_police_station || 'Hebbal Law & Highway Patrol Police Station';
  const dispatchId = policeDossier?.dispatch_id || 'FIR-SOS-2026-8914';
  const policePhone = policeDossier?.police_emergency_phone || '+91 80 2294 2531';
  const controlRoom = policeDossier?.police_control_room || '112 / 100';
  const highwayUnit = policeDossier?.highway_unit_assigned || 'NHAI Highway Intercept PCR-07';

  const copyDossier = () => {
    navigator.clipboard.writeText(`POLICE EMERGENCY DISPATCH ID: ${dispatchId}\nVehicle Plate: ${trip?.vehicle_plate}\nLast GPS: ${trip?.last_known_lat}, ${trip?.last_known_lon}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-100 transition p-1 rounded-xl bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Emergency Alert Banner */}
        <div className="bg-rose-950/80 border border-rose-500/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-200">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping shrink-0"></div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>MISSED DESTINATION EMERGENCY ESCALATION</span>
                <span className="text-[10px] bg-rose-900 border border-rose-400 text-rose-200 px-2 py-0.5 rounded uppercase font-bold">
                  Dual Broadcast Fired
                </span>
              </h2>
              <p className="text-xs text-rose-200/90 mt-0.5">
                {trip?.user_name} has not arrived safely at <strong>{trip?.destination_name}</strong>. Emergency notifications dispatched simultaneously!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="font-mono text-xs font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-rose-800 text-rose-300">
              Case #{dispatchId}
            </span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold gap-2">
          <button
            onClick={() => setActiveTab('primary')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'primary' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>1. Primary Person Alert (With Plate Photo)</span>
          </button>
          <button
            onClick={() => setActiveTab('police')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'police' ? 'bg-rose-700 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-amber-400" />
            <span>2. Nearest Police Station Dispatch Dossier</span>
          </button>
        </div>

        {/* Tab 1: Primary Contact Notification */}
        {activeTab === 'primary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Plate Photo Card */}
            <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" /> Vehicle Number Plate Photo Evidence
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                  Attached to Alert
                </span>
              </div>

              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-900 group">
                <img
                  src={effectivePlatePhoto}
                  alt="Vehicle Plate Evidence"
                  className="w-full h-52 object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 text-[11px] flex justify-between items-center">
                  <span className="font-mono font-bold text-emerald-300 uppercase tracking-wider">{trip?.vehicle_plate}</span>
                  <span className="text-[10px] text-slate-400">Captured at pickup</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">
                The actual photo captured at departure is transmitted directly to {trip?.trusted_contact_name} so they can identify the car make, model, and registration immediately.
              </p>
            </div>

            {/* Simulated SMS Alert Screen */}
            {/* Simulated SMS Alert Screen & Live Phone Dispatch */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block font-bold">Primary Contact Recipient</span>
                  <span className="text-sm font-bold text-slate-200">{trip?.trusted_contact_name}</span>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Dispatched
                </span>
              </div>

              {/* Live Demo Phone Input */}
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-700/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <span>📲 Send SOS Alert to YOUR Mobile Number:</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                    Live Demo
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={customPhone}
                    onChange={(e) => {
                      setCustomPhone(e.target.value);
                      localStorage.setItem('hitchsafe_demo_user_phone', e.target.value);
                    }}
                    placeholder="+91 98765 43210"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const alertText = `🚨 EMERGENCY ALERT (HitchSafe): ${trip?.user_name} has NOT reached ${trip?.destination_name}. Vehicle: ${trip?.vehicle_plate} (Photo: ${effectivePlatePhoto}). Last GPS: ${trip?.last_known_lat?.toFixed(5)}, ${trip?.last_known_lon?.toFixed(5)}. Police Sector: ${stationName}. Track: ${window.location.origin}/track/${trip?.token}`;
                      window.open(`sms:${customPhone}?body=${encodeURIComponent(alertText)}`, '_blank');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition shadow"
                  >
                    <span>📱 Send Real SMS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cleanDigits = customPhone.replace(/[^0-9]/g, '');
                      const alertText = `🚨 EMERGENCY ALERT (HitchSafe): ${trip?.user_name} has NOT reached ${trip?.destination_name}.\n\nVehicle Plate: ${trip?.vehicle_plate}\nPlate Photo Evidence: ${effectivePlatePhoto}\nLast GPS: ${trip?.last_known_lat?.toFixed(5)}, ${trip?.last_known_lon?.toFixed(5)}\nNearest Police: ${stationName}\nLive Telemetry: ${window.location.origin}/track/${trip?.token}`;
                      window.open(`https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(alertText)}`, '_blank');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition shadow"
                  >
                    <span>🟢 Send WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Message Preview Box */}
              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-700/80 text-xs text-slate-200 space-y-2 font-mono">
                <div className="text-rose-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> EMERGENCY SAFETY ALERT (HitchSafe)
                </div>
                <p className="leading-relaxed text-slate-300 text-[11px]">
                  <strong>{trip?.user_name}</strong> has NOT arrived at destination <strong>{trip?.destination_name}</strong> by scheduled arrival deadline.
                </p>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-[11px] space-y-1">
                  <div>🚗 <strong>Vehicle:</strong> {trip?.vehicle_plate} (Photo attached)</div>
                  <div>📍 <strong>Last GPS:</strong> {trip?.last_known_lat?.toFixed(5)}, {trip?.last_known_lon?.toFixed(5)}</div>
                  <div>🚓 <strong>Nearest Police:</strong> {stationName}</div>
                </div>
                <div className="pt-0.5">
                  <span className="text-[10px] text-emerald-400">Live Telemetry Link:</span>
                  <div className="text-[10px] text-slate-400 truncate">{window.location.origin}/track/{trip?.token}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`${window.location.origin}/track/${trip?.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span>Open Tracking Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const alertText = `🚨 EMERGENCY ALERT (HitchSafe): ${trip?.user_name} has NOT reached ${trip?.destination_name}. Vehicle: ${trip?.vehicle_plate} (Photo: ${effectivePlatePhoto}). Last GPS: ${trip?.last_known_lat?.toFixed(5)}, ${trip?.last_known_lon?.toFixed(5)}. Police Sector: ${stationName}. Track: ${window.location.origin}/track/${trip?.token}`;
                    navigator.clipboard.writeText(alertText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Police Station Dispatch Dossier */}
        {activeTab === 'police' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Police Evidence Dossier */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-rose-900/60 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-[10px] uppercase text-rose-400 font-bold block">Assigned Law Enforcement Sector</span>
                  <span className="text-sm font-bold text-slate-100">{stationName}</span>
                </div>
                <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-700 px-2 py-0.5 rounded font-bold">
                  HIGHWAY PATROL SOS
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Jurisdiction:</span>
                  <span className="text-slate-200 font-semibold">{policeDossier?.police_jurisdiction || 'NH 44 North Highway Sector'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Station Hotline:</span>
                  <a href={`tel:${policePhone}`} className="text-rose-400 font-bold hover:underline">{policePhone}</a>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Control Room Dial:</span>
                  <span className="text-slate-200 font-bold">{controlRoom}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">Active Intercept Unit:</span>
                  <span className="text-amber-400 font-bold">{highwayUnit}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Distance to Station:</span>
                  <span className="text-slate-200 font-semibold">{policeDossier?.distance_to_station_km || '1.8'} km</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <a
                  href={`tel:112`}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call 112 Control Room</span>
                </a>
                <button
                  onClick={copyDossier}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied' : 'Copy FIR'}</span>
                </button>
              </div>
            </div>

            {/* Police Dossier Telemetry & Plate Photo Container */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between pb-2 border-b border-slate-800">
                <span>Vehicle Evidence Transmitted to Police</span>
                <span className="text-emerald-400 font-mono text-[10px]">{trip?.vehicle_plate}</span>
              </div>

              {/* Photo with Police Evidence Frame */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-rose-600/70">
                <img
                  src={effectivePlatePhoto}
                  alt="Vehicle Number Plate"
                  className="w-full h-44 object-cover"
                />
                <div className="absolute top-2 left-2 bg-rose-950/90 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-700">
                  POLICE EVIDENCE TAG #EVD-881
                </div>
              </div>

              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 text-[11px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Traveler:</span>
                  <span className="text-slate-200 font-bold">{trip?.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Primary Contact:</span>
                  <span className="text-slate-200">{trip?.trusted_contact_name} ({trip?.trusted_contact_phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Missed Destination:</span>
                  <span className="text-rose-300 font-bold">{trip?.destination_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expected Time:</span>
                  <span className="text-slate-300">{new Date(trip?.expected_arrival_time).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
