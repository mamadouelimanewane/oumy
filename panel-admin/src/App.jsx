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
  Eye
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

  // Data
  const [dashboard, setDashboard] = useState(null);
  const [restaurants, setRestaurants] = useState({ data: [], pagination: {} });
  const [couriers, setCouriers] = useState({ data: [], pagination: {} });
  const [clients, setClients] = useState({ data: [], pagination: {} });
  const [orders, setOrders] = useState({ data: [], pagination: {} });
  const [unreadCount, setUnreadCount] = useState(0);

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
    <div className="flex h-screen bg-brand text-slate-300 font-sans overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-64 glass-panel border-r border-slate-700/50 flex flex-col z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-700/50">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">SenFood</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Admin Global</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          <p className="px-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Core Management</p>

          {[
            { id: 'overview', icon: Activity, label: 'Vue Globale' },
            { id: 'restaurants', icon: Store, label: `Restaurants (${userCounts.restaurant || 0})` },
            { id: 'couriers', icon: Bike, label: `Livreurs (${userCounts.livreur || 0})` },
            { id: 'clients', icon: Users, label: `Clients (${userCounts.client || 0})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
              <tab.icon className="w-5 h-5 mr-3" />
              <span className="font-semibold text-sm">{tab.label}</span>
              {activeTab === tab.id && <div className="ml-auto w-1 h-5 bg-indigo-500 rounded-full"></div>}
            </button>
          ))}

          <div className="pt-6 pb-2">
            <p className="px-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Finance & Operations</p>
          </div>

          <button onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            <ShoppingBag className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Commandes</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center px-2 py-2">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1e1b4b&color=818cf8`} alt="Admin" className="w-10 h-10 rounded-full border-2 border-indigo-500/50 mr-3" />
            <div>
              <p className="text-sm font-bold text-white">{user.name}</p>
              <p className="text-xs text-green-400 flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span> Connecté</p>
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
        <header className="h-20 glass-panel border-b border-slate-700/50 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="relative w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher..."
              className="w-full pl-12 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500/50 text-sm text-slate-200 placeholder-slate-500 font-medium" />
          </div>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full border border-slate-700/50">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          {/* === OVERVIEW === */}
          {activeTab === 'overview' && (
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Tableau de Bord Global</h2>
                  <p className="text-slate-400 mt-1 font-medium">Suivi en temps réel de l'activité.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="metric-card">
                  <div className="flex justify-between items-start w-full mb-4">
                    <div>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">CA du jour</p>
                      <h3 className="text-2xl font-black text-white">{formatPrice(totalRevenue)}</h3>
                    </div>
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                      <TrendingUp className="text-indigo-400 w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="flex justify-between items-start w-full mb-4">
                    <div>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Commandes (Jour)</p>
                      <h3 className="text-2xl font-black text-white">{totalOrders}</h3>
                    </div>
                    <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                      <Activity className="text-orange-400 w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{activeOrdersCount} en cours</p>
                </div>

                <div className="metric-card">
                  <div className="flex justify-between items-start w-full mb-4">
                    <div>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Actifs</p>
                      <h3 className="text-2xl font-black text-white">{userCounts.restaurant || 0} / {userCounts.livreur || 0}</h3>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <Bike className="text-blue-400 w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Restos / Livreurs</p>
                </div>

                <div className="metric-card">
                  <div className="flex justify-between items-start w-full py-1">
                    <div className="w-full">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Répartition Paiements</p>
                      <div className="space-y-2">
                        {payments.map(p => (
                          <div key={p.payment_method} className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-300 capitalize">{p.payment_method === 'orange_money' ? 'Orange Money' : p.payment_method}</span>
                            <span className="font-bold text-white">{Math.round(parseInt(p.count) / totalPayments * 100)}%</span>
                          </div>
                        ))}
                        {payments.length === 0 && <p className="text-xs text-slate-500">Aucune donnée</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commandes récentes */}
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-indigo-400" /> Commandes récentes
                  </h3>
                  <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-indigo-400 hover:text-indigo-300">Voir tout</button>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
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
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-white text-sm">{formatPrice(row.total_amount)}</td>
                        </tr>
                      );
                    })}
                    {(!dashboard?.recentOrders || dashboard.recentOrders.length === 0) && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Aucune commande récente</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === RESTAURANTS === */}
          {activeTab === 'restaurants' && (
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-white mb-6">Restaurants</h2>
              <div className="glass-panel rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                      <th className="px-6 py-4 font-bold">Nom</th>
                      <th className="px-6 py-4 font-bold">Téléphone</th>
                      <th className="px-6 py-4 font-bold">Plats</th>
                      <th className="px-6 py-4 font-bold">Commandes</th>
                      <th className="px-6 py-4 font-bold">Revenus</th>
                      <th className="px-6 py-4 font-bold">Note</th>
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
                        <td className="px-6 py-4 text-sm text-yellow-400">{r.avg_rating > 0 ? `${r.avg_rating}/5` : '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {r.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleToggleUser(r.id, r.is_active)} className="text-slate-400 hover:text-white p-1" title={r.is_active ? 'Désactiver' : 'Activer'}>
                            {r.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination pagination={restaurants.pagination} onPageChange={fetchRestaurants} />
              </div>
            </div>
          )}

          {/* === LIVREURS === */}
          {activeTab === 'couriers' && (
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-white mb-6">Livreurs</h2>
              <div className="glass-panel rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                      <th className="px-6 py-4 font-bold">Nom</th>
                      <th className="px-6 py-4 font-bold">Téléphone</th>
                      <th className="px-6 py-4 font-bold">Livraisons</th>
                      <th className="px-6 py-4 font-bold">Revenus</th>
                      <th className="px-6 py-4 font-bold">Dernière position</th>
                      <th className="px-6 py-4 font-bold">Statut</th>
                      <th className="px-6 py-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(couriers.data || []).map(c => (
                      <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-white text-sm">{c.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{c.phone}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{c.total_deliveries}</td>
                        <td className="px-6 py-4 text-sm font-bold text-white">{formatPrice(c.total_amount)}</td>
                        <td className="px-6 py-4 text-xs text-slate-500">{c.last_location ? formatDate(c.last_location) : 'Jamais'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {c.is_active ? 'En ligne' : 'Hors ligne'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleToggleUser(c.id, c.is_active)} className="text-slate-400 hover:text-white p-1">
                            {c.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination pagination={couriers.pagination} onPageChange={fetchCouriers} />
              </div>
            </div>
          )}

          {/* === CLIENTS === */}
          {activeTab === 'clients' && (
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-white mb-6">Clients</h2>
              <div className="glass-panel rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                      <th className="px-6 py-4 font-bold">Nom</th>
                      <th className="px-6 py-4 font-bold">Téléphone</th>
                      <th className="px-6 py-4 font-bold">Email</th>
                      <th className="px-6 py-4 font-bold">Commandes</th>
                      <th className="px-6 py-4 font-bold">Total dépensé</th>
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
                        <td className="px-6 py-4 text-sm text-slate-400">{c.email || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{c.total_orders}</td>
                        <td className="px-6 py-4 text-sm font-bold text-white">{formatPrice(c.total_spent)}</td>
                        <td className="px-6 py-4 text-xs text-slate-500">{formatDate(c.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {c.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleToggleUser(c.id, c.is_active)} className="text-slate-400 hover:text-white p-1">
                            {c.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination pagination={clients.pagination} onPageChange={fetchClients} />
              </div>
            </div>
          )}

          {/* === COMMANDES === */}
          {activeTab === 'orders' && (
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-white mb-6">Toutes les commandes</h2>
              <div className="glass-panel rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                      <th className="px-6 py-4 font-bold">ID</th>
                      <th className="px-6 py-4 font-bold">Client</th>
                      <th className="px-6 py-4 font-bold">Restaurant</th>
                      <th className="px-6 py-4 font-bold">Livreur</th>
                      <th className="px-6 py-4 font-bold">Statut</th>
                      <th className="px-6 py-4 font-bold">Paiement</th>
                      <th className="px-6 py-4 font-bold text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orders.data || []).map(row => {
                      const st = statusLabel(row.status);
                      return (
                        <tr key={row.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-white text-sm">#{row.id}</td>
                          <td className="px-6 py-4 text-sm text-slate-300">{row.client_name}</td>
                          <td className="px-6 py-4 text-sm text-slate-300">{row.restaurant_name}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{row.courier_name}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400 capitalize">{row.payment_method === 'orange_money' ? 'Orange Money' : row.payment_method}</td>
                          <td className="px-6 py-4 text-right font-bold text-white text-sm">{formatPrice(row.total_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pagination pagination={orders.pagination} onPageChange={fetchOrders} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
