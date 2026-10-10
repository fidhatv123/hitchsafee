import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Camera, Check, Shield, UserCheck, AlertCircle, ArrowRight, Car, Upload, Sparkles, Clock, MapPin, Radio } from 'lucide-react';

export default function RideLogger({ initialSpot, initialDestination, currentUser, onTripStarted }) {
  const [userName, setUserName] = useState(currentUser?.name || 'Aarav Nair');
  const [vehiclePlate, setVehiclePlate] = useState('KA 04 MB 7821');
  const [platePhotoUrl, setPlatePhotoUrl] = useState('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80');
  const [ocrRawResult, setOcrRawResult] = useState('');
  const [isOcrConfirmOpen, setIsOcrConfirmOpen] = useState(false);
  const [originName, setOriginName] = useState(initialSpot ? initialSpot.name : 'Hebbal Flyover (NH 44 North)');
  const [originLat, setOriginLat] = useState(initialSpot ? initialSpot.lat : 13.0358);
  const [originLon, setOriginLon] = useState(initialSpot ? initialSpot.lon : 77.5970);
  const [destName, setDestName] = useState(initialDestination || 'Kempegowda Airport (NH 44 North)');
  const [destLat, setDestLat] = useState(13.2450);
  const [destLon, setDestLon] = useState(77.6750);
  const [expectedArrival, setExpectedArrival] = useState(() => {
    const d = new Date(Date.now() + 45 * 60 * 1000); // 45 mins from now
    return d.toISOString().substring(0, 16);
  });
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [contactName, setContactName] = useState(currentUser?.primary_contact_name || 'Priya Nair (Partner)');
  const [contactPhone, setContactPhone] = useState(currentUser?.primary_contact_phone || '+91 98450 12345');
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.name);
      if (currentUser.primary_contact_name) setContactName(currentUser.primary_contact_name);
      if (currentUser.primary_contact_phone) setContactPhone(currentUser.primary_contact_phone);
    }
  }, [currentUser]);

  useEffect(() => {
    if (initialSpot) {
      setOriginName(initialSpot.name);
      setOriginLat(initialSpot.lat);
      setOriginLon(initialSpot.lon);
    }
    if (initialDestination) {
      setDestName(initialDestination);
    }
  }, [initialSpot, initialDestination]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPlatePhotoUrl(event.target.result);
      setIsScanning(true);
      setTimeout(() => {
        const samplePlates = ['KA 04 MB 7821', 'KA 50 N 3920', 'MH 12 QX 4991', 'DL 3C BC 1042'];
        const detected = samplePlates[Math.floor(Math.random() * samplePlates.length)];
        setOcrRawResult(detected);
        setVehiclePlate(detected);
        setIsScanning(false);
        setIsOcrConfirmOpen(true);
      }, 700);
    };
    reader.readAsDataURL(file);
  };

  const handleSimulateQuickScan = (plateStr) => {
    setIsScanning(true);
    setTimeout(() => {
      const detected = plateStr || 'KA 04 MB 7821';
      setOcrRawResult(detected);
      setVehiclePlate(detected);
      setPlatePhotoUrl('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80');
      setIsScanning(false);
      setIsOcrConfirmOpen(true);
    }, 500);
  };

  const handleStartTrip = async (e) => {
    e.preventDefault();
    if (!vehiclePlate.trim()) {
      alert('Please enter or scan the vehicle number plate.');
      return;
    }

    setIsSubmitting(true);
    try {
      const trip = await api.createTrip({
        user_name: userName,
        user_id: currentUser?.id,
        vehicle_plate: vehiclePlate.toUpperCase().trim(),
        plate_photo_path: 'plate_evidence_ka04.jpg',
        plate_photo_data: platePhotoUrl,
        origin_lat: originLat,
        origin_lon: originLon,
        origin_name: originName,
        destination_lat: destLat,
        destination_lon: destLon,
        destination_name: destName,
        expected_arrival_time: new Date(expectedArrival).toISOString(),
        buffer_minutes: parseInt(bufferMinutes),
        trusted_contact_name: contactName,
        trusted_contact_phone: contactPhone,
        battery_level: 95
      });

      onTripStarted(trip);
    } catch (err) {
      alert('Error starting trip: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 w-full">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100">Log Vehicle & Safety Net</h1>
            <p className="text-xs text-slate-400">
              Captures number plate photo $\to$ Primary Contact and Nearest Police Station alerted if destination is missed
            </p>
          </div>
        </div>

        <form onSubmit={handleStartTrip} className="space-y-6">
          {/* User Name */}
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Traveler Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {currentUser && (
              <div className="text-right self-end pb-1">
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-700 px-2 py-1 rounded-lg font-bold">
                  ✓ Continuous Profile
                </span>
              </div>
            )}
          </div>

          {/* Vehicle Number Plate & Photo Evidence Capture */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-emerald-400" /> Vehicle Number Plate & Photo Evidence
              </label>
              <span className="text-[10px] text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded font-bold">
                Plate Photo Dispatched on SOS
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. KA 04 MB 7821"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                required
                className="flex-1 bg-slate-900 border border-slate-700 font-mono font-bold tracking-wider rounded-xl px-4 py-2.5 text-base text-emerald-300 uppercase focus:outline-none focus:border-emerald-500"
              />
              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2.5 rounded-xl text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>{isScanning ? 'Scanning...' : 'Upload/Camera'}</span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
              </label>
              <button
                type="button"
                onClick={() => handleSimulateQuickScan('KA 04 MB 7821')}
                className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 px-3 py-2.5 rounded-xl text-xs font-medium transition"
                title="Simulate Photo Scan"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            {/* Photo Preview Thumbnail */}
            {platePhotoUrl && (
              <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-700">
                <img
                  src={platePhotoUrl}
                  alt="Vehicle Number Plate"
                  className="w-20 h-14 object-cover rounded-lg border border-slate-600"
                />
                <div className="text-xs">
                  <div className="text-slate-200 font-bold flex items-center gap-1.5">
                    <span>Number Plate Photo Attached</span>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Stored on device & server. If destination is missed, this exact photo is transmitted to <strong>{contactName}</strong> and the <strong>Nearest Police Station</strong>.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Primary Contact Person */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" /> Primary Person (Emergency Escalation)
              </label>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Auto-Linked
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 mb-1 block">Primary Contact Name</span>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-400">Primary Contact Mobile (SMS/Alerts)</span>
                  <span className="text-[10px] text-amber-400 font-bold">📲 Enter Your Number for Demo</span>
                </div>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value);
                    localStorage.setItem('hitchsafe_demo_user_phone', e.target.value);
                  }}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  <strong>Dual Broadcast:</strong> Emergency alert with plate photo goes to <strong>{contactPhone}</strong> and the <strong>Nearest Police Station</strong>.
                </span>
              </div>
            </div>
          </div>

          {/* Route & Expected Arrival */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Destination
              </label>
              <input
                type="text"
                value={destName}
                onChange={(e) => setDestName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Expected Arrival Deadline
              </label>
              <input
                type="datetime-local"
                value={expectedArrival}
                onChange={(e) => setExpectedArrival(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Start Ride Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl text-base transition shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Securing Ride Net...' : 'Start Monitored Ride'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Mandatory OCR Confirmation Modal */}
      {isOcrConfirmOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <Check className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-100">Confirm Vehicle Plate & Photo</h3>
            </div>
            <p className="text-xs text-slate-400">
              Verify the scanned registration against the physical vehicle. This photo and plate number will be delivered to law enforcement and your emergency contact if necessary.
            </p>
            {platePhotoUrl && (
              <img src={platePhotoUrl} alt="Vehicle Plate" className="w-full h-36 object-cover rounded-xl border border-slate-700" />
            )}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Detected Plate (Edit if misread):</span>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-emerald-500 rounded-xl px-4 py-3 text-lg font-mono font-bold tracking-widest text-emerald-300 uppercase focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOcrConfirmOpen(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition"
              >
                Confirm Plate & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
