import React, { useState, useEffect, useCallback } from 'react';
import {
  BellRing,
  Utensils,
  LayoutDashboard,
  Package,
  FileText,
  LogOut,
  Search,
  CheckCircle2,
  Clock,
  Bike,
  Plus,
  Edit,
  Trash2,
  Phone,
  Eye,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Star,
  CalendarClock,
  Loader2,
  X,
  Save,
  Menu
} from 'lucide-react';
import { authAPI, restaurantAPI, notificationsAPI, createSocketConnection } from './api';

// Composant Login
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
        if (data.user?.role !== 'restaurant' && data.user?.role !== 'admin') {
          setError('Ce compte n\'est pas un restaurant');
          return;
        }
        localStorage.setItem('restaurant_token', data.token);
        localStorage.setItem('restaurant_user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <Utensils className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SenFood <span className="text-indigo-400">Resto</span></h1>
          <p className="text-slate-400 mt-2">Connectez-vous à votre dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('commandes');
  const [socket, setSocket] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Data states
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [courierLocs, setCourierLocs] = useState({});

  // Menu form modal
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', description: '', price: '', category: '', image_url: '' });

  // Vérification auth au démarrage
  useEffect(() => {
    const savedToken = localStorage.getItem('restaurant_token');
    const savedUser = localStorage.getItem('restaurant_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      // Vérifier le token
      authAPI.getMe().then(data => {
        if (data.error) {
          handleLogout();
        }
      }).catch(() => handleLogout());
    }
    setLoading(false);
  }, []);

  // Socket.IO connexion
  useEffect(() => {
    if (!token) return;

    let socketInstance = null;
    createSocketConnection(token).then(s => {
      socketInstance = s;
      setSocket(s);

      s.on('new_order_notification', (data) => {
        setNewOrderAlert(data);
        fetchOrders();
        fetchUnreadCount();
      });

      s.on('order_status_changed', () => {
        fetchOrders();
      });

      s.on('order_cancelled', () => {
        fetchOrders();
        fetchUnreadCount();
      });

      s.on('rating_received', (data) => {
        fetchStats();
      });

      s.on('courier_location_update', (data) => {
        setCourierLocs(prev => ({
          ...prev,
          [data.courierId]: { lat: data.latitude, lng: data.longitude, orderId: data.orderId }
        }));
      });
    });

    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, [token]);

  // Charger les données
  const fetchOrders = useCallback(async () => {
    try {
      const data = await restaurantAPI.getActiveOrders();
      if (Array.isArray(data)) setOrders(data);
    } catch (err) {
      console.error('Fetch orders error:', err);
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const data = await restaurantAPI.getMenu();
      if (Array.isArray(data)) setMenuItems(data);
    } catch (err) {
      console.error('Fetch menu error:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await restaurantAPI.getStats();
      if (data) setStats(data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await notificationsAPI.getUnreadCount();
      if (data) setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Fetch unread error:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchMenu();
      fetchStats();
      fetchUnreadCount();

      // Rafraîchir les commandes toutes les 30s
      const interval = setInterval(fetchOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchOrders, fetchMenu, fetchStats, fetchUnreadCount]);

  const handleLogin = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
  };

  const handleLogout = () => {
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('restaurant_user');
    setUser(null);
    setToken(null);
    if (socket) socket.disconnect();
  };

  // Actions sur les commandes
  const handleAcceptOrder = async (orderId) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, 'preparation');
      setNewOrderAlert(null);
      fetchOrders();
    } catch (err) {
      console.error('Accept order error:', err);
    }
  };

  const handleMarkReady = async (orderId) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, 'prete');
      fetchOrders();
    } catch (err) {
      console.error('Mark ready error:', err);
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, 'annulee');
      fetchOrders();
    } catch (err) {
      console.error('Cancel order error:', err);
    }
  };

  // Actions sur le menu
  const handleToggleAvailability = async (item) => {
    try {
      await restaurantAPI.updateMenuItem(item.id, { is_available: !item.is_available });
      fetchMenu();
    } catch (err) {
      console.error('Toggle availability error:', err);
    }
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...menuForm,
        price: parseFloat(menuForm.price),
      };

      if (editingItem) {
        await restaurantAPI.updateMenuItem(editingItem.id, payload);
      } else {
        await restaurantAPI.addMenuItem(payload);
      }
      setShowMenuForm(false);
      setEditingItem(null);
      setMenuForm({ name: '', description: '', price: '', category: '', image_url: '' });
      fetchMenu();
    } catch (err) {
      console.error('Save menu item error:', err);
    }
  };

  const handleDeleteMenuItem = async (id) => {
    if (!confirm('Supprimer ce plat ?')) return;
    try {
      await restaurantAPI.deleteMenuItem(id);
      fetchMenu();
    } catch (err) {
      console.error('Delete menu item error:', err);
    }
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category || '',
      image_url: item.image_url || '',
    });
    setShowMenuForm(true);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-SN').format(price) + ' FCFA';
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const nouvelleOrders = orders.filter(o => o.status === 'nouvelle');
  const preparationOrders = orders.filter(o => o.status === 'preparation');
  const preteOrders = orders.filter(o => o.status === 'prete');

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden relative">

      {/* MOBILE MENU OVERLAY */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-secondary text-white flex flex-col transform transition-transform duration-300 ease-in-out ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center px-6 border-b border-white/10 relative">
          <Utensils className="w-6 h-6 text-indigo-400 mr-2" />
          <span className="text-xl font-bold tracking-tight">SenFood <span className="text-indigo-400">Resto</span></span>
          <button className="md:hidden ml-auto p-2 text-white/60" onClick={() => setShowMobileMenu(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 flex-1">
          <div className="mb-8">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Menu Principal</p>
            <nav className="space-y-1">
              {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
                { id: 'commandes', icon: BellRing, label: 'Commandes Live', badge: nouvelleOrders.length > 0 },
                { id: 'flotte', icon: Bike, label: 'Suivi Flotte' },
                { id: 'menu', icon: Package, label: 'Menu & Plats' },
                { id: 'horaires', icon: CalendarClock, label: 'Horaires' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setShowMobileMenu(false); }}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors relative ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
                >
                  <tab.icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.badge && <span className="absolute right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center px-4 py-3">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4F46E5&color=fff`} alt="Avatar" className="w-10 h-10 rounded-full mr-3 border-2 border-slate-700" />
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-green-400 flex items-center"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span> En ligne</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 mt-2 text-sm text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
          <div className="flex items-center flex-1">
            <button className="md:hidden p-2 mr-3 text-slate-400 hover:text-indigo-600" onClick={() => setShowMobileMenu(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Chercher une commande..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            {stats && (
              <p className="text-xs md:text-sm font-medium text-slate-600 hidden sm:block">
                Aujourd'hui : <span className="text-indigo-600 font-bold">{formatPrice(stats.today?.today_revenue || 0)}</span>
              </p>
            )}
            <button className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors">
              <BellRing className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth">

          {/* Alerte nouvelle commande */}
          {newOrderAlert && activeTab === 'commandes' && (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-sm animate-[slideDown_0.3s_ease-out] gap-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center mr-4 shrink-0">
                  <BellRing className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-indigo-900 font-bold md:text-lg">Nouvelle commande entrante !</h4>
                  <p className="text-indigo-700 text-sm">
                    Commande #{newOrderAlert.orderId} {newOrderAlert.total ? `• ${formatPrice(newOrderAlert.total)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none px-4 py-2 bg-white text-indigo-600 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-50" onClick={() => setNewOrderAlert(null)}>Plus tard</button>
                <button className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-600/30" onClick={() => { handleAcceptOrder(newOrderAlert.orderId); }}>Accepter</button>
              </div>
            </div>
          )}

          {/* === ONGLET COMMANDES === */}
          {activeTab === 'commandes' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800">Commandes Live</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg self-start">
                  <span className="px-3 py-1.5 bg-white shadow-sm rounded-md text-[11px] font-semibold text-slate-700">Toutes ({orders.length})</span>
                  <span className="px-3 py-1.5 text-[11px] font-medium text-slate-500">Nouvelles ({nouvelleOrders.length})</span>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Package className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-medium text-slate-500">Aucune commande</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Colonne 1: Nouvelles */}
                  <div className="bg-white/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="font-bold text-slate-700 flex items-center text-sm"><BellRing className="w-4 h-4 mr-2" /> Nouvelles</h3>
                      <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{nouvelleOrders.length}</span>
                    </div>

                    {nouvelleOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-xl p-4 mb-3 border border-slate-200 border-l-4 border-l-red-500 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-slate-800">#{order.id}</span>
                          <span className="text-[10px] font-medium text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> {formatTime(order.created_at)}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 mb-2 truncate">{order.client_name}</p>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mt-3">
                          <span className="text-sm font-bold text-indigo-600">{formatPrice(order.total_amount)}</span>
                          <button onClick={() => handleAcceptOrder(order.id)} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[11px] font-bold">Accepter</button>
                        </div>
                      </div>
                    ))}
                    {nouvelleOrders.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Aucune nouvelle</p>}
                  </div>

                  {/* Colonne 2: Cuisine */}
                  <div className="bg-white/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="font-bold text-slate-700 flex items-center text-sm"><Utensils className="w-4 h-4 mr-2" /> Cuisine</h3>
                      <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{preparationOrders.length}</span>
                    </div>

                    {preparationOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-xl p-4 mb-3 border border-slate-200 border-l-4 border-l-orange-500 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-slate-800">#{order.id}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 mb-2 truncate">{order.client_name}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xs font-bold text-slate-600">{formatPrice(order.total_amount)}</span>
                          <button onClick={() => handleMarkReady(order.id)} className="bg-orange-500 text-white px-3 py-1.5 rounded text-[11px] font-bold">Prête</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Colonne 3: Attente */}
                  <div className="bg-white/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="font-bold text-slate-700 flex items-center text-sm"><Bike className="w-4 h-4 mr-2" /> Livreurs</h3>
                      <span className="bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{preteOrders.length}</span>
                    </div>

                    {preteOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-xl p-4 mb-3 border border-slate-200 border-l-4 border-l-green-500 shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-slate-800">#{order.id}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{order.client_name}</p>
                        <div className="mt-2 text-green-600 flex items-center text-[11px] font-bold bg-green-50 p-2 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 mr-1"/> En attente de ramassage
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* === ONGLET FLOTTE === */}
          {activeTab === 'flotte' && (
            <div className="flex flex-col h-full gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800">Suivi Flotte (Live)</h2>
                <div className="flex items-center text-xs font-bold text-green-500 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 animate-pulse">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span> {Object.keys(courierLocs).length} Livreur(s) en ligne
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">
                <div className="lg:col-span-3 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 relative min-h-[400px]">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    loading="lazy" 
                    allowFullScreen 
                    src={`https://www.google.com/maps/embed/v1/search?key=VOTRE_GOOGLE_MAPS_API_KEY&q=Dakar&zoom=12`}
                  ></iframe>
                </div>

                <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest pl-2">Livreurs actifs</h3>
                  {Object.entries(courierLocs).length > 0 ? Object.entries(courierLocs).map(([id, loc]) => {
                    const order = orders.find(o => o.id === loc.orderId);
                    return (
                      <div key={id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-500 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                              {id.substring(0,2)}
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-slate-800 truncate">Livreur #{id.substring(0,5)}</p>
                              <p className="text-[10px] text-slate-500 font-bold">{order ? `Sur Commande #${order.id}` : 'En attente'}</p>
                           </div>
                        </div>
                        {order && (
                           <div className="mt-3 p-2 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 flex justify-between items-center group-hover:bg-indigo-50 transition-colors">
                              <span>Client : {order.client_name}</span>
                              <span className="text-indigo-600">Voir trajet</span>
                           </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                           <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: '65%' }}></div>
                           </div>
                           <span className="text-[10px] font-black text-slate-400">65%</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400">Aucun livreur en mouvement</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === ONGLET MENU === */}
          {activeTab === 'menu' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800">Votre Carte</h2>
                </div>
                <button
                  onClick={() => { setEditingItem(null); setMenuForm({ name: '', description: '', price: '', category: '', image_url: '' }); setShowMenuForm(true); }}
                  className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md"
                >
                  <Plus className="w-5 h-5 mr-2" /> Nouveau Plat
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                        <th className="px-4 py-4 font-semibold">Produit</th>
                        <th className="px-4 py-4 font-semibold">Prix</th>
                        <th className="px-4 py-4 font-semibold">Statut</th>
                        <th className="px-4 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map(item => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-4 truncate max-w-[200px] font-bold text-slate-800 text-sm">{item.name}</td>
                          <td className="px-4 py-4 text-sm font-bold text-slate-700">{formatPrice(item.price)}</td>
                          <td className="px-4 py-4">
                            <button
                               onClick={() => handleToggleAvailability(item)}
                               className={`px-3 py-1 rounded-full text-[10px] font-black ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                            >
                              {item.is_available ? 'STOCK' : 'ÉPUISÉ'}
                            </button>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button onClick={() => openEditForm(item)} className="text-slate-400 p-2"><Edit className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* === ONGLET DASHBOARD === */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-black text-slate-800">Tableau de Bord</h2>
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border">
                  <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                  <span className="text-xs font-bold text-slate-600">Live: Données en temps réel</span>
                </div>
              </div>

              {/* STATS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-indigo-50 rounded-xl"><DollarSign className="w-6 h-6 text-indigo-600" /></div>
                    <span className="text-[10px] font-black text-success bg-success/10 px-2 py-0.5 rounded-full">+12%</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Recettes Aujourd'hui</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{formatPrice(stats?.today?.today_revenue || 0)}</h3>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-orange-50 rounded-xl"><ShoppingBag className="w-6 h-6 text-orange-600" /></div>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Aujourd'hui</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Commandes Livrées</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{stats?.today?.today_orders || 0}</h3>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-emerald-50 rounded-xl"><TrendingUp className="w-6 h-6 text-emerald-600" /></div>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Global</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Revenu Total (Livrées)</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{formatPrice(stats?.total?.total_revenue || 0)}</h3>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-red-50 rounded-xl"><BellRing className="w-6 h-6 text-red-600" /></div>
                    <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full animate-pulse">{orders.length}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Commandes en Cours</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{orders.length}</h3>
                </div>
              </div>

              {/* RECENT PERFORMANCE */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-slate-800 flex items-center"><Star className="w-5 h-5 text-yellow-400 mr-2" /> Top Plats</h3>
                      <button className="text-indigo-600 text-xs font-bold hover:underline" onClick={() => setActiveTab('menu')}>Gérer le menu</button>
                   </div>
                   <div className="space-y-4">
                      {menuItems.slice(0, 5).map(item => (
                        <div key={item.id} className="flex items-center justify-between group">
                          <div className="flex items-center">
                            <img src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'} className="w-10 h-10 rounded-xl object-cover mr-3 grayscale group-hover:grayscale-0 transition-all shadow-sm" alt={item.name} />
                            <div>
                               <p className="text-sm font-bold text-slate-800">{item.name}</p>
                               <p className="text-[10px] text-slate-500">{item.category}</p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-slate-700">{formatPrice(item.price)}</span>
                        </div>
                      ))}
                      {menuItems.length === 0 && <p className="text-sm text-slate-400 italic">Aucun plat configuré</p>}
                   </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-slate-800 flex items-center">📣 Notifications Récentes</h3>
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">Live Feed</span>
                   </div>
                   <div className="space-y-1">
                      {orders.slice(0, 4).map(o => (
                        <div key={o.id} className="flex gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-all border-b border-slate-50 last:border-0 items-center">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${o.status === 'nouvelle' ? 'bg-red-500 animate-ping' : o.status === 'preparation' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-800">Commande #{o.id} - {o.client_name}</p>
                            <p className="text-[10px] text-slate-500">{formatTime(o.created_at)} • {o.status.toUpperCase()}</p>
                          </div>
                          <button onClick={() => setActiveTab('commandes')} className="text-indigo-600"><Eye className="w-4 h-4" /></button>
                        </div>
                      ))}
                      {orders.length === 0 && <p className="text-sm text-slate-400 italic py-4 text-center">Aucune activité récente</p>}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* === ONGLET HORAIRES === */}
          {activeTab === 'horaires' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <HoraireManager />
               <div className="mt-12 bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                 <div className="relative z-10">
                   <h3 className="text-xl font-bold mb-2">💡 Conseil SenFood</h3>
                   <p className="text-indigo-200 text-sm max-w-lg leading-relaxed">
                     Gardez vos horaires à jour pour éviter les commandes hors service. Un restaurant ponctuel est favorisé par notre algorithme de recommandation.
                   </p>
                 </div>
                 <Utensils className="absolute -right-10 -bottom-10 w-40 h-40 text-white/10 rotate-12" />
               </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL MENU */}
      {showMenuForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Modifier le plat' : 'Ajouter un nouveau plat'}</h3>
                 <button onClick={() => setShowMenuForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleMenuSubmit} className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nom du plat</label>
                       <input type="text" value={menuForm.name} onChange={e => setMenuForm({...menuForm, name: e.target.value})} required className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Tiep Bou Dien Rouge"/>
                    </div>
                    <div className="col-span-2">
                       <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                       <textarea value={menuForm.description} onChange={e => setMenuForm({...menuForm, description: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-24" placeholder="Description du plat..."/>
                    </div>
                    <div>
                       <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Prix (FCFA)</label>
                       <input type="number" value={menuForm.price} onChange={e => setMenuForm({...menuForm, price: e.target.value})} required className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"/>
                    </div>
                    <div>
                       <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Catégorie</label>
                       <select value={menuForm.category} onChange={e => setMenuForm({...menuForm, category: e.target.value})} required className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
                          <option value="">Choisir...</option>
                          <option value="Sénégalais">Sénégalais</option>
                          <option value="Fast Food">Fast Food</option>
                          <option value="Pizza">Pizza</option>
                          <option value="Jus Locaux">Jus Locaux</option>
                          <option value="Grillades">Grillades</option>
                       </select>
                    </div>
                    <div className="col-span-2">
                       <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Image URL</label>
                       <input type="text" value={menuForm.image_url} onChange={e => setMenuForm({...menuForm, image_url: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://..."/>
                    </div>
                 </div>
                 <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setShowMenuForm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl text-sm transition-all focus:ring-4 focus:ring-slate-100">Annuler</button>
                    <button type="submit" className="flex-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl text-sm px-8 shadow-xl shadow-indigo-200 transition-all active:scale-95 focus:ring-4 focus:ring-indigo-500 flex items-center justify-center gap-2">
                       {editingItem ? <Save className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                       {editingItem ? 'Sauvegarder' : 'Ajouter'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

// Composant gestion des horaires
function HoraireManager() {
  const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    restaurantAPI.getHours().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setHours(data);
      } else {
        // Initialiser avec des horaires par défaut (lundi-samedi 8h-22h)
        setHours([1, 2, 3, 4, 5, 6].map(d => ({
          day_of_week: d,
          open_time: '08:00',
          close_time: '22:00',
        })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleDay = (dayIndex) => {
    const existing = hours.find(h => h.day_of_week === dayIndex);
    if (existing) {
      setHours(hours.filter(h => h.day_of_week !== dayIndex));
    } else {
      setHours([...hours, { day_of_week: dayIndex, open_time: '08:00', close_time: '22:00' }].sort((a, b) => a.day_of_week - b.day_of_week));
    }
  };

  const updateTime = (dayIndex, field, value) => {
    setHours(hours.map(h => h.day_of_week === dayIndex ? { ...h, [field]: value } : h));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await restaurantAPI.updateHours(hours);
    } catch (err) {
      console.error('Save hours error:', err);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Horaires d'ouverture</h2>
          <p className="text-sm text-slate-500">Définissez vos horaires pour chaque jour de la semaine.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y">
        {jours.map((jour, idx) => {
          const dayHours = hours.find(h => h.day_of_week === idx);
          return (
            <div key={idx} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center min-w-[140px]">
                <input
                  type="checkbox"
                  checked={!!dayHours}
                  onChange={() => toggleDay(idx)}
                  className="w-4 h-4 text-indigo-600 rounded mr-3"
                />
                <span className={`font-medium ${dayHours ? 'text-slate-800' : 'text-slate-400'}`}>{jour}</span>
              </div>
              {dayHours ? (
                <div className="flex items-center space-x-3">
                  <input type="time" value={dayHours.open_time} onChange={e => updateTime(idx, 'open_time', e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-slate-400">—</span>
                  <input type="time" value={dayHours.close_time} onChange={e => updateTime(idx, 'close_time', e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ) : (
                <span className="text-sm text-slate-400">Fermé</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
