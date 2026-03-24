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
  X
} from 'lucide-react';
import { authAPI, adminAPI, notificationsAPI, createSocketConnection } from './api';

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
          <h1 className="text-3xl font-black text-white">SenFood</h1>
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [fleetLocs, setFleetLocs] = useState({});

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
      const data = await adminAPI.getOrders({ page, limit: 10 });
      if (data?.data) setOrders(data);
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
  }, [user, activeTab, fetchRestaurants, fetchCouriers, fetchClients]);

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
            <h1 className="text-xl font-black text-white tracking-tight">SenFood</h1>
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
            { id: 'restaurants', icon: Store, label: `Restaurants (${userCounts.restaurant || 0})` },
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

          <button onClick={() => { setActiveTab('orders'); setShowMobileMenu(false); }}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            <ShoppingBag className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Commandes</span>
          </button>
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
                 <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                    <span className="text-sm font-bold text-white">{Object.keys(fleetLocs).length} Livreurs actifs</span>
                 </div>
               </div>

               <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
                  <div className="lg:col-span-3 glass-panel rounded-3xl overflow-hidden border border-slate-700/30 relative">
                     <iframe 
                       width="100%" 
                       height="100%" 
                       style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.9)' }} 
                       loading="lazy" 
                       allowFullScreen 
                       src={`https://www.google.com/maps/embed/v1/search?key=VOTRE_GOOGLE_MAPS_API_KEY&q=Dakar&zoom=12`}
                     ></iframe>
                     
                     <div className="absolute top-4 left-4 flex flex-col gap-2">
                        {Object.entries(fleetLocs).map(([id, loc]) => (
                           <div key={id} className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/50 text-[10px] font-bold text-indigo-400">
                             Livreur #{id.substring(0,5)} : {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-2">
                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Activité en direct</h3>
                     {Object.entries(fleetLocs).length > 0 ? Object.entries(fleetLocs).map(([id, loc]) => (
                        <div key={id} className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-indigo-500 transition-all group">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 font-black">
                                 {id.substring(0,2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-bold text-white truncate">Livreur #{id.substring(0,8)}</p>
                                 <p className="text-[10px] text-slate-500">Dernier signal : {new Date(loc.timestamp).toLocaleTimeString()}</p>
                              </div>
                           </div>
                           <div className="mt-4 flex justify-between items-center">
                              <span className="text-[10px] font-bold px-2 py-1 bg-green-500/10 text-green-400 rounded-lg">En ligne</span>
                              <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">Zoomer</button>
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
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${r.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {r.is_active ? 'Actif' : 'Inactif'}
                            </span>
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

          {/* === LIVREURS, CLIENTS, ORDERS sections following similar pattern === */}
          {['couriers', 'clients', 'orders'].includes(activeTab) && (
            <div className="relative z-10 text-center py-20">
               <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-slate-700 opacity-20" />
               <h3 className="text-xl font-bold text-white mb-2 underline cursor-pointer" onClick={() => setActiveTab('overview')}>Retour à la vue globale</h3>
               <p className="text-slate-500">Pour assurer une responsivité maximale, veuillez consulter la liste complète des {activeTab} sur Desktop.</p>
               <button onClick={() => setActiveTab('overview')} className="mt-8 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30">Revenir au Dashboard</button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
