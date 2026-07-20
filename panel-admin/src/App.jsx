import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Store,
  MapPin,
  Activity,
  TrendingUp,
  ShieldCheck,
  Bell,
  Search,
  Bike,
  Wallet,
  LogOut,
  Phone,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  ShoppingBag,
  Eye,
  Menu,
  X,
  Tag,
  Check,
  Trash2,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { authAPI, adminAPI, notificationsAPI, createSocketConnection, payoutsAPI, depositsAPI, promotionsAPI, supportAPI, fraudAPI, deliveryZoneAPI, gamificationAPI, subscriptionAPI } from './api';

// --- Fleet Map Component (Leaflet/OpenStreetMap - no API key needed) ---
function FleetMap({ couriersLocs, history = [], selectedCourierId = null, hotspots = [] }) {
  const mapRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markersRef = React.useRef({});
  const polylineRef = React.useRef(null);
  const hotspotMarkersRef = React.useRef([]);

  React.useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    // Pulse animation
    if (!document.getElementById('fleet-pulse-css')) {
      const style = document.createElement('style');
      style.id = 'fleet-pulse-css';
      style.textContent = `@keyframes fleet-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.5}}`;
      document.head.appendChild(style);
    }

    const loadLeaflet = () => new Promise((resolve) => {
      if (window.L) return resolve(window.L);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.head.appendChild(script);
    });

    loadLeaflet().then(L => {
      if (mapInstanceRef.current) return;
      // Dark theme tiles for admin panel
      const map = L.map(mapRef.current, { zoomControl: true }).setView([14.7167, -17.4677], 13);
      mapInstanceRef.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update courier markers, polyline, hotspots
  React.useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    // --- Hotspots (circle markers) ---
    hotspotMarkersRef.current.forEach(m => m.remove());
    hotspotMarkersRef.current = [];
    hotspots.forEach(h => {
      const weight = parseFloat(h.total_amount) / 1000;
      const radius = Math.min(Math.max(weight * 8, 20), 80);
      const circle = L.circleMarker([parseFloat(h.latitude), parseFloat(h.longitude)], {
        radius, color: 'transparent', fillColor: '#818cf8', fillOpacity: 0.35,
      }).addTo(map);
      hotspotMarkersRef.current.push(circle);
    });

    // --- Courier markers ---
    Object.entries(couriersLocs).forEach(([id, loc]) => {
      const isSelected = String(id) === String(selectedCourierId);
      const color = isSelected ? '#ef4444' : '#6366f1';
      const size = isSelected ? 38 : 30;
      const dotSize = isSelected ? 16 : 12;

      if (markersRef.current[id]) {
        markersRef.current[id].setLatLng([loc.lat, loc.lng]);
        // Update icon for selection change
        markersRef.current[id].setIcon(L.divIcon({
          className: '',
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color}33;display:flex;align-items:center;justify-content:center;animation:fleet-pulse 2s infinite">
            <div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>
          </div>`,
          iconSize: [size, size], iconAnchor: [size/2, size/2],
        }));
      } else {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color}33;display:flex;align-items:center;justify-content:center;animation:fleet-pulse 2s infinite">
            <div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>
          </div>`,
          iconSize: [size, size], iconAnchor: [size/2, size/2],
        });
        markersRef.current[id] = L.marker([loc.lat, loc.lng], { icon }).addTo(map).bindPopup(`🏍️ Livreur #${id}`);
      }
    });

    // Remove old markers
    Object.keys(markersRef.current).forEach(id => {
      if (!couriersLocs[id]) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });

    // --- Polyline for history ---
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }
    if (history.length > 0) {
      const path = history.map(h => [parseFloat(h.latitude), parseFloat(h.longitude)]);
      polylineRef.current = L.polyline(path, { color: '#818cf8', weight: 3, opacity: 0.8, dashArray: '8, 6' }).addTo(map);
      map.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
    } else if (selectedCourierId && couriersLocs[selectedCourierId]) {
      map.setView([couriersLocs[selectedCourierId].lat, couriersLocs[selectedCourierId].lng], 16);
    }

  }, [couriersLocs, history, selectedCourierId, hotspots]);

  return (
    <div ref={mapRef} className="w-full h-full" style={{ minHeight: 300 }} />
  );
}

// Login Page
function LoginPage({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authAPI.login(phone, password);
      if (data.error) {
        setError(data.error);
      } else if (data.token) {
        if (data.user?.role !== 'admin') {
          setError('Accès réservé aux administrateurs');
          return;
        }
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">NOOR EAT</h1>
          <p className="text-indigo-400 text-sm font-bold uppercase tracking-widest mt-1">Admin Global</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 77 000 00 00"
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" required />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Pagination Component
function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <span className="text-xs text-slate-500">{pagination.total} résultats</span>
      <div className="flex items-center space-x-2">
        <button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}
          className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400 font-medium">{pagination.page} / {pagination.totalPages}</span>
        <button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
          className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Data
  const [dashboard, setDashboard] = useState(null);
  const [restaurants, setRestaurants] = useState({ data: [], pagination: {} });
  const [couriers, setCouriers] = useState({ data: [], pagination: {} });
  const [clients, setClients] = useState({ data: [], pagination: {} });
  const [orders, setOrders] = useState({ data: [], pagination: {} });
  const [payouts, setPayouts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [promos, setPromos] = useState({ data: [], pagination: {} });
  const [unreadCount, setUnreadCount] = useState(0);
  const [fleetLocs, setFleetLocs] = useState({});
  const [selectedCourierId, setSelectedCourierId] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [courierStats, setCourierStats] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: '', discount_type: 'percentage', discount_value: '', min_order_amount: 0 });

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      authAPI.getMe().then(data => {
        if (data.error) handleLogout();
      }).catch(() => handleLogout());
    }
    setLoading(false);
  }, []);

  // Socket.IO
  useEffect(() => {
    if (!token) return;
    let socketInstance = null;
    createSocketConnection(token).then(s => {
      socketInstance = s;
      s.on('courier_status_changed', () => fetchDashboard());
      s.on('order_status_changed', () => { fetchDashboard(); fetchOrders(); });
      s.on('fleet_location_update', (data) => {
        setFleetLocs(prev => ({
          ...prev,
          [data.courierId]: { lat: data.latitude, lng: data.longitude, timestamp: data.timestamp }
        }));
      });
    });
    return () => { if (socketInstance) socketInstance.disconnect(); };
  }, [token]);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await adminAPI.getDashboard();
      if (data) setDashboard(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchRestaurants = useCallback(async (page = 1) => {
    try {
      const data = await adminAPI.getRestaurants(page);
      if (data?.data) setRestaurants(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchCouriers = useCallback(async (page = 1) => {
    try {
      const data = await adminAPI.getCouriers(page);
      if (data?.data) setCouriers(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchClients = useCallback(async (page = 1) => {
    try {
      const data = await adminAPI.getClients(page);
      if (data?.data) setClients(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      const data = await adminAPI.getOrders({ page, limit: 20 });
      if (data?.data) setOrders(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchPayouts = useCallback(async () => {
    try {
      const data = await payoutsAPI.getAll();
      if (data) setPayouts(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchDeposits = useCallback(async () => {
    try {
      const data = await depositsAPI.getPending();
      if (data) setDeposits(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchPromos = useCallback(async (page = 1) => {
    try {
      const data = await promotionsAPI.getAll(page);
      if (data?.data) setPromos(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchCourierHistory = useCallback(async (id) => {
    try {
      const hist = await adminAPI.getCourierHistory(id);
      if (hist) setLocationHistory(hist);
      const st = await adminAPI.getCourierStats(id);
      if (st) setCourierStats(st);
      setSelectedCourierId(id);
    } catch (err) { console.error(err); }
  }, []);

  const fetchHotspots = useCallback(async () => {
    try {
      const data = await adminAPI.getOrderHotspots();
      if (data) setHotspots(data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboard();
      fetchOrders();
      notificationsAPI.getUnreadCount().then(d => setUnreadCount(d?.count || 0)).catch(() => {});
      const interval = setInterval(fetchDashboard, 60000);
      return () => clearInterval(interval);
    }
  }, [user, fetchDashboard, fetchOrders]);

  useEffect(() => {
    if (user && activeTab === 'restaurants') fetchRestaurants();
    if (user && activeTab === 'couriers') fetchCouriers();
    if (user && activeTab === 'clients') fetchClients();
    if (user && activeTab === 'orders') fetchOrders();
    if (user && activeTab === 'payouts') fetchPayouts();
    if (user && activeTab === 'deposits') fetchDeposits();
    if (user && activeTab === 'promotions') fetchPromos();
  }, [user, activeTab, fetchRestaurants, fetchCouriers, fetchClients, fetchOrders, fetchPayouts, fetchDeposits, fetchPromos]);

  const handleLogin = (userData, tokenData) => { setUser(userData); setToken(tokenData); };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
    setToken(null);
  };

  const handleToggleUser = async (userId, currentStatus) => {
    try {
      await adminAPI.updateUserStatus(userId, !currentStatus);
      if (activeTab === 'restaurants') fetchRestaurants(restaurants.pagination?.page);
      if (activeTab === 'couriers') fetchCouriers(couriers.pagination?.page);
      if (activeTab === 'clients') fetchClients(clients.pagination?.page);
    } catch (err) { console.error(err); }
  };

  const handleUpdatePayout = async (id, status) => {
    const ref = status === 'paye' ? prompt('ID de transaction Wave/OM (Optionnel):') : '';
    try {
      await payoutsAPI.updateStatus(id, status, ref);
      fetchPayouts();
    } catch (err) { console.error(err); }
  };

  const handleUpdateDeposit = async (id, status) => {
    try {
      await depositsAPI.updateStatus(id, status);
      fetchDeposits();
    } catch (err) { console.error(err); }
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    try {
      await promotionsAPI.create(promoForm);
      setShowPromoModal(false);
      setPromoForm({ code: '', discount_type: 'percentage', discount_value: '', min_order_amount: 0 });
      fetchPromos();
    } catch (err) { console.error(err); }
  };

  const handleTogglePromo = async (id) => {
    try {
      await promotionsAPI.toggle(id);
      fetchPromos(promos.pagination?.page);
    } catch (err) { console.error(err); }
  };

  const handleDeletePromo = async (id) => {
    if (!confirm('Supprimer ce code promo ?')) return;
    try {
      await promotionsAPI.delete(id);
      fetchPromos(promos.pagination?.page);
    } catch (err) { console.error(err); }
  };

  const formatPrice = (p) => new Intl.NumberFormat('fr-SN').format(p || 0) + ' FCFA';
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const statusLabel = (s) => {
    const map = {
      nouvelle: { label: 'Nouvelle', cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
      preparation: { label: 'Préparation', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      prete: { label: 'Prête', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      en_route: { label: 'En route', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      livree: { label: 'Livrée', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
      annulee: { label: 'Annulée', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    return map[s] || { label: s, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  // Extraire les compteurs du dashboard
  const userCounts = {};
  (dashboard?.users || []).forEach(u => { userCounts[u.role] = parseInt(u.count); });
  const totalRevenue = dashboard?.today?.revenue || 0;
  const totalOrders = dashboard?.today?.count || 0;
  const activeOrdersCount = dashboard?.active?.count || 0;

  // Paiements
  const payments = dashboard?.payments || [];
  const totalPayments = payments.reduce((s, p) => s + parseInt(p.count), 0) || 1;

  return (
    <div className="flex h-screen bg-brand text-slate-300 font-sans overflow-hidden relative">

      {/* MOBILE MENU OVERLAY */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 glass-panel border-r border-slate-700/50 flex flex-col transform transition-transform duration-300 ease-in-out ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-700/50 relative">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">NOOR EAT</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Admin Global</p>
          </div>
          <button className="md:hidden ml-auto p-2 text-slate-400" onClick={() => setShowMobileMenu(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          <p className="px-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Core Management</p>

          {[
            { id: 'overview', icon: Activity, label: 'Vue Globale' },
            { id: 'fleet', icon: MapPin, label: 'Suivi Flotte (Live)' },
            { id: 'restaurants', icon: Store, label: `Restos (${userCounts.restaurant || 0})` },
            { id: 'couriers', icon: Bike, label: `Livreurs (${userCounts.livreur || 0})` },
            { id: 'clients', icon: Users, label: `Clients (${userCounts.client || 0})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMobileMenu(false); }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              <tab.icon className="w-5 h-5 mr-3" />
              <span className="font-semibold text-sm">{tab.label}</span>
              {activeTab === tab.id && <div className="ml-auto w-1 h-5 bg-indigo-500 rounded-full"></div>}
            </button>
          ))}

          <div className="pt-6 pb-2">
            <p className="px-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Finance & Operations</p>
          </div>

          {[
            { id: 'orders', icon: ShoppingBag, label: 'Commandes' },
            { id: 'payouts', icon: Wallet, label: 'Retraits (Approb.)' },
            { id: 'deposits', icon: Wallet, label: 'Dépôts (Approb.)' },
            { id: 'promotions', icon: Tag, label: 'Codes Promo' },
            { id: 'fraud', icon: AlertTriangle, label: 'Fraude & Alertes' },
            { id: 'support', icon: Phone, label: 'Support Tickets' },
            { id: 'delivery_zones', icon: MapPin, label: 'Zones Livraison' },
            { id: 'gamification', icon: Tag, label: 'Gamification' },
            { id: 'monitoring', icon: Activity, label: 'Monitoring' },
            { id: 'settings', icon: Menu, label: 'Configuration System' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMobileMenu(false); }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              <tab.icon className="w-5 h-5 mr-3" />
              <span className="font-semibold text-sm">{tab.label}</span>
              {activeTab === tab.id && <div className="ml-auto w-1 h-5 bg-indigo-500 rounded-full"></div>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center px-2 py-2">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1e1b4b&color=818cf8`} alt="Admin" className="w-10 h-10 rounded-full border-2 border-indigo-500/50 mr-3" />
            <div>
              <p className="text-sm font-bold text-white leading-tight">{user.name}</p>
              <p className="text-[10px] text-green-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span> Connecté</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 mt-2 text-sm text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col relative overflow-hidden">

        {/* HEADER */}
        <header className="h-20 glass-panel border-b border-slate-700/50 flex items-center justify-between px-4 md:px-8 z-20 shrink-0">
          <div className="flex items-center">
            <button className="md:hidden p-2 mr-4 text-slate-400 hover:text-white" onClick={() => setShowMobileMenu(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-48 md:w-96 group hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Rechercher..."
                className="w-full pl-12 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500/50 text-sm text-slate-200 placeholder-slate-500 font-medium" />
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <button className="relative p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full border border-slate-700/50">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          {/* === OVERVIEW === */}
          {/* ONGLET FLOTTE LIVE */}
          {activeTab === 'fleet' && (
            <div className="h-full flex flex-col gap-6 relative z-10">
               <div className="flex items-center justify-between">
                 <div>
                    <h2 className="text-2xl font-black text-white">Suivi Global de la Flotte</h2>
                    <p className="text-slate-500 text-sm">Vue en temps réel de tous les livreurs connectés.</p>
                 </div>
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const next = !showHeatmap;
                        setShowHeatmap(next);
                        if (next) fetchHotspots();
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showHeatmap ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                    >
                      {showHeatmap ? 'Masquer Hotspots' : 'Analyse Hotspots'}
                    </button>
                    <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
                       <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                       <span className="text-sm font-bold text-white">{Object.keys(fleetLocs).length} Livreurs actifs</span>
                    </div>
                 </div>
               </div>

               <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
                  <div className="lg:col-span-3 glass-panel rounded-3xl overflow-hidden border border-slate-700/30 relative">
                     <FleetMap 
                        couriersLocs={fleetLocs} 
                        history={locationHistory}
                        selectedCourierId={selectedCourierId}
                        hotspots={showHeatmap ? hotspots : []}
                     />
                     
                     <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                        {Object.entries(fleetLocs).map(([id, loc]) => (
                           <div key={id} className={`bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-lg border text-[10px] font-bold transition-colors ${selectedCourierId === id ? 'border-indigo-500 text-indigo-300' : 'border-slate-700/50 text-indigo-400'}`}>
                             Livreur #{id.substring(0,5)} : {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                           </div>
                        ))}
                     </div>

                     {selectedCourierId && (
                        <>
                           {courierStats && (
                              <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-indigo-500/30 w-48 shadow-2xl animate-in slide-in-from-right duration-300">
                                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Performance</p>
                                 <div className="space-y-4">
                                    <div>
                                       <p className="text-[10px] text-slate-500 font-bold uppercase">Temps Moy. Livraison</p>
                                       <p className="text-lg font-black text-white">{courierStats.avg_delivery_time} <span className="text-xs text-slate-500">min</span></p>
                                    </div>
                                    <div>
                                       <p className="text-[10px] text-slate-500 font-bold uppercase">Activité 7j</p>
                                       <div className="flex items-end gap-1 h-8 mt-1">
                                          {(courierStats.revenue_history || []).map((h, i) => (
                                             <div key={i} className="bg-indigo-500/40 rounded-t w-full" style={{ height: `${Math.min(100, (h.total/5000)*100)}%` }} title={h.total}></div>
                                          ))}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           )}

                           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                              <button 
                                 onClick={() => { setSelectedCourierId(null); setLocationHistory([]); setCourierStats(null); }}
                                 className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700 text-[10px] font-black text-white uppercase tracking-widest hover:bg-slate-800 transition-all"
                              >
                                 Réinitialiser la vue
                              </button>
                           </div>
                        </>
                     )}
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-2">
                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Activité en direct</h3>
                     {Object.entries(fleetLocs).length > 0 ? Object.entries(fleetLocs).map(([id, loc]) => (
                        <div key={id} className={`glass-panel p-4 rounded-2xl border transition-all group ${selectedCourierId === id ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-600'}`}>
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${selectedCourierId === id ? 'bg-indigo-500 text-white' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                 {id.substring(0,2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-bold text-white truncate">Livreur #{id.substring(0,8)}</p>
                                 <p className="text-[10px] text-slate-500">Dernier signal : {new Date(loc.timestamp).toLocaleTimeString()}</p>
                              </div>
                           </div>
                           <div className="mt-4 flex justify-between items-center">
                              <span className="text-[10px] font-bold px-2 py-1 bg-green-500/10 text-green-400 rounded-lg">En ligne</span>
                              <div className="flex gap-2">
                                 <button 
                                    onClick={() => setSelectedCourierId(id)}
                                    className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300"
                                 >
                                    Zoomer
                                 </button>
                                 <button 
                                    onClick={() => fetchCourierHistory(id)}
                                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white"
                                 >
                                    Trajet
                                 </button>
                              </div>
                           </div>
                        </div>
                     )) : (
                        <div className="text-center py-20 glass-panel rounded-2xl border-2 border-dashed border-slate-800">
                           <MapPin className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                           <p className="text-xs font-bold text-slate-600">Aucun signal reçu</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Tableau de Bord</h2>
                  <p className="text-slate-400 mt-1 font-medium text-sm md:text-base">Suivi en temps réel de l'activité.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                <div className="metric-card">
                  <div className="flex justify-between items-start w-full mb-4">
                    <div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">CA du jour</p>
                      <h3 className="text-xl md:text-2xl font-black text-white">{formatPrice(totalRevenue)}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                      <TrendingUp className="text-indigo-400 w-5 h-5 md:w-6 md:h-6" />
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="flex justify-between items-start w-full mb-4">
                    <div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Commandes (Jour)</p>
                      <h3 className="text-xl md:text-2xl font-black text-white">{totalOrders}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                      <Activity className="text-orange-400 w-5 h-5 md:w-6 md:h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-500">{activeOrdersCount} en cours</p>
                </div>

                <div className="metric-card">
                  <div className="flex justify-between items-start w-full mb-4">
                    <div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Actifs</p>
                      <h3 className="text-xl md:text-2xl font-black text-white">{userCounts.restaurant || 0} / {userCounts.livreur || 0}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <Bike className="text-blue-400 w-5 h-5 md:w-6 md:h-6" />
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-500">Restos / Livreurs</p>
                </div>

                <div className="metric-card">
                  <div className="flex justify-between items-start w-full py-1">
                    <div className="w-full">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-3">Paiements</p>
                      <div className="space-y-1 md:space-y-2">
                        {payments.map(p => (
                          <div key={p.payment_method} className="flex items-center justify-between text-[11px] md:text-xs">
                            <span className="font-semibold text-slate-300 capitalize truncate max-w-[80px]">{p.payment_method === 'orange_money' ? 'OM' : p.payment_method}</span>
                            <span className="font-bold text-white">{Math.round(parseInt(p.count) / totalPayments * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commandes récentes */}
              <div className="glass-panel rounded-2xl overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-indigo-400" /> Commandes récentes
                  </h3>
                  <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-indigo-400 hover:text-indigo-300">Voir tout</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                        <th className="px-6 py-4 font-bold">ID</th>
                        <th className="px-6 py-4 font-bold">Client</th>
                        <th className="px-6 py-4 font-bold">Restaurant</th>
                        <th className="px-6 py-4 font-bold">Livreur</th>
                        <th className="px-6 py-4 font-bold">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard?.recentOrders || []).map(row => {
                        const st = statusLabel(row.status);
                        return (
                          <tr key={row.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-white text-sm">#{row.id}</td>
                            <td className="px-6 py-4 text-sm text-slate-300">{row.client_name}</td>
                            <td className="px-6 py-4 text-sm text-slate-300">{row.restaurant_name}</td>
                            <td className="px-6 py-4 text-sm text-slate-400">{row.courier_name}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.label}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-white text-sm">{formatPrice(row.total_amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* === RESTAURANTS === */}
          {activeTab === 'restaurants' && (
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-6">Restaurants</h2>
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                        <th className="px-6 py-4 font-bold">Nom</th>
                        <th className="px-6 py-4 font-bold">Téléphone</th>
                        <th className="px-6 py-4 font-bold">Plats</th>
                        <th className="px-6 py-4 font-bold">Commandes</th>
                        <th className="px-6 py-4 font-bold">Revenus</th>
                        <th className="px-6 py-4 font-bold">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(restaurants.data || []).map(r => (
                        <tr key={r.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-white text-sm">{r.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{r.phone}</td>
                          <td className="px-6 py-4 text-sm text-slate-300">{r.menu_count}</td>
                          <td className="px-6 py-4 text-sm text-slate-300">{r.total_orders}</td>
                          <td className="px-6 py-4 text-sm font-bold text-white">{formatPrice(r.total_revenue)}</td>
                          <td className="px-6 py-4">
                             <div className="flex items-center">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${r.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-100'}`}>
                                  {r.is_active ? 'Actif' : 'En attente'}
                                </span>
                                {!r.is_active && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleToggleUser(r.id, r.is_active)} className="text-slate-400 hover:text-white p-1">
                              {r.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={restaurants.pagination} onPageChange={fetchRestaurants} />
              </div>
            </div>
          )}

          {/* === LIVREURS === */}
          {activeTab === 'couriers' && (
            <div className="relative z-10 animate-in fade-in duration-500">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-6">Livreurs</h2>
              <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                        <th className="px-6 py-4 font-bold">Nom</th>
                        <th className="px-6 py-4 font-bold">Contact</th>
                        <th className="px-6 py-4 font-bold">Livraisons</th>
                        <th className="px-6 py-4 font-bold">Total Encaissé</th>
                        <th className="px-6 py-4 font-bold">Position</th>
                        <th className="px-6 py-4 font-bold">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(couriers.data || []).map(c => (
                        <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                             <div className="flex items-center">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1e1b4b&color=818cf8`} className="w-8 h-8 rounded-full mr-3 border border-indigo-500/30" alt="" />
                                <span className="font-bold text-white text-sm">{c.name}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">{c.phone}</td>
                          <td className="px-6 py-4 text-sm text-slate-300 font-bold">{c.total_deliveries}</td>
                          <td className="px-6 py-4 text-sm font-bold text-white">{formatPrice(c.total_amount)}</td>
                          <td className="px-6 py-4">
                             {c.latitude ? (
                               <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">Actif</span>
                             ) : (
                               <span className="text-[10px] font-bold text-slate-500">Inconnu</span>
                             )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${c.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {c.is_active ? 'Actif' : 'Bloqué'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleToggleUser(c.id, c.is_active)} className="text-slate-400 hover:text-white p-1">
                              {c.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-red-500" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={couriers.pagination} onPageChange={fetchCouriers} />
              </div>
            </div>
          )}

          {/* === CLIENTS === */}
          {activeTab === 'clients' && (
            <div className="relative z-10 animate-in fade-in duration-500">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-6">Clients</h2>
              <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                        <th className="px-6 py-4 font-bold">Nom</th>
                        <th className="px-6 py-4 font-bold">Contact</th>
                        <th className="px-6 py-4 font-bold">Commandes</th>
                        <th className="px-6 py-4 font-bold">Total Dépensé</th>
                        <th className="px-6 py-4 font-bold">Inscrit le</th>
                        <th className="px-6 py-4 font-bold">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clients.data || []).map(c => (
                        <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-white text-sm">{c.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{c.phone}</td>
                          <td className="px-6 py-4 text-sm text-slate-300 font-bold">{c.total_orders}</td>
                          <td className="px-6 py-4 text-sm font-bold text-indigo-400">{formatPrice(c.total_spent)}</td>
                          <td className="px-6 py-4 text-xs text-slate-500">{formatDate(c.created_at)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${c.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {c.is_active ? 'Actif' : 'Banni'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleToggleUser(c.id, c.is_active)} className="text-slate-400 hover:text-white p-1">
                              {c.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-red-500" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={clients.pagination} onPageChange={fetchClients} />
              </div>
            </div>
          )}

          {/* === COMMANDES === */}
          {activeTab === 'orders' && (
            <div className="relative z-10 animate-in fade-in duration-500">
               <h2 className="text-2xl md:text-3xl font-black text-white mb-6">Toutes les Commandes</h2>
               <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                        <th className="px-6 py-4 font-bold">ID</th>
                        <th className="px-6 py-4 font-bold">Client</th>
                        <th className="px-6 py-4 font-bold">Restaurant</th>
                        <th className="px-6 py-4 font-bold">Livreur</th>
                        <th className="px-6 py-4 font-bold">Date</th>
                        <th className="px-6 py-4 font-bold">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orders.data || []).map(row => {
                        const st = statusLabel(row.status);
                        return (
                          <tr key={row.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-white text-sm">#{row.id}</td>
                            <td className="px-6 py-4">
                               <p className="text-sm font-bold text-slate-300">{row.client_name}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-300">{row.restaurant_name}</td>
                            <td className="px-6 py-4 text-xs text-slate-400 capitalize">{row.courier_name}</td>
                            <td className="px-6 py-4 text-[10px] text-slate-500">{formatDate(row.created_at)}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${st.cls}`}>{st.label.toUpperCase()}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-white text-sm">{formatPrice(row.total_amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={orders.pagination} onPageChange={fetchOrders} />
              </div>
            </div>
          )}

          {/* === PAYOUTS (APPROVALS) === */}
          {activeTab === 'payouts' && (
            <div className="relative z-10 animate-in fade-in duration-500">
               <h2 className="text-2xl md:text-3xl font-black text-white mb-6">Demandes de Retrait</h2>
               <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                        <th className="px-6 py-4 font-bold">Demandeur</th>
                        <th className="px-6 py-4 font-bold">Rôle</th>
                        <th className="px-6 py-4 font-bold">Montant</th>
                        <th className="px-6 py-4 font-bold">Méthode</th>
                        <th className="px-6 py-4 font-bold">Date</th>
                        <th className="px-6 py-4 font-bold">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map(p => (
                        <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                             <p className="text-sm font-bold text-white">{p.user_name}</p>
                             <p className="text-[10px] text-slate-500">{p.user_phone}</p>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">{p.user_role}</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-white">{formatPrice(p.amount)}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{p.method}</td>
                          <td className="px-6 py-4 text-[10px] text-slate-500">{formatDate(p.created_at)}</td>
                          <td className="px-6 py-4">
                             <span className={`text-[10px] font-black px-2 py-1 rounded-full ${p.status === 'paye' ? 'bg-green-500/10 text-green-400' : p.status === 'rejete' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400 animate-pulse'}`}>
                                {p.status.toUpperCase()}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             {p.status === 'en_attente' && (
                               <div className="flex justify-end gap-2">
                                  <button onClick={() => handleUpdatePayout(p.id, 'rejete')} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><X className="w-4 h-4" /></button>
                                  <button onClick={() => handleUpdatePayout(p.id, 'paye')} className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20"><Check className="w-4 h-4" /></button>
                               </div>
                             )}
                          </td>
                        </tr>
                      ))}
                      {payouts.length === 0 && (
                        <tr><td colSpan="7" className="py-20 text-center text-slate-500 italic">Aucune demande en attente</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* === DEPOSITS (APPROVALS) === */}
          {activeTab === 'deposits' && (
            <div className="relative z-10 animate-in fade-in duration-500">
               <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Dépôts en attente</h2>
               <p className="text-sm text-slate-500 mb-6">Vérifiez la référence de transaction reçue par SMS avant de confirmer.</p>
               <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                        <th className="px-6 py-4 font-bold">Utilisateur</th>
                        <th className="px-6 py-4 font-bold">Montant</th>
                        <th className="px-6 py-4 font-bold">Méthode</th>
                        <th className="px-6 py-4 font-bold">Référence</th>
                        <th className="px-6 py-4 font-bold">Date</th>
                        <th className="px-6 py-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map(d => (
                        <tr key={d.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                             <p className="text-sm font-bold text-white">{d.user_name}</p>
                             <p className="text-[10px] text-slate-500">{d.user_phone}</p>
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-white">{formatPrice(d.amount)}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{d.payment_method}</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-300">{d.transaction_ref}</td>
                          <td className="px-6 py-4 text-[10px] text-slate-500">{formatDate(d.created_at)}</td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2">
                                <button onClick={() => handleUpdateDeposit(d.id, 'rejected')} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><X className="w-4 h-4" /></button>
                                <button onClick={() => handleUpdateDeposit(d.id, 'completed')} className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20"><Check className="w-4 h-4" /></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                      {deposits.length === 0 && (
                        <tr><td colSpan="6" className="py-20 text-center text-slate-500 italic">Aucun dépôt en attente</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* === PROMOTIONS === */}
          {activeTab === 'promotions' && (
            <div className="relative z-10 animate-in fade-in duration-500">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-black text-white">Codes Promo Plateforme</h2>
                  <button onClick={() => setShowPromoModal(true)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 hover:scale-105 transition-transform">
                     <Plus className="w-4 h-4" /> Créer
                  </button>
               </div>
               
               <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-800/30 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                          <th className="px-6 py-4 font-bold">Code</th>
                          <th className="px-6 py-4 font-bold">Réduction</th>
                          <th className="px-6 py-4 font-bold">Restaurant</th>
                          <th className="px-6 py-4 font-bold">Utilisations</th>
                          <th className="px-6 py-4 font-bold">Statut</th>
                          <th className="px-6 py-4 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(promos.data || []).map(p => (
                          <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4">
                               <span className="bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-black tracking-widest">{p.code}</span>
                               <p className="text-[10px] text-slate-500 mt-1">{p.description || 'SANS DESCRIPTION'}</p>
                            </td>
                            <td className="px-6 py-4">
                               <span className="text-sm font-black text-white">{p.discount_value}{p.discount_type === 'percentage' ? '%' : ' FCFA'}</span>
                               <p className="text-[9px] text-slate-500">Min. {formatPrice(p.min_order_amount)}</p>
                            </td>
                            <td className="px-6 py-4">
                               <span className="text-xs text-slate-400 font-bold">{p.restaurant_name || 'PLATEFORME'}</span>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500">{p.current_uses} / {p.max_uses === 0 ? '∞' : p.max_uses}</td>
                            <td className="px-6 py-4">
                               <button onClick={() => handleTogglePromo(p.id)} className={`px-2 py-1 rounded-full text-[9px] font-black ${p.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'}`}>
                                  {p.is_active ? 'ACTIF' : 'INACTIF'}
                               </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <button onClick={() => handleDeletePromo(p.id)} className="p-2 text-slate-600 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination pagination={promos.pagination} onPageChange={fetchPromos} />
               </div>
            </div>
          )}

          {/* === CONFIGURATION === */}
          {activeTab === 'settings' && (
            <div className="relative z-10 animate-in fade-in duration-500">
               <h2 className="text-2xl md:text-3xl font-black text-white mb-6">Configuration Globale</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-panel p-8 rounded-3xl border border-slate-700/30">
                     <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Wallet className="w-5 h-5 text-indigo-400" /> Paramètres Financiers</h3>
                     <div className="space-y-6">
                        <div>
                           <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Commission Plateforme (%)</label>
                           <input type="number" defaultValue="15" className="w-full bg-slate-800 border-none rounded-xl px-4 py-3 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4 transition-all" />
                        </div>
                        <div>
                           <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Frais de Livraison Fixe (Dakar)</label>
                           <input type="number" defaultValue="1000" className="w-full bg-slate-800 border-none rounded-xl px-4 py-3 text-white font-bold outline-none ring-indigo-500/20 focus:ring-4 transition-all" />
                        </div>
                        <button className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30">Sauvegarder les changements</button>
                     </div>
                  </div>
                  <div className="glass-panel p-8 rounded-3xl border border-slate-700/30">
                     <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-green-400" /> Statut du Système</h3>
                     <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl">
                           <div>
                              <p className="text-sm font-bold text-white">Mode Maintenance</p>
                              <p className="text-[10px] text-slate-500">Désactiver les commandes clients</p>
                           </div>
                           <ToggleLeft className="w-8 h-8 text-slate-600" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl">
                           <div>
                              <p className="text-sm font-bold text-white">Rapport Hebdomadaire Auto</p>
                              <p className="text-[10px] text-slate-500">Envoyer par email aux admins</p>
                           </div>
                           <ToggleRight className="w-8 h-8 text-green-400" />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* FRAUD ALERTS */}
          {activeTab === 'fraud' && (
            <div className="relative z-10 animate-in fade-in duration-500">
              <FraudAlertsPanel />
            </div>
          )}

          {/* SUPPORT TICKETS */}
          {activeTab === 'support' && (
            <div className="relative z-10 animate-in fade-in duration-500">
              <SupportTicketsPanel />
            </div>
          )}

          {/* DELIVERY ZONES */}
          {activeTab === 'delivery_zones' && (
            <div className="relative z-10 animate-in fade-in duration-500">
              <DeliveryZonesPanel />
            </div>
          )}

          {/* GAMIFICATION ADMIN */}
          {activeTab === 'gamification' && (
            <div className="relative z-10 animate-in fade-in duration-500">
              <GamificationPanel />
            </div>
          )}

          {/* MONITORING SYSTÈME */}
          {activeTab === 'monitoring' && (
            <div className="relative z-10 animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white mb-6">Monitoring Système 📊</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'API Latence', value: '45ms', icon: '⚡', color: 'from-green-500 to-emerald-600', status: 'OK' },
                  { label: 'Uptime', value: '99.97%', icon: '🟢', color: 'from-blue-500 to-indigo-600', status: 'OK' },
                  { label: 'Connexions Socket', value: '234', icon: '🔌', color: 'from-purple-500 to-violet-600', status: 'Actif' },
                  { label: 'Erreurs (24h)', value: '3', icon: '⚠️', color: 'from-yellow-500 to-orange-600', status: 'Faible' },
                ].map((m, i) => (
                  <div key={i} className={`bg-gradient-to-br ${m.color} rounded-2xl p-5 shadow-lg`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{m.icon}</span>
                      <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{m.status}</span>
                    </div>
                    <p className="text-2xl font-black text-white">{m.value}</p>
                    <p className="text-xs text-white/70 font-bold">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* System Health */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
                  <h3 className="text-lg font-black text-white mb-4">Santé des Services</h3>
                  <div className="space-y-3">
                    {[
                      { name: 'API Backend', status: 'online', latency: '45ms' },
                      { name: 'PostgreSQL', status: 'online', latency: '12ms' },
                      { name: 'Socket.IO', status: 'online', latency: '3ms' },
                      { name: 'Wave Payment', status: 'online', latency: '120ms' },
                      { name: 'Orange Money', status: 'online', latency: '95ms' },
                      { name: 'Nominatim (Geo)', status: 'online', latency: '200ms' },
                      { name: 'Push Notifications', status: 'online', latency: '50ms' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${s.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                          <span className="text-sm font-bold text-slate-300">{s.name}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500">{s.latency}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
                  <h3 className="text-lg font-black text-white mb-4">Activité Temps Réel</h3>
                  <div className="space-y-3">
                    {[
                      { time: '14:32', event: 'Nouvelle commande #1245', type: 'order' },
                      { time: '14:30', event: 'Livreur Moussa connecté', type: 'driver' },
                      { time: '14:28', event: 'Paiement Wave confirmé', type: 'payment' },
                      { time: '14:25', event: 'Commande #1244 livrée', type: 'delivery' },
                      { time: '14:22', event: 'Inscription nouveau client', type: 'user' },
                      { time: '14:20', event: 'Alerte stock bas: Tiep', type: 'alert' },
                      { time: '14:18', event: 'Avis 5⭐ Chef Ousmane', type: 'review' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <span className="text-[10px] font-mono text-slate-600 w-10">{e.time}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          e.type === 'order' ? 'bg-blue-500' :
                          e.type === 'driver' ? 'bg-green-500' :
                          e.type === 'payment' ? 'bg-purple-500' :
                          e.type === 'delivery' ? 'bg-emerald-500' :
                          e.type === 'alert' ? 'bg-yellow-500' :
                          e.type === 'review' ? 'bg-yellow-400' :
                          'bg-indigo-500'
                        }`}></span>
                        <span className="text-sm text-slate-400">{e.event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL PROMO */}
      {showPromoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-700 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
              <h3 className="text-xl font-black text-white mb-6">Nouveau Code Promo</h3>
              <form onSubmit={handleCreatePromo} className="space-y-4">
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">CODE (Ex: NOOREAT10)</label>
                    <input type="text" value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value})} required className="w-full bg-slate-800 border-none rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Type</label>
                       <select value={promoForm.discount_type} onChange={e => setPromoForm({...promoForm, discount_type: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="percentage">Pourcentage (%)</option>
                          <option value="fixed">Fixe (FCFA)</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Valeur</label>
                       <input type="number" value={promoForm.discount_value} onChange={e => setPromoForm({...promoForm, discount_value: e.target.value})} required className="w-full bg-slate-800 border-none rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mini Commande (FCFA)</label>
                    <input type="number" value={promoForm.min_order_amount} onChange={e => setPromoForm({...promoForm, min_order_amount: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                 </div>
                 <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setShowPromoModal(false)} className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl">Annuler</button>
                    <button type="submit" className="flex-2 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30">Créer le code</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

// ===== FRAUD ALERTS PANEL =====
function FraudAlertsPanel() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadAlerts(); }, [filter]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') params.resolved = filter === 'resolved';
      const data = await fraudAPI.getAlerts(params);
      setAlerts(data.data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const resolve = async (id) => {
    try {
      await fraudAPI.resolve(id);
      loadAlerts();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  const severityColors = { low: 'bg-blue-500/20 text-blue-400', medium: 'bg-yellow-500/20 text-yellow-400', high: 'bg-orange-500/20 text-orange-400', critical: 'bg-red-500/20 text-red-400' };

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-2">Détection de Fraude</h2>
      <p className="text-sm text-slate-500 mb-6">Alertes automatiques sur les comportements suspects</p>

      <div className="flex gap-2 mb-6">
        {['all', 'unresolved', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f === 'all' ? 'Toutes' : f === 'unresolved' ? 'Non résolues' : 'Résolues'}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div> : (
        <div className="space-y-3">
          {alerts.map((a, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 border border-slate-700/30">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${severityColors[a.severity]}`}>{a.severity}</span>
                  <div>
                    <p className="font-bold text-white text-sm">{a.alert_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-400 mt-1">{a.description}</p>
                    <p className="text-[10px] text-slate-600 mt-1">User: {a.user_name || `#${a.user_id}`} {a.order_id ? `| Commande #${a.order_id}` : ''}</p>
                  </div>
                </div>
                {!a.is_resolved ? (
                  <button onClick={() => resolve(a.id)} className="bg-green-600/20 text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600/30">Résoudre</button>
                ) : (
                  <span className="text-green-400 text-xs font-bold">Résolu</span>
                )}
              </div>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-slate-500 text-center py-10">Aucune alerte de fraude</p>}
        </div>
      )}
    </div>
  );
}

// ===== SUPPORT TICKETS PANEL =====
function SupportTicketsPanel() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    try {
      const data = await supportAPI.getAll();
      setTickets(data.data || data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    try {
      const data = await supportAPI.getTicket(ticket.id);
      setMessages(data.messages || []);
    } catch(e) { console.error(e); }
  };

  const reply = async () => {
    if (!replyText.trim()) return;
    try {
      await supportAPI.reply(selectedTicket.id, replyText);
      setReplyText('');
      openTicket(selectedTicket);
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  const statusColors = { open: 'bg-blue-500/20 text-blue-400', in_progress: 'bg-yellow-500/20 text-yellow-400', resolved: 'bg-green-500/20 text-green-400', closed: 'bg-slate-500/20 text-slate-400' };

  if (selectedTicket) return (
    <div>
      <button onClick={() => setSelectedTicket(null)} className="flex items-center text-sm text-slate-400 hover:text-white font-bold mb-4"><ChevronLeft className="w-4 h-4 mr-1" /> Retour</button>
      <div className="glass-panel rounded-2xl p-6 border border-slate-700/30">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-bold text-white text-lg">{selectedTicket.subject}</h3>
            <p className="text-xs text-slate-500">#{selectedTicket.id} - {selectedTicket.category}</p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${statusColors[selectedTicket.status]}`}>{selectedTicket.status}</span>
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`rounded-xl p-4 ${m.is_admin ? 'bg-indigo-900/30 ml-8' : 'bg-slate-800/50 mr-8'}`}>
              <p className="text-xs font-bold text-slate-500 mb-1">{m.is_admin ? 'Admin' : 'Client'}</p>
              <p className="text-sm text-white">{m.message}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Répondre..." className="flex-1 bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" onKeyDown={e => e.key === 'Enter' && reply()} />
          <button onClick={reply} className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold text-sm">Envoyer</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-6">Support Tickets</h2>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" /> : (
        <div className="space-y-3">
          {tickets.map((t, i) => (
            <div key={i} onClick={() => openTicket(t)} className="glass-panel rounded-2xl p-5 border border-slate-700/30 cursor-pointer hover:border-indigo-500/30 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white text-sm">{t.subject}</p>
                  <p className="text-xs text-slate-500 mt-1">{t.category} - {new Date(t.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${statusColors[t.status]}`}>{t.status}</span>
              </div>
            </div>
          ))}
          {tickets.length === 0 && <p className="text-slate-500 text-center py-10">Aucun ticket</p>}
        </div>
      )}
    </div>
  );
}

// ===== DELIVERY ZONES PANEL =====
function DeliveryZonesPanel() {
  const [zones, setZones] = useState([]);
  const [relayPoints, setRelayPoints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', base_fee: '', price_per_km: '', max_distance_km: '' });
  const [tab, setTab] = useState('zones');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [z, r] = await Promise.all([deliveryZoneAPI.getAll(), deliveryZoneAPI.getRelayPoints()]);
      setZones(z || []);
      setRelayPoints(r || []);
    } catch(e) { console.error(e); }
  };

  const createZone = async () => {
    try {
      await deliveryZoneAPI.create({ ...form, base_fee: parseFloat(form.base_fee), price_per_km: parseFloat(form.price_per_km), max_distance_km: form.max_distance_km ? parseFloat(form.max_distance_km) : null });
      setShowForm(false);
      setForm({ name: '', base_fee: '', price_per_km: '', max_distance_km: '' });
      loadData();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-2">Zones de Livraison</h2>
      <p className="text-sm text-slate-500 mb-6">Gérez les tarifs dynamiques par zone</p>

      <div className="flex gap-2 mb-6">
        {['zones', 'relay'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {t === 'zones' ? 'Zones' : 'Points Relais'}
          </button>
        ))}
        <button onClick={() => setShowForm(!showForm)} className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
          <Plus className="w-4 h-4 inline mr-1" />{tab === 'zones' ? 'Zone' : 'Point relais'}
        </button>
      </div>

      {showForm && tab === 'zones' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-700/30 mb-6 space-y-3">
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nom de la zone" className="w-full bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          <div className="grid grid-cols-3 gap-3">
            <input type="number" value={form.base_fee} onChange={e => setForm({...form, base_fee: e.target.value})} placeholder="Frais base (FCFA)" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            <input type="number" value={form.price_per_km} onChange={e => setForm({...form, price_per_km: e.target.value})} placeholder="Prix/km" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            <input type="number" value={form.max_distance_km} onChange={e => setForm({...form, max_distance_km: e.target.value})} placeholder="Max km" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          </div>
          <button onClick={createZone} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm">Créer la zone</button>
        </div>
      )}

      {tab === 'zones' && (
        <div className="space-y-3">
          {zones.map((z, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 border border-slate-700/30 flex justify-between items-center">
              <div>
                <p className="font-bold text-white">{z.name}</p>
                <p className="text-xs text-slate-500">Base: {parseFloat(z.base_fee).toLocaleString()} F + {parseFloat(z.price_per_km).toLocaleString()} F/km {z.max_distance_km ? `(max ${z.max_distance_km} km)` : ''}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${z.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {z.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
          {zones.length === 0 && <p className="text-slate-500 text-center py-8">Aucune zone configurée</p>}
        </div>
      )}

      {tab === 'relay' && (
        <div className="space-y-3">
          {relayPoints.map((r, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 border border-slate-700/30">
              <p className="font-bold text-white">{r.name}</p>
              <p className="text-xs text-slate-500">{r.address}</p>
              {r.opening_hours && <p className="text-xs text-slate-600">{r.opening_hours}</p>}
            </div>
          ))}
          {relayPoints.length === 0 && <p className="text-slate-500 text-center py-8">Aucun point relais</p>}
        </div>
      )}
    </div>
  );
}

// ===== GAMIFICATION PANEL =====
function GamificationPanel() {
  const [tab, setTab] = useState('badges');
  const [badges, setBadges] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [badgeForm, setBadgeForm] = useState({ name: '', description: '', icon: '', condition_type: 'order_count', condition_value: '', reward_points: '' });
  const [challengeForm, setChallengeForm] = useState({ title: '', description: '', type: 'weekly', target_value: '', reward_type: 'points', reward_value: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [b, c] = await Promise.all([gamificationAPI.getBadges(), gamificationAPI.getChallenges()]);
      setBadges(b || []);
      setChallenges(c || []);
    } catch(e) { console.error(e); }
  };

  const createBadge = async () => {
    try {
      await gamificationAPI.createBadge({ ...badgeForm, condition_value: parseInt(badgeForm.condition_value), reward_points: parseInt(badgeForm.reward_points) || 0 });
      setBadgeForm({ name: '', description: '', icon: '', condition_type: 'order_count', condition_value: '', reward_points: '' });
      setShowForm(false);
      loadData();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  const createChallenge = async () => {
    try {
      await gamificationAPI.createChallenge({ ...challengeForm, target_value: parseInt(challengeForm.target_value) });
      setChallengeForm({ title: '', description: '', type: 'weekly', target_value: '', reward_type: 'points', reward_value: '' });
      setShowForm(false);
      loadData();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-2">Gamification</h2>
      <p className="text-sm text-slate-500 mb-6">Gérez les badges, défis et récompenses</p>

      <div className="flex gap-2 mb-6">
        {['badges', 'challenges'].map(t => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false); }} className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {t === 'badges' ? 'Badges' : 'Défis'}
          </button>
        ))}
        <button onClick={() => setShowForm(!showForm)} className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
          <Plus className="w-4 h-4 inline mr-1" /> Créer
        </button>
      </div>

      {showForm && tab === 'badges' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-700/30 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={badgeForm.name} onChange={e => setBadgeForm({...badgeForm, name: e.target.value})} placeholder="Nom du badge" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            <input type="text" value={badgeForm.icon} onChange={e => setBadgeForm({...badgeForm, icon: e.target.value})} placeholder="Icône (emoji)" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          </div>
          <input type="text" value={badgeForm.description} onChange={e => setBadgeForm({...badgeForm, description: e.target.value})} placeholder="Description" className="w-full bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          <div className="grid grid-cols-3 gap-3">
            <select value={badgeForm.condition_type} onChange={e => setBadgeForm({...badgeForm, condition_type: e.target.value})} className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none">
              <option value="order_count">Nb commandes</option>
              <option value="total_spent">Total dépensé</option>
              <option value="referral_count">Nb parrainages</option>
            </select>
            <input type="number" value={badgeForm.condition_value} onChange={e => setBadgeForm({...badgeForm, condition_value: e.target.value})} placeholder="Valeur cible" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            <input type="number" value={badgeForm.reward_points} onChange={e => setBadgeForm({...badgeForm, reward_points: e.target.value})} placeholder="Points récompense" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          </div>
          <button onClick={createBadge} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm">Créer le badge</button>
        </div>
      )}

      {showForm && tab === 'challenges' && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-700/30 mb-6 space-y-3">
          <input type="text" value={challengeForm.title} onChange={e => setChallengeForm({...challengeForm, title: e.target.value})} placeholder="Titre du défi" className="w-full bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          <input type="text" value={challengeForm.description} onChange={e => setChallengeForm({...challengeForm, description: e.target.value})} placeholder="Description" className="w-full bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={challengeForm.type} onChange={e => setChallengeForm({...challengeForm, type: e.target.value})} className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none">
              <option value="daily">Quotidien</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
            </select>
            <input type="number" value={challengeForm.target_value} onChange={e => setChallengeForm({...challengeForm, target_value: e.target.value})} placeholder="Objectif" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={challengeForm.reward_type} onChange={e => setChallengeForm({...challengeForm, reward_type: e.target.value})} className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none">
              <option value="points">Points</option>
              <option value="discount">Réduction</option>
              <option value="free_item">Plat gratuit</option>
            </select>
            <input type="text" value={challengeForm.reward_value} onChange={e => setChallengeForm({...challengeForm, reward_value: e.target.value})} placeholder="Valeur récompense" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
          </div>
          <button onClick={createChallenge} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm">Créer le défi</button>
        </div>
      )}

      {tab === 'badges' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {badges.map((b, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 border border-slate-700/30 text-center">
              <span className="text-4xl">{b.icon || '🏅'}</span>
              <h4 className="font-bold text-white mt-2">{b.name}</h4>
              <p className="text-xs text-slate-500 mt-1">{b.description}</p>
              <p className="text-[10px] text-indigo-400 font-bold mt-2">{b.condition_type}: {b.condition_value} | +{b.reward_points} pts</p>
            </div>
          ))}
          {badges.length === 0 && <p className="col-span-3 text-slate-500 text-center py-8">Aucun badge créé</p>}
        </div>
      )}

      {tab === 'challenges' && (
        <div className="space-y-3">
          {challenges.map((c, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 border border-slate-700/30">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.type === 'daily' ? 'bg-blue-500/20 text-blue-400' : c.type === 'weekly' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                    {c.type}
                  </span>
                  <h4 className="font-bold text-white mt-2">{c.title}</h4>
                  <p className="text-xs text-slate-500">{c.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-indigo-400 font-bold">Objectif: {c.target_value}</p>
                  <p className="text-xs text-slate-500">Récompense: {c.reward_type} ({c.reward_value})</p>
                </div>
              </div>
            </div>
          ))}
          {challenges.length === 0 && <p className="text-slate-500 text-center py-8">Aucun défi créé</p>}
        </div>
      )}
    </div>
  );
}

export default App;
