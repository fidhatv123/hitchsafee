import React, { useState, useEffect } from 'react';
import SpotFinder from './components/SpotFinder';
import RideLogger from './components/RideLogger';
import LiveMonitoring from './components/LiveMonitoring';
import SilentDistress from './components/SilentDistress';
import PostRideRating from './components/PostRideRating';
import LiveTrackingWeb from './components/LiveTrackingWeb';
import DemoSimulator from './components/DemoSimulator';
import RegionalGuidance from './components/RegionalGuidance';
import SettingsModal from './components/SettingsModal';
import AuthModal from './components/AuthModal';
import UserExperienceSection from './components/UserExperienceSection';
import PoliceTerminal from './components/PoliceTerminal';
import { api } from './api';
import { Shield, MapPin, Car, Radio, Calculator, BookOpen, Settings, Wifi, WifiOff, RotateCcw, AlertTriangle, User, LogOut, Sparkles, MessageSquare } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('spots'); // spots, log_ride, live_ride, demo, police, calculator, guidance
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [currentUser, setCurrentUser] = useState(() => api.getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTrip, setActiveTrip] = useState(() => {
    try {
      const saved = localStorage.getItem('hitchsafe_active_trip');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [completedTrip, setCompletedTrip] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [trackingToken, setTrackingToken] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  // Check URL pathname for /track/:token direct link
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/track/')) {
      const token = path.replace('/track/', '').trim();
      if (token) {
        setTrackingToken(token);
      }
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkQueue = async () => {
      try {
        const q = await api.getAlertQueueStatus();
        setPendingQueueCount(q.total_pending || 0);
      } catch (e) {
        // offline
      }
    };
    checkQueue();
    const interval = setInterval(checkQueue, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSelectSpotForRide = (spot, destination) => {
    setSelectedSpot(spot);
    setSelectedDestination(destination || '');
    setActiveTab('log_ride');
  };

  const handleTripStarted = (trip) => {
    setActiveTrip(trip);
    setActiveTab('live_ride');
  };

  const handleTripCompleted = (trip) => {
    setCompletedTrip(trip);
    setActiveTrip(null);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  // If user opened a direct live-tracking URL
  if (trackingToken) {
    return <LiveTrackingWeb token={trackingToken} onClose={() => { setTrackingToken(null); window.history.pushState({}, '', '/'); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Main Navigation Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sticky top-0 z-[2000] flex flex-wrap items-center justify-between gap-3 shadow-xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-slate-100">HitchSafe</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                Active Map
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Hitchhiker Intelligence & Automated Emergency Escalation
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 overflow-x-auto max-w-full text-xs">
          <button
            onClick={() => setActiveTab('spots')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'spots' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Map & Spots</span>
          </button>

          <button
            onClick={() => setActiveTab('log_ride')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'log_ride' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Log Ride</span>
          </button>

          <button
            onClick={() => setActiveTab('live_ride')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'live_ride' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live Ride</span>
            {activeTrip && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
          </button>

          <button
            onClick={() => setActiveTab('demo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'demo' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-400 hover:text-indigo-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-bold">Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('police')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'police' ? 'bg-rose-700 text-white shadow-md' : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-300" />
            <span>Police Dispatch</span>
          </button>

          <button
            onClick={() => setActiveTab('experiences')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'experiences' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
            <span>Experiences</span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'calculator' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Disguised Calculator Silent SOS"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Calculator</span>
          </button>

          <button
            onClick={() => setActiveTab('guidance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ${
              activeTab === 'guidance' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Legal Guide</span>
          </button>
        </nav>

        {/* User Profile & Status Badges */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800 text-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                {currentUser.name[0]}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-slate-200 font-bold leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400">Primary: {currentUser.primary_contact_name}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 text-slate-500 hover:text-rose-400 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-emerald-950"
            >
              <User className="w-3.5 h-3.5" />
              <span>Login / Sign Up</span>
            </button>
          )}

          {pendingQueueCount > 0 && (
            <button
              onClick={() => api.syncOfflineQueue()}
              className="flex items-center gap-1 bg-amber-950/80 text-amber-300 border border-amber-800 px-2.5 py-1 rounded-xl text-xs"
              title="Click to sync offline alerts"
            >
              <RotateCcw className="w-3 h-3 animate-spin" />
              <span>{pendingQueueCount} Pending</span>
            </button>
          )}

          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold ${
              isOnline ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-rose-950/60 text-rose-300 border-rose-800'
            }`}
          >
            {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Telemetry & Privacy Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main App Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {completedTrip ? (
          <PostRideRating trip={completedTrip} onDone={() => { setCompletedTrip(null); setActiveTab('spots'); }} />
        ) : activeTab === 'spots' ? (
          <SpotFinder
            onSelectSpotForRide={handleSelectSpotForRide}
            currentUser={currentUser}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        ) : activeTab === 'log_ride' ? (
          <RideLogger
            initialSpot={selectedSpot}
            initialDestination={selectedDestination}
            currentUser={currentUser}
            onTripStarted={handleTripStarted}
          />
        ) : activeTab === 'live_ride' ? (
          activeTrip ? (
            <LiveMonitoring
              trip={activeTrip}
              onTripCompleted={handleTripCompleted}
              onOpenCalculator={() => setActiveTab('calculator')}
            />
          ) : (
            <div className="max-w-md mx-auto my-auto p-8 text-center space-y-4">
              <Car className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-200">No Active Ride Monitored</h3>
              <p className="text-xs text-slate-400">
                Log a vehicle plate in Step 2 or launch the Simulator to experience real-time destination monitoring, plate photo alerts, and police dispatch.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setActiveTab('log_ride')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Log a Ride
                </button>
                <button
                  onClick={() => setActiveTab('demo')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  Launch Simulator
                </button>
              </div>
            </div>
          )
        ) : activeTab === 'demo' ? (
          <DemoSimulator
            activeTrip={activeTrip}
            onSelectDemoTrip={handleTripStarted}
            onOpenTrackingLink={(url) => {
              const token = url.split('/track/')[1];
              if (token) setTrackingToken(token);
            }}
          />
        ) : activeTab === 'police' ? (
          <PoliceTerminal />
        ) : activeTab === 'experiences' ? (
          <UserExperienceSection
            currentUser={currentUser}
            onSelectSpotForRide={handleSelectSpotForRide}
          />
        ) : activeTab === 'calculator' ? (
          <SilentDistress activeTrip={activeTrip} onClose={() => setActiveTab(activeTrip ? 'live_ride' : 'spots')} />
        ) : activeTab === 'guidance' ? (
          <RegionalGuidance />
        ) : null}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} activeTrip={activeTrip} />
      )}
    </div>
  );
}
