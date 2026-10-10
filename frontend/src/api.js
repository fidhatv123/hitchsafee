// HitchSafe API Client & Offline-First Storage Engine

const API_BASE = '/api';

class HitchSafeApi {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupNetworkListeners();
    this.initLocalStorage();
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  initLocalStorage() {
    if (!localStorage.getItem('hitchsafe_offline_queue')) {
      localStorage.setItem('hitchsafe_offline_queue', JSON.stringify([]));
    }
  }

  getOfflineQueue() {
    try {
      return JSON.parse(localStorage.getItem('hitchsafe_offline_queue') || '[]');
    } catch {
      return [];
    }
  }

  saveOfflineQueue(queue) {
    localStorage.setItem('hitchsafe_offline_queue', JSON.stringify(queue));
  }

  enqueueOfflineItem(type, payload) {
    const queue = this.getOfflineQueue();
    const item = {
      id: `client_q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      createdAt: new Date().toISOString()
    };
    queue.push(item);
    this.saveOfflineQueue(queue);
    return item;
  }

  // --- User Auth & Continuous Profile ---
  async register(userData) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Registration failed');
    }
    const data = await res.json();
    localStorage.setItem('hitchsafe_user_session', JSON.stringify(data.user));
    return data;
  }

  async login(creds) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('hitchsafe_user_session', JSON.stringify(data.user));
    return data;
  }

  async getDemoProfile() {
    const res = await fetch(`${API_BASE}/auth/demo-profile`);
    if (!res.ok) throw new Error('Demo profile unavailable');
    const user = await res.json();
    localStorage.setItem('hitchsafe_user_session', JSON.stringify(user));
    return user;
  }

  getCurrentUser() {
    try {
      const saved = localStorage.getItem('hitchsafe_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  logout() {
    localStorage.removeItem('hitchsafe_user_session');
  }

  // --- Spots & Destination Corridor Query ---
  async getSpots() {
    try {
      const res = await fetch(`${API_BASE}/spots`);
      if (!res.ok) throw new Error('Failed to fetch spots');
      const data = await res.json();
      localStorage.setItem('hitchsafe_cached_spots', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem('hitchsafe_cached_spots');
      if (cached) return JSON.parse(cached);
      throw err;
    }
  }

  async findSpotsAlongCorridor(query) {
    try {
      const res = await fetch(`${API_BASE}/spots/corridor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      });
      if (!res.ok) throw new Error('Corridor search failed');
      return await res.json();
    } catch (err) {
      console.error(err);
      // Fallback to all cached spots if offline
      const all = await this.getSpots();
      return {
        destination_name: query.dest_name,
        route_coordinates: [[query.origin_lat, query.origin_lon], [query.dest_lat, query.dest_lon]],
        total_spots_found: all.length,
        spots: all
      };
    }
  }

  async predictWaitTime(params) {
    try {
      const res = await fetch(`${API_BASE}/spots/predict-wait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error('Wait prediction failed');
      return await res.json();
    } catch (err) {
      const base = params.road_type === 'expressways' ? 15 : 22;
      return {
        predicted_wait_min: base,
        range_min: Math.max(5, Math.round(base * 0.7)),
        range_max: Math.round(base * 1.4),
        confidence: 'LOW',
        model_used: 'CLIENT_OFFLINE_HEURISTIC',
        bus_alternative_threshold_min: Math.round(base * 1.6),
        regional_sample_count: 0,
        explanation: 'Offline mode: Client-side heuristic calculation applied.'
      };
    }
  }

  async submitSpotReview(spotId, review) {
    try {
      const res = await fetch(`${API_BASE}/spots/${spotId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review)
      });
      return await res.json();
    } catch {
      this.enqueueOfflineItem('REVIEW', { spotId, review });
      return { success: true, queued: true, message: 'Saved to offline queue' };
    }
  }

  async flagSpot(spotId, reason) {
    const res = await fetch(`${API_BASE}/spots/${spotId}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spot_id: spotId, reason })
    });
    return await res.json();
  }

  // --- Trips & Escalations ---
  async createTrip(tripData) {
    const res = await fetch(`${API_BASE}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripData)
    });
    if (!res.ok) throw new Error('Failed to create trip');
    const trip = await res.json();
    localStorage.setItem('hitchsafe_active_trip', JSON.stringify(trip));
    return trip;
  }

  async getTrip(tripId) {
    const res = await fetch(`${API_BASE}/trips/${tripId}`);
    if (!res.ok) throw new Error('Failed to fetch trip');
    return await res.json();
  }

  async getTripByToken(token) {
    const res = await fetch(`${API_BASE}/trips/track/${token}`);
    if (!res.ok) throw new Error('Tracking link not found or expired');
    return await res.json();
  }

  async sendGPSPing(tripId, ping) {
    try {
      const res = await fetch(`${API_BASE}/trips/${tripId}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ping)
      });
      if (!res.ok) throw new Error('Ping failed');
      return await res.json();
    } catch {
      this.enqueueOfflineItem('GPS_PING', { tripId, ping });
      return {
        deviation_status: 'OK',
        countdown_seconds_remaining: null,
        is_offline_cached: true,
        recommended_sampling_rate_sec: 15
      };
    }
  }

  async tickCountdown(tripId, seconds = 1) {
    const res = await fetch(`${API_BASE}/trips/${tripId}/tick-countdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds })
    });
    return await res.json();
  }

  async triggerMissedDestination(tripId) {
    const res = await fetch(`${API_BASE}/trips/${tripId}/missed-destination`, {
      method: 'POST'
    });
    return await res.json();
  }

  async resolveOk(tripId, note) {
    const res = await fetch(`${API_BASE}/trips/${tripId}/resolve-ok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    return await res.json();
  }

  async snoozeTrip(tripId) {
    const res = await fetch(`${API_BASE}/trips/${tripId}/snooze`, {
      method: 'POST'
    });
    return await res.json();
  }

  async triggerSilentDistress(tripId) {
    try {
      const res = await fetch(`${API_BASE}/trips/${tripId}/silent-distress`, {
        method: 'POST'
      });
      return await res.json();
    } catch {
      this.enqueueOfflineItem('SILENT_DISTRESS', { tripId });
      return { silent_distress_active: true, queued: true };
    }
  }

  async endTrip(tripId) {
    const res = await fetch(`${API_BASE}/trips/${tripId}/end`, {
      method: 'POST'
    });
    localStorage.removeItem('hitchsafe_active_trip');
    return await res.json();
  }

  async deleteTripData(tripId) {
    const res = await fetch(`${API_BASE}/trips/${tripId}/delete-data`, {
      method: 'POST'
    });
    localStorage.removeItem('hitchsafe_active_trip');
    return await res.json();
  }

  // --- Police Station Intercepts ---
  async getPoliceStations() {
    const res = await fetch(`${API_BASE}/trips/police/stations`);
    return await res.json();
  }

  async getPoliceDossiers() {
    const res = await fetch(`${API_BASE}/trips/police/dossiers`);
    return await res.json();
  }

  // --- Simulator & Alerts ---
  async getDemoRoute() {
    const res = await fetch(`${API_BASE}/simulator/demo-route`);
    return await res.json();
  }

  async toggleSimulatedNetwork(online) {
    const res = await fetch(`${API_BASE}/simulator/toggle-network`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online })
    });
    return await res.json();
  }

  async getRecentAlerts() {
    const res = await fetch(`${API_BASE}/simulator/alerts/recent`);
    return await res.json();
  }

  async syncOfflineQueue() {
    const queue = this.getOfflineQueue();
    if (queue.length > 0) {
      try {
        for (const item of queue) {
          if (item.type === 'GPS_PING') {
            await fetch(`${API_BASE}/trips/${item.payload.tripId}/ping`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload.ping)
            });
          }
        }
        await fetch(`${API_BASE}/simulator/alerts/sync`, { method: 'POST' });
        this.saveOfflineQueue([]);
      } catch (e) {
        console.error('Queue sync failed', e);
      }
    }
    const res = await fetch(`${API_BASE}/simulator/alerts/sync`, { method: 'POST' });
    return await res.json();
  }

  async getAlertQueueStatus() {
    try {
      const res = await fetch(`${API_BASE}/simulator/alerts/status`);
      const backendStatus = await res.json();
      const clientQueue = this.getOfflineQueue();
      return {
        ...backendStatus,
        client_pending: clientQueue.length,
        total_pending: (backendStatus.pending_count || 0) + clientQueue.length
      };
    } catch {
      const clientQueue = this.getOfflineQueue();
      return {
        pending_count: clientQueue.length,
        client_pending: clientQueue.length,
        total_pending: clientQueue.length,
        last_synced: 'Offline'
      };
    }
  }

  // --- Regional Guidance & Metrics ---
  async getRegionalGuidance() {
    const res = await fetch(`${API_BASE}/guidance`);
    return await res.json();
  }

  async getModelMetrics() {
    const res = await fetch(`${API_BASE}/spots/model-metrics`);
    return await res.json();
  }

  // --- User Experiences & Community Logs ---
  async getExperiences(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.destination) params.append('destination', filters.destination);
      if (filters.location) params.append('location', filters.location);
      const url = `${API_BASE}/experiences${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load user experiences');
      const data = await res.json();
      localStorage.setItem('hitchsafe_cached_experiences', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem('hitchsafe_cached_experiences');
      if (cached) return JSON.parse(cached);
      return [];
    }
  }

  async submitExperience(expData) {
    const res = await fetch(`${API_BASE}/experiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to submit experience');
    }
    return await res.json();
  }

  // --- Demo Phone Configuration ---
  getUserDemoPhone() {
    return localStorage.getItem('hitchsafe_demo_user_phone') || '+91 98450 12345';
  }

  setUserDemoPhone(phone) {
    if (phone) {
      localStorage.setItem('hitchsafe_demo_user_phone', phone.trim());
    }
  }
}

export const api = new HitchSafeApi();

