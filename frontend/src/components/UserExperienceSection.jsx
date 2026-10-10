import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { MessageSquarePlus, Star, Clock, MapPin, Navigation, Car, CheckCircle2, ShieldCheck, Heart, User, Filter, Search, Sparkles } from 'lucide-react';

export default function UserExperienceSection({ currentUser, onSelectSpotForRide }) {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDest, setFilterDest] = useState('');

  // Form State
  const [userName, setUserName] = useState(currentUser?.name || 'Aarav Nair');
  const [location, setLocation] = useState('Bengaluru (Mekhri Circle)');
  const [destination, setDestination] = useState('Kempegowda Airport Gate');
  const [pickupSpot, setPickupSpot] = useState('Hebbal Flyover Exit Ramp (NH 44 North)');
  const [waitTime, setWaitTime] = useState(15);
  const [rating, setRating] = useState(5);
  const [vehicleType, setVehicleType] = useState('Car / Sedan');
  const [driverBehavior, setDriverBehavior] = useState('Polite commuter, offered water bottle');
  const [experienceNotes, setExperienceNotes] = useState(
    'Waited about 15 minutes near the HP petrol pump layby. A polite tech commuter picked me up. Very clean roadside pull-off with CCTV and highway patrol.'
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadExperiences();
  }, []);

  const loadExperiences = async (destFilter = '') => {
    setLoading(true);
    try {
      const data = await api.getExperiences(destFilter ? { destination: destFilter } : {});
      setExperiences(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSearch = (e) => {
    e.preventDefault();
    loadExperiences(filterDest);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.trim() || !destination.trim() || !pickupSpot.trim()) {
      setErrorMessage('Please fill in your starting location, destination, and where you got the ride.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const created = await api.submitExperience({
        user_name: userName.trim() || 'HitchSafe Traveler',
        user_id: currentUser?.id,
        location: location.trim(),
        destination: destination.trim(),
        pickup_spot: pickupSpot.trim(),
        wait_time_minutes: parseFloat(waitTime),
        rating: parseFloat(rating),
        vehicle_type: vehicleType,
        driver_behavior: driverBehavior.trim(),
        experience_notes: experienceNotes.trim()
      });

      setSubmitSuccess(true);
      // Prepend to list
      setExperiences([created, ...experiences]);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Error submitting experience');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full gap-4 p-3 md:p-6 overflow-y-auto">
      {/* Left: Enter User Experience Form */}
      <div className="w-full lg:w-[480px] flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100">Log Hitchhiking Experience</h2>
              <p className="text-[11px] text-slate-400">
                Share your ride pickup point & wait time to train community intelligence
              </p>
            </div>
          </div>

          {submitSuccess && (
            <div className="bg-emerald-950/80 border border-emerald-600 text-emerald-200 p-3 rounded-2xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Experience published!</strong> Your wait time of {waitTime} mins has updated the spot's live prediction dataset.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-950/80 border border-rose-600 text-rose-200 p-3 rounded-2xl text-xs">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* Traveler Name */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Traveler Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your Name / Handle"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Origin Location & Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" /> Origin Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bangalore (Mekhri Circle)"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-emerald-400" /> Destination
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Kempegowda Airport Gate"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* From where did they get the ride */}
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-1.5">
              <label className="block text-slate-300 font-bold flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-indigo-400" /> From where did you get the ride? (Pickup Spot)
              </label>
              <input
                type="text"
                value={pickupSpot}
                onChange={(e) => setPickupSpot(e.target.value)}
                placeholder="e.g. Hebbal Flyover Exit Ramp (HP Petrol Pump layby)"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
              />
              <span className="text-[10px] text-slate-500 block">
                Specify the exact roadside shoulder, toll gate layby, flyover ramp, or petrol bunk where the car stopped.
              </span>
            </div>

            {/* How much did they have to wait there? */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> How much did you have to wait there?
                </label>
                <span className="text-base font-black text-emerald-300 font-mono">
                  {waitTime} <span className="text-xs font-normal text-slate-400">mins</span>
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="90"
                value={waitTime}
                onChange={(e) => setWaitTime(e.target.value)}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Quick Lift (&lt;5m)</span>
                <span>Average (15-25m)</span>
                <span>Long Wait (&gt;45m)</span>
              </div>
            </div>

            {/* Vehicle Type & Driver Behavior */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                >
                  <option value="Car / Sedan">Car / Sedan</option>
                  <option value="SUV / Compact SUV">SUV / Compact SUV</option>
                  <option value="Commercial Truck / Lorry">Commercial Truck / Lorry</option>
                  <option value="Utility Van / Pickup">Utility Van / Pickup</option>
                  <option value="Motorcycle / Scooter">Motorcycle / Scooter</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Safety Rating</label>
                <div className="flex items-center gap-1.5 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star className={`w-5 h-5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-400 ml-1">{rating}.0</span>
                </div>
              </div>
            </div>

            {/* Driver notes */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Driver Demeanor & Trip Notes</label>
              <input
                type="text"
                value={driverBehavior}
                onChange={(e) => setDriverBehavior(e.target.value)}
                placeholder="e.g. Respectful solo commuter, verified license plate"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* User Experience Story */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Detailed Experience Narrative & Tips</label>
              <textarea
                value={experienceNotes}
                onChange={(e) => setExperienceNotes(e.target.value)}
                rows={3}
                placeholder="Describe road shoulder safety, lighting, ease of flagging down rides, police presence..."
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl text-xs transition shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{submitting ? 'Publishing Review...' : 'Publish Experience to Community'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Right: Community Hitchhiking Experiences Feed */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col gap-4 overflow-hidden">
        {/* Header & Filter Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-100">Community Experience Feed</h2>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-bold">
                {experiences.length} Reports Logged
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Real wait times and roadside safety observations logged by fellow hitchhikers
            </p>
          </div>

          {/* Search Filter */}
          <form onSubmit={handleFilterSearch} className="flex items-center gap-1.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter destination..."
                value={filterDest}
                onChange={(e) => setFilterDest(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-44"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold"
            >
              Filter
            </button>
            {filterDest && (
              <button
                type="button"
                onClick={() => { setFilterDest(''); loadExperiences(''); }}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Experiences List */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">Loading community experiences...</div>
          ) : experiences.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No experiences match this filter. Be the first to share your hitchhiking story!
            </div>
          ) : (
            experiences.map((exp) => (
              <div
                key={exp.id}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition space-y-2.5 text-xs shadow-md"
              >
                {/* Header: Traveler & Ratings */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-emerald-500/30">
                      {exp.user_name ? exp.user_name[0] : 'H'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        <span>{exp.user_name}</span>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.2 rounded border border-slate-800">
                          {exp.vehicle_type || 'Car'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(exp.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg text-amber-400 text-[11px] font-bold">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{parseFloat(exp.rating || 5).toFixed(1)}</span>
                    </div>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded-lg font-mono font-bold text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>Waited {exp.wait_time_minutes} min</span>
                    </span>
                  </div>
                </div>

                {/* Route & Pickup Spot Tags */}
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                    <span className="text-slate-400">Route:</span>
                    <span className="text-slate-200">{exp.location}</span>
                    <span className="text-indigo-400">➔</span>
                    <span className="text-emerald-300 font-bold">{exp.destination}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-400 text-[11px]">
                    <span className="text-indigo-400 font-bold shrink-0">📍 Got ride at:</span>
                    <span className="text-slate-200 font-medium">{exp.pickup_spot}</span>
                  </div>
                </div>

                {/* Narrative & Driver Demeanor */}
                <p className="text-slate-300 text-[11px] leading-relaxed italic bg-slate-950 p-2 rounded-xl border border-slate-900">
                  "{exp.experience_notes}"
                </p>

                {exp.driver_behavior && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span><strong>Driver Notes:</strong> {exp.driver_behavior}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
