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
  Save
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

  // Data states
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(null);

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
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-64 bg-secondary text-white hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <Utensils className="w-6 h-6 text-indigo-400 mr-2" />
          <span className="text-xl font-bold tracking-tight">SenFood <span className="text-indigo-400">Resto</span></span>
        </div>

        <div className="p-4 flex-1">
          <div className="mb-8">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Menu Principal</p>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                <span className="font-medium">Tableau de bord</span>
              </button>
              <button
                onClick={() => setActiveTab('commandes')}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors relative ${activeTab === 'commandes' ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
              >
                <BellRing className="w-5 h-5 mr-3" />
                <span className="font-medium">Commandes Live</span>
                {nouvelleOrders.length > 0 && <span className="absolute right-4 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>}
                {nouvelleOrders.length > 0 && <span className="absolute right-4 w-3 h-3 bg-red-500 rounded-full"></span>}
              </button>
              <button
                onClick={() => setActiveTab('menu')}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors ${activeTab === 'menu' ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
              >
                <Package className="w-5 h-5 mr-3" />
                <span className="font-medium">Menu & Plats</span>
              </button>
              <button
                onClick={() => setActiveTab('horaires')}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors ${activeTab === 'horaires' ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
              >
                <CalendarClock className="w-5 h-5 mr-3" />
                <span className="font-medium">Horaires</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center px-4 py-3">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4F46E5&color=fff`} alt="Avatar" className="w-10 h-10 rounded-full mr-3 border-2 border-slate-700" />
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-green-400 flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span> Connecté</p>
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center flex-1">
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Chercher une commande..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {stats && (
              <p className="text-sm font-medium text-slate-600 hidden sm:block">
                Aujourd'hui : <span className="text-indigo-600 font-bold">{formatPrice(stats.today?.today_revenue || 0)}</span>
              </p>
            )}
            <button className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors">
              <BellRing className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto p-6 scroll-smooth">

          {/* Alerte nouvelle commande */}
          {newOrderAlert && activeTab === 'commandes' && (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-[slideDown_0.3s_ease-out]">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center mr-4">
                  <BellRing className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-indigo-900 font-bold text-lg">Nouvelle commande entrante !</h4>
                  <p className="text-indigo-700 text-sm">
                    Commande #{newOrderAlert.orderId} {newOrderAlert.total ? `• ${formatPrice(newOrderAlert.total)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-white text-indigo-600 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors" onClick={() => setNewOrderAlert(null)}>Plus tard</button>
                <button className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-105" onClick={() => { handleAcceptOrder(newOrderAlert.orderId); }}>Accepter & Préparer</button>
              </div>
            </div>
          )}

          {/* === ONGLET COMMANDES === */}
          {activeTab === 'commandes' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Commandes en cours</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <span className="px-4 py-1.5 bg-white shadow-sm rounded-md text-sm font-semibold text-slate-700">Toutes ({orders.length})</span>
                  <span className="px-4 py-1.5 text-sm font-medium text-slate-500">Nouvelles ({nouvelleOrders.length})</span>
                  <span className="px-4 py-1.5 text-sm font-medium text-slate-500">En cuisine ({preparationOrders.length})</span>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Package className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-medium text-slate-500">Aucune commande en cours</p>
                  <p className="text-sm mt-2">Les nouvelles commandes apparaîtront ici en temps réel</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Colonne 1: Nouvelles */}
                  <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="font-bold text-slate-700 flex items-center"><BellRing className="w-4 h-4 mr-2" /> Nouvelles</h3>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{nouvelleOrders.length}</span>
                    </div>

                    {nouvelleOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-xl p-4 mb-3 cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md border border-slate-200 border-l-4 border-l-red-500">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-bold text-slate-800">#{order.id}</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> {formatTime(order.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mb-1">{order.client_name}</p>
                        <p className="text-xs text-slate-500 mb-1">{order.client_phone}</p>
                        {order.items && (
                          <p className="text-xs text-slate-500 mb-3">
                            {order.items.filter(i => i.name).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </p>
                        )}
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm font-bold text-indigo-600">{formatPrice(order.total_amount)}</span>
                          <div className="flex space-x-1">
                            <button onClick={() => handleCancelOrder(order.id)} className="text-red-500 hover:bg-red-50 px-2 py-1.5 rounded text-xs font-bold transition-colors">Refuser</button>
                            <button onClick={() => handleAcceptOrder(order.id)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Accepter</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {nouvelleOrders.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Aucune nouvelle commande</p>}
                  </div>

                  {/* Colonne 2: En Préparation */}
                  <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="font-bold text-slate-700 flex items-center"><Utensils className="w-4 h-4 mr-2" /> Cuisine</h3>
                      <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">{preparationOrders.length}</span>
                    </div>

                    {preparationOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-xl p-4 mb-3 cursor-pointer hover:border-orange-300 transition-all hover:shadow-md border border-slate-200 border-l-4 border-l-orange-500">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-bold text-slate-800">#{order.id}</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> {formatTime(order.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mb-1">{order.client_name}</p>
                        {order.items && (
                          <p className="text-xs text-slate-500 mb-3">
                            {order.items.filter(i => i.name).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </p>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-700">{formatPrice(order.total_amount)}</span>
                          <button onClick={() => handleMarkReady(order.id)} className="bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Marquer Prête</button>
                        </div>
                      </div>
                    ))}
                    {preparationOrders.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Rien en cuisine</p>}
                  </div>

                  {/* Colonne 3: Prêtes */}
                  <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="font-bold text-slate-700 flex items-center"><Bike className="w-4 h-4 mr-2" /> Attente Livreur</h3>
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{preteOrders.length}</span>
                    </div>

                    {preteOrders.map(order => (
                      <div key={order.id} className="bg-white rounded-xl p-4 mb-3 cursor-pointer hover:border-green-300 transition-all hover:shadow-md border border-slate-200 border-l-4 border-l-green-500">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-bold text-slate-800">#{order.id}</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> {formatTime(order.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mb-1">{order.client_name}</p>
                        {order.items && (
                          <p className="text-xs text-slate-500 mb-3">
                            {order.items.filter(i => i.name).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </p>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-700">{formatPrice(order.total_amount)}</span>
                          <span className="flex items-center text-green-600 bg-green-50 px-3 py-1.5 rounded text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4 mr-1"/> Prête
                          </span>
                        </div>
                      </div>
                    ))}
                    {preteOrders.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Aucune commande prête</p>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* === ONGLET DASHBOARD === */}
          {activeTab === 'dashboard' && stats && (
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Tableau de bord</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500">Revenus du jour</span>
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{formatPrice(stats.today?.today_revenue || 0)}</p>
                  <p className="text-xs text-slate-400 mt-1">{stats.today?.today_orders || 0} commandes</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500">Revenus totaux</span>
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{formatPrice(stats.total?.total_revenue || 0)}</p>
                  <p className="text-xs text-slate-400 mt-1">{stats.total?.total_orders || 0} commandes totales</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500">Commandes actives</span>
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{stats.active?.active_orders || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">En cours de traitement</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500">Plats au menu</span>
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Utensils className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{menuItems.length}</p>
                  <p className="text-xs text-slate-400 mt-1">{menuItems.filter(m => m.is_available).length} disponibles</p>
                </div>
              </div>
            </div>
          )}

          {/* === ONGLET MENU === */}
          {activeTab === 'menu' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Menu & Plats</h2>
                  <p className="text-sm text-slate-500">Gérez votre carte et la disponibilité de vos plats en temps réel.</p>
                </div>
                <button
                  onClick={() => { setEditingItem(null); setMenuForm({ name: '', description: '', price: '', category: '', image_url: '' }); setShowMenuForm(true); }}
                  className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nouveau Plat
                </button>
              </div>

              {/* Modal formulaire menu */}
              {showMenuForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">{editingItem ? 'Modifier le plat' : 'Nouveau plat'}</h3>
                      <button onClick={() => setShowMenuForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                    </div>
                    <form onSubmit={handleSaveMenuItem} className="space-y-4">
                      <input type="text" placeholder="Nom du plat" value={menuForm.name} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required />
                      <textarea placeholder="Description" value={menuForm.description} onChange={e => setMenuForm({...menuForm, description: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" rows={2} />
                      <input type="number" placeholder="Prix (FCFA)" value={menuForm.price} onChange={e => setMenuForm({...menuForm, price: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required />
                      <input type="text" placeholder="Catégorie" value={menuForm.category} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required />
                      <input type="url" placeholder="URL image (optionnel)" value={menuForm.image_url} onChange={e => setMenuForm({...menuForm, image_url: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center justify-center">
                        <Save className="w-4 h-4 mr-2" /> {editingItem ? 'Modifier' : 'Ajouter'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {menuItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Utensils className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun plat dans votre menu. Ajoutez-en un !</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                        <th className="px-6 py-4 font-semibold">Produit</th>
                        <th className="px-6 py-4 font-semibold">Catégorie</th>
                        <th className="px-6 py-4 font-semibold">Prix</th>
                        <th className="px-6 py-4 font-semibold">Disponibilité</th>
                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map(item => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 flex items-center">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover mr-4 shadow-sm" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mr-4">
                                <Utensils className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-slate-800">{item.name}</span>
                              {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-500">{item.category}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">{formatPrice(item.price)}</td>
                          <td className="px-6 py-4">
                            <button
                               onClick={() => handleToggleAvailability(item)}
                               className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${item.is_available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            >
                              {item.is_available ? 'En Stock' : 'Épuisé'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => openEditForm(item)} className="text-slate-400 hover:text-indigo-600 p-2 transition-colors"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteMenuItem(item.id)} className="text-slate-400 hover:text-red-600 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* === ONGLET HORAIRES === */}
          {activeTab === 'horaires' && <HoraireManager />}

          {/* Placeholder pour les autres onglets */}
          {activeTab !== 'commandes' && activeTab !== 'menu' && activeTab !== 'dashboard' && activeTab !== 'horaires' && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <Package className="w-16 h-16 mb-4 opacity-20" />
               <p className="text-lg font-medium text-slate-500">Le module "{activeTab}" est en cours de développement.</p>
               <p className="text-sm mt-2 text-indigo-500 hover:underline cursor-pointer" onClick={() => setActiveTab('commandes')}>Retour aux commandes Live</p>
            </div>
          )}

        </div>
      </main>
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
