import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Play, Pause, SkipForward, AlertTriangle, Wifi, WifiOff, RotateCcw, ShieldAlert, CheckCircle, Navigation, Clock, MessageSquare, ExternalLink, Radio, Camera } from 'lucide-react';
import L from 'leaflet';
import PoliceDispatchModal from './PoliceDispatchModal';

export default function DemoSimulator({ activeTrip, onSelectDemoTrip, onOpenTrackingLink }) {
  const [demoRouteData, setDemoRouteData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isDeviating, setIsDeviating] = useState(false);
  const [isStationary, setIsStationary] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [queueStatus, setQueueStatus] = useState({ pending_count: 0, last_synced: 'Now' });
  const [simulatedTrip, setSimulatedTrip] = useState(null);
  const [demoScriptStep, setDemoScriptStep] = useState(1);
  const [showPoliceModal, setShowPoliceModal] = useState(false);
  const [modalPoliceDossier, setModalPoliceDossier] = useState(null);
  const [demoPhone, setDemoPhone] = useState(() => {
    return localStorage.getItem('hitchsafe_demo_user_phone') || '+91 98450 12345';
  });

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const onTrackLineRef = useRef(null);
  const deviationLineRef = useRef(null);

  useEffect(() => {
    loadDemoRoute();
    refreshAlerts();
    const interval = setInterval(refreshAlerts, 2500);
    return () => clearInterval(interval);
  }, []);

  const loadDemoRoute = async () => {
    try {
      const data = await api.getDemoRoute();
      setDemoRouteData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAlerts = async () => {
    try {
      const alerts = await api.getRecentAlerts();
      setRecentAlerts(alerts);
      const q = await api.getAlertQueueStatus();
      setQueueStatus(q);
    } catch (e) {
      console.error(e);
    }
  };

  // Initialize Simulator Map
  useEffect(() => {
    if (!mapRef.current || !demoRouteData) return;

    if (!mapInstance.current) {
      const map = L.map(mapRef.current).setView([13.0358, 77.5970], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap | HitchSafe Route Replay Engine'
      }).addTo(map);
      mapInstance.current = map;
    }

    const map = mapInstance.current;

    if (!onTrackLineRef.current && demoRouteData.on_track_route) {
      const poly = L.polyline(demoRouteData.on_track_route, {
        color: '#10b981',
        weight: 6,
        opacity: 0.85
      }).addTo(map);
      onTrackLineRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    }

    if (!deviationLineRef.current && demoRouteData.deviation_branch) {
      const devPoly = L.polyline(demoRouteData.deviation_branch, {
        color: '#f43f5e',
        weight: 5,
        dashArray: '8, 8',
        opacity: 0.8
      }).addTo(map);
      deviationLineRef.current = devPoly;
    }

    const icon = L.divIcon({
      className: 'sim-vehicle-icon',
      html: `
        <div style="background-color: ${isDeviating ? '#f43f5e' : '#10b981'}; border: 3px solid white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
          🚗
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const currentCoords = getCurrentCoords();
    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker(currentCoords, { icon }).addTo(map);
    } else {
      vehicleMarkerRef.current.setIcon(icon);
      vehicleMarkerRef.current.setLatLng(currentCoords);
    }
  }, [demoRouteData, isDeviating]);

  const getCurrentCoords = () => {
    if (!demoRouteData) return [13.0358, 77.5970];
    if (isDeviating) {
      const branch = demoRouteData.deviation_branch;
      return branch[Math.min(currentIndex, branch.length - 1)];
    } else {
      const route = demoRouteData.on_track_route;
      return route[Math.min(currentIndex, route.length - 1)];
    }
  };

  useEffect(() => {
    let timer = null;
    if (isPlaying) {
      timer = setInterval(() => {
        handleStepForward();
      }, 2000 / playbackSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, currentIndex, isDeviating, playbackSpeed, demoRouteData, simulatedTrip]);

  const handleStepForward = async () => {
    if (!demoRouteData) return;
    const maxLen = isDeviating ? demoRouteData.deviation_branch.length : demoRouteData.on_track_route.length;
    const nextIdx = Math.min(currentIndex + 1, maxLen - 1);
    setCurrentIndex(nextIdx);

    const coords = isDeviating ? demoRouteData.deviation_branch[nextIdx] : demoRouteData.on_track_route[nextIdx];
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(coords);
    }

    const tripId = simulatedTrip ? simulatedTrip.id : (activeTrip ? activeTrip.id : null);
    if (tripId) {
      try {
        const pingRes = await api.sendGPSPing(tripId, {
          trip_id: tripId,
          lat: coords[0],
          lon: coords[1],
          speed_kmh: isStationary ? 0.0 : 55.0,
          accuracy_m: 6.0,
          battery_pct: 94,
          is_offline_cached: !isNetworkOnline
        });
        if (pingRes.deviation_status === 'COUNTDOWN') {
          setDemoScriptStep(3);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleInjectDeviation = async () => {
    setIsDeviating(true);
    setCurrentIndex(1);
    setDemoScriptStep(3);
    const tripId = simulatedTrip ? simulatedTrip.id : (activeTrip ? activeTrip.id : null);
    if (tripId && demoRouteData) {
      const offCoords = demoRouteData.deviation_branch[2];
      await api.sendGPSPing(tripId, {
        trip_id: tripId,
        lat: offCoords[0],
        lon: offCoords[1],
        speed_kmh: 40.0,
        battery_pct: 92
      });
      refreshAlerts();
    }
  };

  const handleSimulateMissedDestination = async () => {
    const tripId = simulatedTrip ? simulatedTrip.id : (activeTrip ? activeTrip.id : null);
    if (!tripId) {
      await handleCreateDemoTrip();
      return;
    }
    try {
      const res = await api.triggerMissedDestination(tripId);
      setModalPoliceDossier(res.police_dossier);
      setShowPoliceModal(true);
      setDemoScriptStep(4);
      refreshAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleNetwork = async () => {
    const newStatus = !isNetworkOnline;
    setIsNetworkOnline(newStatus);
    await api.toggleSimulatedNetwork(newStatus);
    if (newStatus) {
      await api.syncOfflineQueue();
      setDemoScriptStep(5);
    } else {
      setDemoScriptStep(5);
    }
    refreshAlerts();
  };

  const handleCreateDemoTrip = async () => {
    try {
      const trip = await api.createTrip({
        user_name: 'Aarav Nair (Verified Hitchhiker)',
        user_id: 'user_demo_aarav',
        vehicle_plate: 'KA 04 MB 7821',
        plate_photo_path: 'plate_ka04_evidence.jpg',
        plate_photo_data: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80',
        origin_lat: 13.0358,
        origin_lon: 77.5970,
        origin_name: 'Hebbal Flyover (NH 44 North)',
        destination_lat: 13.2450,
        destination_lon: 77.6750,
        destination_name: 'Kempegowda Airport Gate',
        expected_arrival_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        buffer_minutes: 15,
        trusted_contact_name: 'Priya Nair (Partner)',
        trusted_contact_phone: demoPhone,
        expected_route: demoRouteData?.on_track_route
      });
      setSimulatedTrip(trip);
      if (onSelectDemoTrip) onSelectDemoTrip(trip);
      setDemoScriptStep(2);
      refreshAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const activeOrSimTrip = simulatedTrip || activeTrip;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full gap-4 p-3 md:p-6">
      {/* Simulation Map & Live Player */}
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[400px]">
        {/* Simulator Control Bar */}
        <div className="bg-slate-950/95 border-b border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3 z-[1000]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pause' : 'Play Route'}</span>
            </button>
            <button
              onClick={handleStepForward}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center gap-1 transition"
            >
              <SkipForward className="w-4 h-4" />
              <span>Step</span>
            </button>
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-400">
              <span>Speed:</span>
              {[1, 2, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-0.5 rounded font-bold ${playbackSpeed === s ? 'text-emerald-400 bg-slate-800' : 'text-slate-500'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Injectable Events */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateMissedDestination}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-500 bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-950"
              title="Simulate user not reaching destination"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>🚨 Missed Destination SOS</span>
            </button>

            <button
              onClick={handleInjectDeviation}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                isDeviating ? 'bg-rose-950 text-rose-300 border-rose-700' : 'bg-slate-800 hover:bg-rose-950 text-rose-300 border-rose-900/50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Inject Deviation</span>
            </button>

            <button
              onClick={handleToggleNetwork}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                isNetworkOnline ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-amber-950 text-amber-300 border-amber-700 animate-pulse'
              }`}
            >
              {isNetworkOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isNetworkOnline ? 'Online' : 'Offline'}</span>
            </button>
          </div>
        </div>

        {/* Map View */}
        <div ref={mapRef} className="flex-1 w-full min-h-[350px]"></div>

        {/* Replay Status Bar */}
        <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Bengaluru NH 44 Corridor $\to$ Destination: Kempegowda Airport Gate</span>
          </div>
          <div>
            Status: <strong className={isDeviating ? 'text-rose-400' : 'text-emerald-400'}>
              {isDeviating ? 'DRIFTING OFF ROUTE' : 'ON HIGHWAY TRACK'}
            </strong>
          </div>
        </div>
      </div>

      {/* Demo Script Walkthrough & Live Dual SMS/Police Dispatch Feed */}
      <div className="w-full lg:w-[480px] flex flex-col gap-4 overflow-y-auto">
        {/* Step-by-Step Guide */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-black text-slate-200 flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" /> End-to-End Safety Flow
            </span>
            {activeOrSimTrip && (
              <button
                onClick={() => setShowPoliceModal(true)}
                className="text-[10px] text-rose-300 bg-rose-950 border border-rose-800 px-2.5 py-1 rounded-lg font-bold hover:bg-rose-900"
              >
                Inspect Alerts & Photo
              </button>
            )}
          </h3>

          <div className="space-y-2 text-xs">
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${demoScriptStep === 1 ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
              <span className="font-bold shrink-0">1.</span>
              <span><strong>Map & Corridor:</strong> Search destination e.g. Airport $\to$ view nearby spots along NH 44.</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${demoScriptStep === 2 ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
              <span className="font-bold shrink-0">2.</span>
              <div className="flex-1">
                <span><strong>Plate Photo & Start:</strong> Scan plate KA 04 MB 7821.</span>
                <div className="mt-2 bg-slate-900 p-2 rounded-xl border border-slate-700/80 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-slate-300 font-semibold shrink-0">📲 Send SOS to My Number:</span>
                  <input
                    type="tel"
                    value={demoPhone}
                    onChange={(e) => {
                      setDemoPhone(e.target.value);
                      localStorage.setItem('hitchsafe_demo_user_phone', e.target.value);
                    }}
                    placeholder="+91 98765 43210"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] text-emerald-300 font-mono font-bold w-36 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {!activeOrSimTrip && (
                  <button
                    onClick={handleCreateDemoTrip}
                    className="mt-2 block bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg text-[11px]"
                  >
                    Quick Start Demo Trip
                  </button>
                )}
              </div>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${demoScriptStep === 3 ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
              <span className="font-bold shrink-0">3.</span>
              <span><strong>Deviation:</strong> Inject route deviation $\to$ countdown warning appears.</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${demoScriptStep === 4 ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
              <span className="font-bold shrink-0">4.</span>
              <span><strong>Missed Destination:</strong> Alert with <strong>number plate photo</strong> sent to Primary Person & Nearest Police Station!</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${demoScriptStep === 5 ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
              <span className="font-bold shrink-0">5.</span>
              <span><strong>Offline Queue:</strong> Toggle network offline $\to$ trigger alert $\to$ restore and watch delivery.</span>
            </div>
          </div>
        </div>

        {/* Live SMS & Police Dispatch Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex-1 flex flex-col gap-3 min-h-[300px]">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" /> Dispatched Safety Broadcasts
            </h3>
            {queueStatus.pending_count > 0 && (
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold animate-pulse">
                {queueStatus.pending_count} queued locally
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px]">
            {recentAlerts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No alerts dispatched yet. Click "Missed Destination SOS" to trigger simultaneous primary person and police station alerts.
              </div>
            ) : (
              recentAlerts.map((alt, idx) => {
                const isPolice = alt.recipient_type === 'POLICE_STATION' || alt.alert_type?.includes('POLICE');
                return (
                  <div key={idx} className={`p-3 rounded-2xl border space-y-1.5 text-xs ${
                    isPolice ? 'bg-slate-950 border-rose-800/80 shadow-md' : 'bg-slate-950 border-slate-800/80'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isPolice ? 'bg-rose-950 text-rose-300 border border-rose-700' :
                        alt.alert_type?.includes('ESCALATION') ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {isPolice ? '🚓 POLICE DISPATCH' : alt.alert_type}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(alt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-slate-300 font-mono text-[11px] leading-relaxed">
                      {alt.message}
                    </div>

                    {alt.plate_photo_url && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-300 font-semibold">Photo of number plate attached</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-400">
                      <span>To: <strong>{alt.recipient}</strong></span>
                      <div className="flex items-center gap-2">
                        {isPolice && (
                          <button
                            onClick={() => {
                              setModalPoliceDossier(alt.police_dossier);
                              setShowPoliceModal(true);
                            }}
                            className="text-rose-400 font-bold hover:underline"
                          >
                            View Evidence Dossier
                          </button>
                        )}
                        {alt.tracking_link && (
                          <button
                            onClick={() => onOpenTrackingLink(alt.tracking_link)}
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            Live Link <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Police Evidence Modal */}
      {showPoliceModal && activeOrSimTrip && (
        <PoliceDispatchModal
          trip={activeOrSimTrip}
          policeDossier={modalPoliceDossier}
          platePhotoUrl={activeOrSimTrip.plate_photo_data || activeOrSimTrip.plate_photo_path}
          onClose={() => setShowPoliceModal(false)}
        />
      )}
    </div>
  );
}
