import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Shield, MapPin, Battery, PhoneCall, Clock, Car, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import L from 'leaflet';

export default function LiveTrackingWeb({ token, onClose }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const routeRef = useRef(null);

  useEffect(() => {
    loadTrackingData();
    const interval = setInterval(loadTrackingData, 4000);
    return () => clearInterval(interval);
  }, [token]);

  const loadTrackingData = async () => {
    try {
      const data = await api.getTripByToken(token);
      setTrip(data);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Tracking session expired or not found.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mapRef.current || !trip || !trip.is_active || !trip.last_known_lat) return;

    if (!mapInstance.current) {
      const map = L.map(mapRef.current).setView([trip.last_known_lat, trip.last_known_lon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap | HitchSafe Live Contact Tracking'
      }).addTo(map);
      mapInstance.current = map;
    }

    const map = mapInstance.current;

    // Draw planned route
    if (trip.expected_route && trip.expected_route.length > 0 && !routeRef.current) {
      const poly = L.polyline(trip.expected_route, { color: '#10b981', weight: 5, opacity: 0.8 }).addTo(map);
      routeRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    }

    // Vehicle marker
    const iconHtml = `
      <div style="background-color: #10b981; border: 3px solid white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
        🚗
      </div>
    `;
    const icon = L.divIcon({ className: 'contact-vehicle-icon', html: iconHtml, iconSize: [32, 32], iconAnchor: [16, 16] });

    if (!markerRef.current) {
      markerRef.current = L.marker([trip.last_known_lat, trip.last_known_lon], { icon }).addTo(map);
    } else {
      markerRef.current.setLatLng([trip.last_known_lat, trip.last_known_lon]);
    }
  }, [trip]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <div className="text-slate-300 font-medium text-sm">Connecting to secure live telemetry...</div>
          <div className="text-slate-500 text-xs">No app install required for trusted contacts</div>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <Shield className="w-12 h-12 text-slate-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-200">Session Closed or Expired</h2>
          <p className="text-xs text-slate-400">
            For traveler privacy, live location links expire immediately once a trip is completed or deleted.
          </p>
          {onClose && (
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-200 text-xs rounded-xl hover:bg-slate-700">
              Back to Main App
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between sticky top-0 z-[1000]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              <span>HitchSafe Live Tracking</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                {trip.status}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Monitoring <strong>{trip.user_name}</strong>'s active ride
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="tel:112"
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-lg shadow-rose-950"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call 112 (Police)</span>
          </a>
          {onClose && (
            <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">
              Close
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 max-w-6xl mx-auto w-full">
        {/* Live Map */}
        <div className="flex-1 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden min-h-[380px] shadow-2xl relative">
          <div ref={mapRef} className="w-full h-full min-h-[380px]"></div>
          {trip.deviation_status !== 'OK' && (
            <div className="absolute top-3 left-3 right-3 z-[1000] bg-rose-950/90 border border-rose-600 text-rose-200 p-3 rounded-2xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <strong>Safety Alert:</strong> Route deviation or unusual stationary stop detected for vehicle {trip.vehicle_plate}.
              </div>
            </div>
          )}
        </div>

        {/* Telemetry Card */}
        <div className="w-full md:w-96 flex flex-col gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-800">
              <Car className="w-4 h-4 text-emerald-400" /> Vehicle Telemetry
            </h3>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-slate-500">License Plate</span>
                <div className="text-xl font-mono font-black text-emerald-400">{trip.vehicle_plate}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-500">Phone Battery</span>
                <div className="text-sm font-bold text-slate-200 flex items-center gap-1 justify-end">
                  <Battery className="w-4 h-4 text-emerald-400" /> {trip.battery_level}%
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Destination:</span>
                <span className="text-slate-200 font-semibold">{trip.destination_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Expected Arrival:</span>
                <span className="text-slate-200 font-semibold">
                  {new Date(trip.expected_arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Speed:</span>
                <span className="text-slate-200 font-semibold">{trip.last_known_speed || 0} km/h</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Last Ping:</span>
                <span className="text-slate-200 font-semibold">
                  {trip.last_known_time ? new Date(trip.last_known_time).toLocaleTimeString() : 'Live'}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 leading-snug">
              🔒 <strong>Privacy Guard:</strong> You have been invited as a trusted safety contact. This tracking link is temporary and automatically self-destructs when {trip.user_name} completes the ride.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
