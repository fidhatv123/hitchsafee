import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Shield, AlertTriangle, Battery, Navigation, Clock, CheckCircle2, PhoneCall, Calculator, Share2, Compass, AlertOctagon, RotateCcw, Radio } from 'lucide-react';
import L from 'leaflet';
import PoliceDispatchModal from './PoliceDispatchModal';

export default function LiveMonitoring({ trip, onTripCompleted, onOpenCalculator }) {
  const [currentTrip, setCurrentTrip] = useState(trip);
  const [currentPos, setCurrentPos] = useState({
    lat: trip.last_known_lat || trip.origin_lat,
    lon: trip.last_known_lon || trip.origin_lon,
    speed: trip.last_known_speed || 48.0,
    battery: trip.battery_level || 95
  });
  const [countdown, setCountdown] = useState(trip.countdown_seconds_remaining || null);
  const [status, setStatus] = useState(trip.deviation_status || 'OK');
  const [distanceFromRoute, setDistanceFromRoute] = useState(0);
  const [adaptiveRate, setAdaptiveRate] = useState(15);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPoliceModal, setShowPoliceModal] = useState(false);
  const [latestPoliceDossier, setLatestPoliceDossier] = useState(trip.police_dossier || null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const routeLayerRef = useRef(null);

  // Setup Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstance.current) {
      const map = L.map(mapRef.current).setView([currentPos.lat, currentPos.lon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap | HitchSafe Live Monitor'
      }).addTo(map);
      mapInstance.current = map;
    }

    const map = mapInstance.current;

    // Draw planned route
    if (trip.expected_route && trip.expected_route.length > 0 && !routeLayerRef.current) {
      const routePolyline = L.polyline(trip.expected_route, {
        color: '#10b981',
        weight: 5,
        opacity: 0.85
      }).addTo(map);
      routeLayerRef.current = routePolyline;
      map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
    }

    // Vehicle position marker
    if (!markerRef.current) {
      const vehicleIcon = L.divIcon({
        className: 'vehicle-live-marker',
        html: `
          <div style="position: relative; width: 28px; height: 28px;">
            <div style="position: absolute; inset: -8px; background: rgba(16, 185, 129, 0.4); border-radius: 50%;" class="radar-ping"></div>
            <div style="background: #10b981; border: 3px solid white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
              <span style="font-size: 14px;">🚗</span>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      markerRef.current = L.marker([currentPos.lat, currentPos.lon], { icon: vehicleIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng([currentPos.lat, currentPos.lon]);
    }
  }, []);

  // Update vehicle marker on position changes
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([currentPos.lat, currentPos.lon]);
    }
  }, [currentPos]);

  // Periodic Countdown Ticker when in COUNTDOWN mode
  useEffect(() => {
    let interval = null;
    if (status === 'COUNTDOWN') {
      interval = setInterval(async () => {
        try {
          const res = await api.tickCountdown(trip.id, 1);
          setCountdown(res.countdown_seconds_remaining);
          if (res.escalated) {
            setStatus('ALERT_SENT');
            setLatestPoliceDossier(res.police_dossier);
            setShowPoliceModal(true);
          }
        } catch (err) {
          console.error('Tick failed', err);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, trip.id]);

  // Check alert queue status
  useEffect(() => {
    const checkQueue = async () => {
      try {
        const qStatus = await api.getAlertQueueStatus();
        setPendingQueueCount(qStatus.total_pending || 0);
      } catch (e) {
        console.error(e);
      }
    };
    checkQueue();
    const qInterval = setInterval(checkQueue, 5000);
    return () => clearInterval(qInterval);
  }, []);

  const handleResolveOk = async () => {
    try {
      await api.resolveOk(trip.id, 'User confirmed safe');
      setStatus('OK');
      setCountdown(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSnooze = async () => {
    try {
      const res = await api.snoozeTrip(trip.id);
      if (res.success) {
        setCountdown(res.countdown_seconds_remaining);
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateMissedDestination = async () => {
    try {
      const res = await api.triggerMissedDestination(trip.id);
      setStatus('ALERT_SENT');
      setLatestPoliceDossier(res.police_dossier);
      setShowPoliceModal(true);
    } catch (err) {
      console.error('Missed destination trigger failed', err);
    }
  };

  const handleSafeArrival = async () => {
    try {
      await api.endTrip(trip.id);
      onTripCompleted(trip);
    } catch (err) {
      console.error(err);
    }
  };

  const copyTrackingLink = () => {
    const url = `${window.location.origin}/track/${trip.token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full gap-4 p-3 md:p-6 relative">
      {/* Top Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold text-emerald-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {trip.vehicle_plate}
              </span>
              <span className="text-xs text-slate-400">heading to</span>
              <span className="text-xs font-semibold text-slate-200">{trip.destination_name}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Primary Contact: <strong>{trip.trusted_contact_name}</strong></span>
              <span>•</span>
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <Radio className="w-3 h-3" /> Police Pre-Linked: Hebbal Highway Sector (112)
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Emergency Simulation */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
            <span>{currentPos.battery}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentPos.speed.toFixed(0)} km/h</span>
          </div>

          {/* Trigger Missed Destination SOS */}
          <button
            onClick={handleSimulateMissedDestination}
            className="flex items-center gap-1.5 text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl border border-rose-500 transition shadow-lg shadow-rose-950"
            title="Simulate destination missed overdue alert"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Simulate Missed Destination</span>
          </button>

          <button
            onClick={copyTrackingLink}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
          </button>

          <button
            onClick={onOpenCalculator}
            className="flex items-center gap-1.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-amber-400 px-3 py-1.5 rounded-xl border border-amber-500/30 transition"
            title="Open Disguised Distress Screen"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Calculator</span>
          </button>
        </div>
      </div>

      {/* Map & Telemetry Canvas */}
      <div className="flex-1 min-h-[380px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl">
        <div ref={mapRef} className="w-full h-full min-h-[380px]"></div>

        {/* Live Overlay HUD */}
        <div className="absolute top-4 left-4 z-[1000] bg-slate-950/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 text-xs shadow-xl space-y-1.5 max-w-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Adaptive GPS Sampling:</span>
            <span className="font-semibold text-emerald-400">{adaptiveRate}s interval</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Destination Progress:</span>
            <span className="font-semibold text-indigo-300">Monitored</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Safety Net Status:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
              status === 'OK' ? 'bg-emerald-950 text-emerald-300' :
              status === 'COUNTDOWN' ? 'bg-amber-950 text-amber-300 animate-pulse' :
              'bg-rose-950 text-rose-300'
            }`}>
              {status === 'OK' ? 'ACTIVE & MONITORED' : status === 'COUNTDOWN' ? 'DEVIATION DETECTED' : 'POLICE & CONTACT ALERTED'}
            </span>
          </div>
        </div>

        {/* Bottom Floating Safe Arrival Button */}
        <div className="absolute bottom-6 inset-x-6 z-[1000] flex justify-center">
          <button
            onClick={handleSafeArrival}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-8 py-3.5 rounded-2xl text-base shadow-2xl shadow-emerald-950/80 transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>I Have Arrived Safely (End Ride)</span>
          </button>
        </div>
      </div>

      {/* Countdown Warning Modal */}
      {status === 'COUNTDOWN' && (
        <div className="fixed inset-0 z-[3000] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-bounce-short">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-8 h-8 animate-pulse text-amber-400" />
              <div>
                <h2 className="text-xl font-black text-slate-100">Are You Okay?</h2>
                <p className="text-xs text-amber-300">Vehicle drift detected beyond safety limits</p>
              </div>
            </div>

            <div className="text-center py-4 bg-slate-950/80 rounded-2xl border border-amber-500/30">
              <span className="text-xs text-slate-400 block mb-1">Escalating to primary contact & police in:</span>
              <span className="text-5xl font-black font-mono text-amber-400">
                {countdown !== null ? countdown : 45}<span className="text-xl">s</span>
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Plate photo and last known coordinates will be transmitted to Priya and Nearest Police Station.
              </span>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleResolveOk}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl text-base transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Yes, I Am Okay! (Cancel Alert)</span>
              </button>

              <button
                onClick={handleSnooze}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition"
              >
                Snooze (+2 minutes for fuel/traffic stop)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalated Alert Banner with Button to Inspect Evidence Dossier */}
      {status === 'ALERT_SENT' && (
        <div className="fixed top-6 inset-x-6 z-[3000] max-w-xl mx-auto bg-rose-950/95 border-2 border-rose-500 p-4 rounded-2xl shadow-2xl text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-7 h-7 text-rose-400 shrink-0" />
            <div className="text-xs">
              <strong className="block text-sm text-white">Emergency Dual Broadcast Dispatched!</strong>
              SMS with <strong>number plate photo</strong> sent to <strong>{trip.trusted_contact_name}</strong> and details transmitted to the <strong>Nearest Police Station</strong>.
            </div>
          </div>
          <button
            onClick={() => setShowPoliceModal(true)}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3.5 py-2 rounded-xl font-bold shrink-0 transition"
          >
            View Alerts
          </button>
        </div>
      )}

      {/* Police & Primary Contact Evidence Modal */}
      {showPoliceModal && (
        <PoliceDispatchModal
          trip={trip}
          policeDossier={latestPoliceDossier}
          platePhotoUrl={trip.plate_photo_data || trip.plate_photo_path}
          onClose={() => setShowPoliceModal(false)}
        />
      )}
    </div>
  );
}
