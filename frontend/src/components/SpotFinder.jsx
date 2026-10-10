import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { MapPin, Navigation, Star, Clock, Shield, AlertTriangle, Bus, Sparkles, ExternalLink, Flag, Info, Search, Compass, CheckCircle2, ArrowRight } from 'lucide-react';
import L from 'leaflet';

export default function SpotFinder({ onSelectSpotForRide, currentUser, onOpenAuth }) {
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [predHour, setPredHour] = useState(new Date().getHours());
  const [predDay, setPredDay] = useState(new Date().getDay());
  const [destinationInput, setDestinationInput] = useState('');
  const [searchedDestination, setSearchedDestination] = useState(null);
  const [corridorRoute, setCorridorRoute] = useState(null);
  const [searchingCorridor, setSearchingCorridor] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagSuccess, setFlagSuccess] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const corridorLineRef = useRef(null);

  const destinationPresets = [
    { name: "Kempegowda Airport (NH 44 North)", lat: 13.2450, lon: 77.6750 },
    { name: "Nelamangala / Hassan (NH 48 West)", lat: 13.0964, lon: 77.3884 },
    { name: "Attibele / Chennai (NH 44 South)", lat: 12.7801, lon: 77.7682 },
    { name: "Mysuru / Wayanad (NH 766)", lat: 12.1285, lon: 76.6853 },
    { name: "Mumbai / Pune Expressway", lat: 19.0222, lon: 73.0991 }
  ];

  useEffect(() => {
    loadAllSpots();
  }, []);

  const loadAllSpots = async () => {
    try {
      const data = await api.getSpots();
      setSpots(data);
      if (data.length > 0 && !selectedSpot) {
        handleSelectSpot(data[0]);
      }
    } catch (err) {
      console.error('Failed to load spots', err);
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstance.current) {
      const map = L.map(mapRef.current).setView([13.0358, 77.5970], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Hitchmap (ODbL)'
      }).addTo(map);
      mapInstance.current = map;
    }

    const map = mapInstance.current;

    // Clear old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    // Add spot markers
    spots.forEach(s => {
      const isSelected = selectedSpot?.id === s.id;
      const isCorridorSpot = s.distance_to_corridor_km !== undefined && s.distance_to_corridor_km !== null;

      const markerColor = isSelected ? '#10b981' : (isCorridorSpot ? '#6366f1' : '#3b82f6');
      const customIcon = L.divIcon({
        className: 'custom-spot-marker',
        html: `
          <div style="background-color: ${markerColor}; border: ${isSelected ? '3px solid #ffffff' : '2px solid #ffffff'}; width: ${isSelected ? '36px' : '30px'}; height: ${isSelected ? '36px' : '30px'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); color: white; font-weight: bold; font-size: 11px;">
            ${s.avg_wait_min}m
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([s.lat, s.lon], { icon: customIcon }).addTo(map);
      marker.on('click', () => {
        handleSelectSpot(s);
      });
      markersRef.current.push(marker);
    });

  }, [spots, selectedSpot]);

  // Draw or update Corridor Route polyline
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    if (corridorLineRef.current) {
      map.removeLayer(corridorLineRef.current);
      corridorLineRef.current = null;
    }

    if (corridorRoute && corridorRoute.length > 0) {
      const poly = L.polyline(corridorRoute, {
        color: '#6366f1',
        weight: 6,
        opacity: 0.85
      }).addTo(map);
      corridorLineRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [40, 40] });
    }
  }, [corridorRoute]);

  const handleSelectSpot = async (spot) => {
    setSelectedSpot(spot);
    if (mapInstance.current) {
      mapInstance.current.flyTo([spot.lat, spot.lon], 13, { duration: 1.0 });
    }
    setLoadingPrediction(true);
    try {
      const pred = await api.predictWaitTime({
        spot_id: spot.id,
        lat: spot.lat,
        lon: spot.lon,
        region: spot.region,
        time_of_day_hour: predHour,
        day_of_week: predDay,
        road_type: spot.road_type,
        has_petrol_station: spot.features?.includes('petrol_pump'),
        has_cctv: spot.features?.includes('cctv'),
        has_street_light: spot.features?.includes('well_lit'),
        traffic_density: 'moderate'
      });
      setPrediction(pred);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPrediction(false);
    }
  };

  const handleSearchDestination = async (destObj) => {
    const dest = destObj || destinationPresets.find(p => p.name.toLowerCase().includes(destinationInput.toLowerCase())) || destinationPresets[0];
    setDestinationInput(dest.name);
    setSearchedDestination(dest.name);
    setSearchingCorridor(true);

    try {
      const result = await api.findSpotsAlongCorridor({
        origin_lat: 13.0358,
        origin_lon: 77.5970,
        dest_lat: dest.lat,
        dest_lon: dest.lon,
        dest_name: dest.name
      });

      setCorridorRoute(result.route_coordinates);
      setSpots(result.spots);
      if (result.spots && result.spots.length > 0) {
        handleSelectSpot(result.spots[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingCorridor(false);
    }
  };

  const recomputePrediction = async (hour, day) => {
    if (!selectedSpot) return;
    setPredHour(hour);
    setPredDay(day);
    setLoadingPrediction(true);
    try {
      const pred = await api.predictWaitTime({
        spot_id: selectedSpot.id,
        lat: selectedSpot.lat,
        lon: selectedSpot.lon,
        region: selectedSpot.region,
        time_of_day_hour: hour,
        day_of_week: day,
        road_type: selectedSpot.road_type,
        has_petrol_station: selectedSpot.features?.includes('petrol_pump'),
        has_cctv: selectedSpot.features?.includes('cctv'),
        has_street_light: selectedSpot.features?.includes('well_lit'),
        traffic_density: 'moderate'
      });
      setPrediction(pred);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPrediction(false);
    }
  };

  const handleFlagSubmit = async () => {
    if (!flagReason || !selectedSpot) return;
    try {
      await api.flagSpot(selectedSpot.id, flagReason);
      setFlagSuccess(true);
      setTimeout(() => {
        setFlagSuccess(false);
        setFlagModalOpen(false);
        setFlagReason('');
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full gap-4 p-3 md:p-6 relative">
      {/* Map Section */}
      <div className="flex-1 flex flex-col bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative min-h-[420px] lg:min-h-0">
        {/* Floating Destination Search & Corridor Filter Bar */}
        <div className="absolute top-4 inset-x-4 z-[1000] flex flex-col gap-2 max-w-2xl mx-auto">
          <div className="bg-slate-950/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700/80 shadow-2xl flex items-center gap-2">
            <div className="p-2 text-indigo-400">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <input
              type="text"
              placeholder="Enter destination details (e.g. Airport, Mysuru, Nelamangala)..."
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchDestination()}
              className="flex-1 bg-transparent border-none text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              onClick={() => handleSearchDestination()}
              disabled={searchingCorridor}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-md"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{searchingCorridor ? 'Routing...' : 'Find Spots'}</span>
            </button>
          </div>

          {/* Quick Destination Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-none">
            <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0 bg-slate-950/80 px-2 py-0.5 rounded backdrop-blur-md">
              Quick Corridors:
            </span>
            {destinationPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleSearchDestination(preset)}
                className={`text-[11px] whitespace-nowrap px-2.5 py-1 rounded-xl border backdrop-blur-md transition ${
                  searchedDestination === preset.name
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-950/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                {preset.name.split(' ')[0]} {preset.name.includes('Airport') ? '✈️' : '🛣️'}
              </button>
            ))}
          </div>

          {searchedDestination && (
            <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-200 px-3 py-1.5 rounded-xl text-xs flex items-center justify-between backdrop-blur-md shadow-lg">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Showing <strong>{spots.length} nearby spots</strong> along route to <strong>{searchedDestination}</strong></span>
              </span>
              <button
                onClick={loadAllSpots}
                className="text-[10px] text-emerald-400 hover:underline font-bold"
              >
                Show All
              </button>
            </div>
          )}
        </div>

        {/* Map Canvas */}
        <div ref={mapRef} className="w-full h-full min-h-[420px]"></div>

        {/* Hitchmap License Credit Footer */}
        <div className="bg-slate-950/95 border-t border-slate-800 px-4 py-2 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2 z-[1000]">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Spot data from <strong>Hitchmap</strong> community under <strong>ODbL / CC-BY-SA 4.0</strong> license.</span>
          </div>
          <a href="https://hitchmap.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1">
            hitchmap.com <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Spot Detail & Wait Prediction Sidebar */}
      <div className="w-full lg:w-[460px] flex flex-col gap-4 overflow-y-auto">
        {selectedSpot ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
            {/* Header & Badges */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                    {selectedSpot.road_type.replace('_', ' ')}
                  </span>
                  {selectedSpot.distance_to_corridor_km !== undefined && (
                    <span className="text-[11px] font-bold text-indigo-300 bg-indigo-950/70 border border-indigo-700/60 px-2 py-0.5 rounded">
                      🎯 {selectedSpot.distance_to_corridor_km} km to route
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-100 mt-1">{selectedSpot.name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  {selectedSpot.region}, {selectedSpot.country}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl text-amber-400 text-sm font-semibold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{selectedSpot.rating.toFixed(1)}</span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" /> Avg Wait Time
                </span>
                <span className="text-lg font-bold text-emerald-300">
                  {selectedSpot.avg_wait_min} <span className="text-xs font-normal text-slate-400">mins</span>
                </span>
                <span className="text-[10px] text-slate-500">Median: {selectedSpot.median_wait_min}m</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-blue-400" /> Verified Reports
                </span>
                <span className="text-lg font-bold text-blue-300">
                  {selectedSpot.sample_count} <span className="text-xs font-normal text-slate-400">logged</span>
                </span>
                <span className="text-[10px] text-slate-500">{selectedSpot.source}</span>
              </div>
            </div>

            {/* Pull-off Safety Notes */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/40 text-xs">
              <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Pull-off Safety & Shoulder
              </div>
              <p className="text-slate-400 leading-relaxed">{selectedSpot.pull_off_safety}</p>
            </div>

            {/* Best Times */}
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <span className="text-slate-400">Optimal Hitching Window:</span>
              <span className="font-medium text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {selectedSpot.best_times}
              </span>
            </div>

            {/* Wait-Time Prediction Box */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 p-4 rounded-xl border border-indigo-500/30 shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Dynamic Wait Prediction</span>
                </div>
                {prediction && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    prediction.model_used === 'ML_GRADIENT_BOOST'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                      : 'bg-amber-950/80 text-amber-300 border-amber-700'
                  }`}>
                    {prediction.model_used === 'ML_GRADIENT_BOOST' ? '⚡ ML Model' : '📐 Transparent Heuristic'}
                  </span>
                )}
              </div>

              {/* Departure Hour Slider */}
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Planned Departure:</span>
                  <span className="text-slate-200 font-semibold">{predHour.toString().padStart(2, '0')}:00</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="23"
                  value={predHour}
                  onChange={(e) => recomputePrediction(parseInt(e.target.value), predDay)}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {loadingPrediction ? (
                <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
                  Computing wait time model...
                </div>
              ) : prediction ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 tracking-wider">Predicted Range</div>
                      <div className="text-2xl font-black text-indigo-300">
                        {prediction.range_min} - {prediction.range_max} <span className="text-xs font-normal text-slate-400">min</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Confidence</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        prediction.confidence === 'HIGH' ? 'text-emerald-400 bg-emerald-950' :
                        prediction.confidence === 'MEDIUM' ? 'text-amber-400 bg-amber-950' : 'text-rose-400 bg-rose-950'
                      }`}>
                        {prediction.confidence}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">
                    {prediction.explanation}
                  </p>

                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg text-amber-300 text-xs">
                    <Bus className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      <strong>Bus alternative:</strong> If no lift after <strong>{prediction.bus_alternative_threshold_min} mins</strong>, proceed to transit.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onSelectSpotForRide(selectedSpot, destinationInput)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                <span>Start Ride From This Spot</span>
              </button>
              <button
                onClick={() => setFlagModalOpen(true)}
                className="px-3 py-3 rounded-xl border border-slate-700 bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition"
                title="Report/Flag Spot"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-sm">
            Enter a destination or select a spot on the map to inspect wait prediction and safety pull-off details.
          </div>
        )}
      </div>

      {/* Flag / Report Modal */}
      {flagModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" /> Report Spot Safety Issue
            </h3>
            <p className="text-xs text-slate-400">
              Help keep the community safe. Report inaccurate pull-off zones, illegal expressway spots, or security hazards.
            </p>
            {flagSuccess ? (
              <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs rounded-xl text-center">
                Report logged. Thank you for protecting fellow hitchhikers!
              </div>
            ) : (
              <>
                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Describe the issue (e.g., shoulder blocked by roadwork, poor visibility, restricted toll zone)..."
                  className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setFlagModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFlagSubmit}
                    disabled={!flagReason.trim()}
                    className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium disabled:opacity-50"
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
