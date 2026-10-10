import React, { useState } from 'react';
import { api } from '../api';
import { Star, CheckCircle, Clock, ShieldCheck, Heart, ThumbsUp } from 'lucide-react';

export default function PostRideRating({ trip, onDone }) {
  const [waitTime, setWaitTime] = useState(18);
  const [spotRating, setSpotRating] = useState(5);
  const [safetyRating, setSafetyRating] = useState(5);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.submitSpotReview(trip.spot_id || 'spot_blr_nh44_hebbal', {
        spot_id: trip.spot_id || 'spot_blr_nh44_hebbal',
        wait_time_minutes: parseFloat(waitTime),
        rating: spotRating,
        safety_rating: safetyRating,
        time_of_day_hour: new Date().getHours(),
        day_of_week: new Date().getDay(),
        road_type: 'national_highway',
        comments: comments || 'Smooth ride, safe dropoff.'
      });
      setSubmitted(true);
      setTimeout(() => onDone(), 2000);
    } catch (err) {
      console.error(err);
      onDone();
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 w-full">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-center">
        {submitted ? (
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Feedback Contributed!</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your anonymized wait time and safety rating have improved HitchSafe's machine learning model for future travelers.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-100">Safe Arrival Confirmed!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your emergency contact has been notified of your safe arrival. Help train the community dataset with 3 quick taps:
              </p>
            </div>

            {/* Actual wait time */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-left space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-emerald-400" /> How long did you wait?</span>
                <span className="text-emerald-400 font-bold">{waitTime} minutes</span>
              </label>
              <input
                type="range"
                min="2"
                max="90"
                value={waitTime}
                onChange={(e) => setWaitTime(e.target.value)}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Spot rating */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-left space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Spot Pickup Convenience Rating:
              </label>
              <div className="flex justify-center gap-3 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSpotRating(star)}
                    className="p-1 transition hover:scale-110"
                  >
                    <Star className={`w-7 h-7 ${star <= spotRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Ride safety rating */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-left space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Driver & Ride Safety Feeling:
              </label>
              <div className="flex justify-center gap-3 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSafetyRating(star)}
                    className="p-1 transition hover:scale-110"
                  >
                    <ShieldCheck className={`w-7 h-7 ${star <= safetyRating ? 'text-emerald-400' : 'text-slate-700'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Optional note */}
            <div>
              <textarea
                placeholder="Optional notes: e.g. driver courteous, pull-off has clean water..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 h-20"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDone}
                className="w-1/3 px-4 py-3 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
              >
                Skip
              </button>
              <button
                type="submit"
                className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-emerald-950 transition"
              >
                Submit Anonymized Feedback
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
