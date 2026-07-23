import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Menu,
  Warehouse,
  Wallet,
  Users,
  Megaphone,
  CreditCard,
  MessageSquare,
  Send,
  ChevronRight,
  ChevronLeft,
  BarChart3,
} from 'lucide-react';
import { authAPI, restaurantAPI, notificationsAPI, promotionsAPI, payoutAPI, chatAPI, stockAPI, customizationAPI, storiesAPI, qrCodeAPI, cateringAPI, analyticsAPI } from './api';
import { ShieldAlert } from 'lucide-react';

// --- Fleet Map Component (Leaflet/OpenStreetMap - no API key needed) ---
function FleetMap({ couriersLocs }) {
  const mapRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markersRef = React.useRef({});

  React.useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const loadLeaflet = () => {
      return new Promise((resolve) => {
        if (window.L) return resolve(window.L);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });
    };

    loadLeaflet().then(L => {
      if (mapInstanceRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([14.7167, -17.4677], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Add pulse animation CSS
      if (!document.getElementById('fleet-pulse-css')) {
        const style = document.createElement('style');
        style.id = 'fleet-pulse-css';
        style.textContent = `@keyframes fleet-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.6}}`;
        document.head.appendChild(style);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update courier markers
  React.useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;

    Object.entries(couriersLocs).forEach(([id, loc]) => {
      if (markersRef.current[id]) {
        markersRef.current[id].setLatLng([loc.lat, loc.lng]);
      } else {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:32px;height:32px;border-radius:50%;background:rgba(79,70,229,0.25);display:flex;align-items:center;justify-content:center;animation:fleet-pulse 2s infinite">
            <div style="width:14px;height:14px;border-radius:50%;background:#4f46e5;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        markersRef.current[id] = L.marker([loc.lat, loc.lng], { icon }).addTo(mapInstanceRef.current).bindPopup(`🏍️ Livreur #${id}`);
      }
    });

    // Remove markers for couriers no longer tracked
    Object.keys(markersRef.current).forEach(id => {
      if (!couriersLocs[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [couriersLocs]);

  return (
    <div ref={mapRef} className="w-full h-full" style={{ minHeight: 300 }} />
  );
}

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
          <h1 className="text-3xl font-bold text-white">NOOR EAT <span className="text-indigo-400">Resto</span></h1>
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

function ChatWindow({ order, user, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chatAPI.getMessages(order.id).then(data => {
      setMessages(data);
      setLoading(false);
    });
  }, [order.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      const sent = await chatAPI.sendMessage(order.id, input);
      setMessages([...messages, { ...sent, sender_id: user.id }]);
      setInput('');
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
       <div className="bg-white w-full max-w-lg h-[600px] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
             <div>
                <h3 className="font-black">Chat Commande #{order.id}</h3>
                <p className="text-[10px] opacity-80 uppercase tracking-widest">{order.client_name}</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
             {loading ? <p className="text-center text-slate-400 py-20 animate-pulse">Chargement...</p> : messages.map((m, i) => (
               <div key={i} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.sender_id === user.id ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200 shadow-lg' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}`}>
                     {m.message}
                     <p className={`text-[9px] mt-1 opacity-60 ${m.sender_id === user.id ? 'text-right' : 'text-left'}`}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                  </div>
               </div>
             ))}
             {messages.length === 0 && !loading && <p className="text-center text-slate-400 py-20 italic">Aucun message. Commencez la discussion !</p>}
          </div>
          <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2">
             <input value={input} onChange={e => setInput(e.target.value)} placeholder="Écrire un message..." className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
             <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all"><Send className="w-5 h-5" /></button>
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
  const seenOrderIdsRef = useRef(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Data states
  const [orders, setOrders] = useState([]);
  const [courierLocs, setCourierLocs] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [promos, setPromos] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [activeChatOrder, setActiveChatOrder] = useState(null);

  // Menu form modal
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', description: '', price: '', category: '', image_url: '' });

  // Sécurité: Redirection si pas le bon rôle
  useEffect(() => {
    if (user && user.role !== 'restaurant' && user.role !== 'admin') {
      handleLogout();
    }
  }, [user]);

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

  // SONDAGE COMMANDES ACTIVES — remplace Socket.IO, indisponible sur ce
  // deploiement serverless Vercel (le backend n'expose que l'app Express a
  // la fonction, jamais le http.Server auquel Socket.IO attache ses upgrades).
  // Un seul sondage couvre new_order_notification / order_status_changed /
  // order_cancelled (tous se resument a rafraichir la liste des commandes
  // actives) + la position des livreurs en cours de livraison.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await restaurantAPI.getActiveOrders();
        if (cancelled || !Array.isArray(data)) return;

        const currentIds = new Set(data.map((o) => o.id));
        if (seenOrderIdsRef.current) {
          const freshOrder = data.find((o) => !seenOrderIdsRef.current.has(o.id) && o.status === 'nouvelle');
          if (freshOrder) {
            setNewOrderAlert({ orderId: freshOrder.id, total: freshOrder.total_amount, message: 'Nouvelle commande reçue !' });
            fetchUnreadCount();
          }
        }
        seenOrderIdsRef.current = currentIds;
        setOrders(data);

        const inTransit = data.filter((o) => o.status === 'en_route' && o.courier_id);
        if (inTransit.length > 0) {
          const results = await Promise.all(inTransit.map((o) => restaurantAPI.trackOrder(o.id).catch(() => null)));
          if (cancelled) return;
          setCourierLocs((prev) => {
            const next = { ...prev };
            results.forEach((r, i) => {
              if (r && r.courier_lat && r.courier_lng) {
                next[inTransit[i].courier_id] = { lat: r.courier_lat, lng: r.courier_lng, orderId: inTransit[i].id };
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.error('Erreur sondage commandes:', err);
      }
    };
    poll();
    const interval = setInterval(poll, 6000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, fetchUnreadCount]);

  // SONDAGE STATS — remplace rating_received (frequence plus basse, non critique)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => { fetchStats(); }, 20000);
    return () => clearInterval(interval);
  }, [token, fetchStats]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await analyticsAPI.getRevenueChart();
      const revenue_by_day = (data?.revenue_chart || []).map((d) => ({
        date: d.date,
        revenue: Number(d.revenue) || 0,
        orders: Number(d.order_count) || 0,
      }));
      setAnalytics({ revenue_by_day });
    } catch (err) {
      console.error('Fetch analytics error:', err);
    }
  }, []);

  const fetchPromos = useCallback(async () => {
    try {
      const data = await promotionsAPI.getAll();
      if (data && data.data) setPromos(data.data);
    } catch (err) {
      console.error('Fetch promos error:', err);
    }
  }, []);

  const fetchPayouts = useCallback(async () => {
    try {
      const data = await payoutAPI.getHistory();
      if (Array.isArray(data)) setPayouts(data);
    } catch (err) {
      console.error('Fetch payouts error:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchMenu();
      fetchStats();
      fetchUnreadCount();
      if (activeTab === 'finances' || activeTab === 'dashboard') {
        fetchAnalytics();
        fetchPayouts();
      }
      if (activeTab === 'marketing') {
        fetchPromos();
      }

      // Rafraîchir les commandes toutes les 30s
      const interval = setInterval(fetchOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab, fetchOrders, fetchMenu, fetchStats, fetchUnreadCount, fetchAnalytics, fetchPayouts, fetchPromos]);

  const handleLogin = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
  };

  const handleLogout = () => {
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('restaurant_user');
    setUser(null);
    setToken(null);
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
    if (e) e.preventDefault();
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
          <span className="text-xl font-bold tracking-tight">NOOR EAT <span className="text-indigo-400">Resto</span></span>
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
                { id: 'livreurs', icon: Users, label: 'Livreurs' },
                 { id: 'menu', icon: Package, label: 'Menu & Plats' },
                 { id: 'inventaire', icon: Warehouse, label: 'Inventaire (Stock)' },
                 { id: 'marketing', icon: Megaphone, label: 'Marketing & Promos' },
                 { id: 'finances', icon: Wallet, label: 'Finances & Retraits' },
                 { id: 'horaires', icon: CalendarClock, label: 'Horaires' },
                 { id: 'stock', icon: Package, label: 'Gestion Stock' },
                 { id: 'qrcodes', icon: Utensils, label: 'QR Codes Tables' },
                 { id: 'stories', icon: Megaphone, label: 'Stories' },
                 { id: 'traiteur', icon: Users, label: 'Traiteur' },
                 { id: 'options', icon: Package, label: 'Options Plats' },
                 { id: 'analytics', icon: BarChart3, label: 'Analytiques' },
                 { id: 'reviews', icon: Star, label: 'Avis Clients' },
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
                          <div className="flex gap-2">
                             <button onClick={() => setActiveChatOrder(order)} className="bg-slate-200 text-slate-600 p-1.5 rounded hover:bg-indigo-100 hover:text-indigo-600 transition-colors"><MessageSquare className="w-4 h-4" /></button>
                             <button onClick={() => handleAcceptOrder(order.id)} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[11px] font-bold">Accepter</button>
                          </div>
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
                  <FleetMap couriersLocs={courierLocs} />
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

          {/* === ONGLET MARKETING === */}
          {activeTab === 'marketing' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-800">Marketing & Promos</h2>
                  <button 
                    onClick={() => {
                      const code = prompt('Code Promotionnel (ex: MANGER50) :');
                      const val = prompt('Valeur de la réduction (en % ou fixe) :');
                      if (code && val) {
                        promotionsAPI.create({
                          code,
                          discount_type: 'percentage',
                          discount_value: parseFloat(val),
                          description: 'Offre spéciale restaurant'
                        }).then(() => fetchPromos());
                      }
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg"
                  >
                    + Créer une Promo
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {promos.map(promo => (
                    <div key={promo.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                       <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                       <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                             <div className="bg-indigo-600 text-white font-black px-3 py-1 rounded-lg text-sm tracking-widest">{promo.code}</div>
                             <button onClick={() => promotionsAPI.delete(promo.id).then(() => fetchPromos())} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <p className="text-sm font-bold text-slate-800 mb-1">{promo.description || 'Réduction sur vos commandes'}</p>
                          <p className="text-2xl font-black text-indigo-600 mb-4">{promo.discount_value}{promo.discount_type === 'percentage' ? '%' : ' FCFA'}</p>
                          <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Utilisations: {promo.current_uses}</span>
                             <button 
                               onClick={() => promotionsAPI.toggle(promo.id).then(() => fetchPromos())}
                               className={`px-3 py-1 rounded-full text-[10px] font-black ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                             >
                               {promo.is_active ? 'ACTIF' : 'INACTIF'}
                             </button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* === ONGLET FINANCES & RETRAITS === */}
          {activeTab === 'finances' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-800">Analytique & Retraits</h2>
                <button 
                  onClick={() => {
                    const amount = prompt('Montant à retirer (Min 1000 FCFA) :');
                    if (amount) {
                      payoutAPI.request(parseFloat(amount), 'wave').then(() => fetchPayouts());
                    }
                  }}
                  className="bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-black shadow-lg shadow-green-100 animate-pulse"
                >
                  <Wallet className="w-4 h-4 inline mr-2" /> Demander un retrait Wave
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="bg-slate-900 border-none p-6 rounded-3xl text-white">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Ticket Moyen</p>
                    <h4 className="text-3xl font-black">
                       {analytics?.revenue_by_day?.reduce((acc, d) => acc + d.orders, 0) > 0
                         ? formatPrice(analytics.revenue_by_day.reduce((acc, d) => acc + d.revenue, 0) / analytics.revenue_by_day.reduce((acc, d) => acc + d.orders, 0))
                         : '0 FCFA'
                       }
                    </h4>
                    <p className="text-[10px] text-indigo-300 mt-2 font-bold">Sur les 7 derniers jours</p>
                 </div>
                 <div className="bg-indigo-600 border-none p-6 rounded-3xl text-white">
                    <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Paiements Wave/OM</p>
                    <h4 className="text-3xl font-black">84%</h4>
                    <p className="text-[10px] text-white/60 mt-2 font-bold">Privilégiés par vos clients</p>
                 </div>
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Commandes Annulées</p>
                    <h4 className="text-3xl font-black text-red-500">2</h4>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold">Taux de perte: 1.2%</p>
                 </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-slate-50 flex justify-between items-center uppercase tracking-widest text-[10px] font-black text-slate-400">
                    <span>Historique des retraits</span>
                    <span>{payouts.length} Transactions</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                         <tr className="text-[10px] font-bold text-slate-500 bg-slate-50">
                            <th className="p-4">Date</th>
                            <th className="p-4">Montant</th>
                            <th className="p-4">Méthode</th>
                            <th className="p-4">Statut</th>
                         </tr>
                       </thead>
                       <tbody>
                        {payouts.map(p => (
                          <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                              <td className="p-4 text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                              <td className="p-4 text-sm font-black text-slate-800">{formatPrice(p.amount)}</td>
                              <td className="p-4 text-xs font-bold text-slate-600 uppercase">{p.method}</td>
                              <td className="p-4">
                                <span className={`text-[9px] font-black px-2 py-1 rounded-full ${p.status === 'paye' ? 'bg-green-100 text-green-700' : p.status === 'rejete' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {p.status.toUpperCase()}
                                </span>
                              </td>
                          </tr>
                        ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* ANALYTICS SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-700 mb-6 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-indigo-500" /> Évolution du Chiffre d'Affaires</h3>
                   <div className="h-[200px] flex items-end gap-2 pb-2">
                      {analytics?.revenue_by_day?.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                           <div className="w-full bg-indigo-100 rounded-t-lg relative group-hover:bg-indigo-200 transition-colors" style={{ height: `${(day.revenue / Math.max(...analytics.revenue_by_day.map(d => d.revenue || 1))) * 100}%`, minHeight: '4px' }}>
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                 {formatPrice(day.revenue)}
                              </div>
                           </div>
                           <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                        </div>
                      ))}
                      {!analytics?.revenue_by_day?.length && <p className="w-full text-center text-slate-300 italic text-xs py-10">Données de revenu insuffisantes</p>}
                   </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-700 mb-6 flex items-center"><Star className="w-5 h-5 mr-2 text-yellow-500" /> Top par Revenu</h3>
                   <div className="space-y-4">
                      {analytics?.top_dishes?.map((dish, i) => (
                        <div key={i} className="flex items-center justify-between">
                           <div>
                              <p className="text-sm font-bold text-slate-800">{dish.name}</p>
                              <p className="text-[10px] text-slate-500">{dish.total_sold} vendus</p>
                           </div>
                           <p className="text-sm font-black text-indigo-600">{formatPrice(dish.total_revenue)}</p>
                        </div>
                      ))}
                      {!analytics?.top_dishes?.length && <p className="text-slate-300 italic text-xs py-4 text-center">Aucune donnée disponible</p>}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* === ONGLET LIVREURS === */}
          {activeTab === 'livreurs' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-800">Gestion des Livreurs</h2>
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100">Appeler un livreur</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(courierLocs).length > 0 ? Object.entries(courierLocs).map(([id, loc]) => (
                    <div key={id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       <div className="flex items-center gap-4 mb-4">
                          <img src={`https://ui-avatars.com/api/?name=Livreur+${id.substring(0,2)}&background=1E88E5&color=fff`} className="w-12 h-12 rounded-2xl" alt="Livreur" />
                          <div>
                             <h4 className="font-black text-slate-800">Livreur #{id.substring(0,5)}</h4>
                             <p className="text-xs text-green-500 font-bold flex items-center">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                                En mission
                             </p>
                          </div>
                       </div>
                       <div className="space-y-3 pt-4 border-t border-slate-50">
                          <div className="flex justify-between text-xs font-bold">
                             <span className="text-slate-400 uppercase">Commande Actuelle</span>
                             <span className="text-indigo-600">#{loc.orderId || '---'}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold">
                             <span className="text-slate-400 uppercase">Distance Restante</span>
                             <span className="text-slate-800">~1.2 km</span>
                          </div>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                       <Bike className="w-12 h-12 text-slate-300 mb-4" />
                       <p className="text-slate-500 font-bold">Aucun livreur actif pour le moment</p>
                    </div>
                  )}
               </div>
            </div>
          )}

          {/* === ONGLET INVENTAIRE === */}
          {activeTab === 'inventaire' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-800">Inventaire & Stock Rapid</h2>
                  <p className="text-xs font-bold text-slate-400">Cliquez pour épuiser/réapprovisionner</p>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {menuItems.map(item => (
                    <button 
                      key={item.id}
                      onClick={() => handleToggleAvailability(item)}
                      className={`p-4 rounded-3xl border text-left transition-all ${item.is_available ? 'bg-white border-slate-200 hover:border-indigo-300' : 'bg-red-50 border-red-100 opacity-60'}`}
                    >
                       <div className="aspect-square rounded-2xl overflow-hidden mb-3 relative">
                          <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                          {!item.is_available && (
                            <div className="absolute inset-0 bg-red-500/40 backdrop-blur-[2px] flex items-center justify-center">
                               <span className="text-[10px] font-black text-white bg-red-600 px-2 py-1 rounded-full border border-white/20">RUPTURE</span>
                            </div>
                          )}
                       </div>
                       <p className="text-xs font-black text-slate-800 truncate mb-1">{item.name}</p>
                       <p className={`text-[10px] font-bold ${item.is_available ? 'text-green-500' : 'text-red-500'}`}>
                          {item.is_available ? 'En stock' : 'Épuisé'}
                       </p>
                    </button>
                  ))}
               </div>
            </div>
          )}

          {/* === ONGLET HORAIRES === */}
          {activeTab === 'horaires' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <HoraireManager />
               <div className="mt-12 bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                 <div className="relative z-10">
                   <h3 className="text-xl font-bold mb-2">💡 Conseil NOOR EAT</h3>
                   <p className="text-indigo-200 text-sm max-w-lg leading-relaxed">
                     Gardez vos horaires à jour pour éviter les commandes hors service. Un restaurant ponctuel est favorisé par notre algorithme de recommandation.
                   </p>
                 </div>
                 <Utensils className="absolute -right-10 -bottom-10 w-40 h-40 text-white/10 rotate-12" />
               </div>
            </div>
          )}

          {/* GESTION STOCK */}
          {activeTab === 'stock' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StockManager />
            </div>
          )}

          {/* QR CODES */}
          {activeTab === 'qrcodes' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <QRCodeManager />
            </div>
          )}

          {/* STORIES */}
          {activeTab === 'stories' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StoriesManager />
            </div>
          )}

          {/* TRAITEUR */}
          {activeTab === 'traiteur' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CateringManager />
            </div>
          )}

          {/* OPTIONS PLATS */}
          {activeTab === 'options' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <OptionsManager menuItems={menuItems} />
            </div>
          )}

          {/* ANALYTIQUES */}
          {activeTab === 'analytics' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AnalyticsDashboard />
            </div>
          )}

          {/* AVIS CLIENTS */}
          {activeTab === 'reviews' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-black text-slate-800 mb-6">Avis Clients ⭐</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
                  <p className="text-3xl font-black text-yellow-500">4.8</p>
                  <p className="text-xs text-slate-400 font-bold mt-1">Note moyenne</p>
                  <div className="flex justify-center gap-1 mt-2">{'⭐⭐⭐⭐⭐'.split('').map((s,i) => <span key={i} className={i < 5 ? '' : 'opacity-30'}>{s}</span>)}</div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
                  <p className="text-3xl font-black text-indigo-600">156</p>
                  <p className="text-xs text-slate-400 font-bold mt-1">Total avis</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
                  <p className="text-3xl font-black text-green-500">23</p>
                  <p className="text-xs text-slate-400 font-bold mt-1">Avec photos</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { name: 'Oumy Dia', rating: 5, text: 'Le meilleur Tiep de Dakar ! Livraison rapide, plat encore chaud.', time: 'Il y a 2h', photo: true },
                  { name: 'Ibrahima Fall', rating: 4, text: 'Très bon mafé, portions généreuses. La sauce pourrait être plus épaisse.', time: 'Il y a 5h', photo: false },
                  { name: 'Aminata Ndiaye', rating: 5, text: 'Yassa poulet excellent ! Je recommande à 100%', time: 'Hier', photo: true },
                  { name: 'Moussa Gueye', rating: 3, text: 'Correct mais la livraison était un peu longue.', time: 'Il y a 2j', photo: false },
                ].map((review, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(review.name)}&background=6366f1&color=fff`} className="w-10 h-10 rounded-full" alt="" />
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{review.name}</p>
                          <p className="text-[10px] text-slate-400">{review.time}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">{'⭐'.repeat(review.rating).split('').map((s,j) => <span key={j} className="text-sm">{s}</span>)}</div>
                    </div>
                    <p className="text-sm text-slate-600">{review.text}</p>
                    {review.photo && <div className="mt-3 w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">📷</div>}
                  </div>
                ))}
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
               <form onSubmit={handleSaveMenuItem} className="p-6 space-y-4">
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

      {/* CHAT MODAL */}
      {activeChatOrder && (
         <ChatWindow order={activeChatOrder} user={user} onClose={() => setActiveChatOrder(null)} />
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

// ===== STOCK MANAGER =====
function StockManager() {
  const [items, setItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStock(); }, []);

  const loadStock = async () => {
    try {
      const [all, low] = await Promise.all([stockAPI.getAll(), stockAPI.getLowStock()]);
      setItems(all || []);
      setLowStock(low || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const updateQty = async (menuItemId, quantity) => {
    try {
      await stockAPI.update(menuItemId, { quantity: parseInt(quantity) });
      loadStock();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Gestion des Stocks</h2>
      <p className="text-sm text-slate-500 mb-6">Gérez la disponibilité de vos plats en temps réel</p>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-bold text-red-700 mb-2">Stock bas ({lowStock.length} articles)</h3>
          {lowStock.map((item, i) => (
            <p key={i} className="text-xs text-red-600">{item.name || `Plat #${item.menu_item_id}`} - {item.quantity} restant(s)</p>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
            <th className="px-6 py-3 text-left">Plat</th>
            <th className="px-6 py-3 text-center">Stock actuel</th>
            <th className="px-6 py-3 text-center">Seuil alerte</th>
            <th className="px-6 py-3 text-center">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.name || `Plat #${item.menu_item_id}`}</td>
                <td className="px-6 py-4 text-center">
                  <input type="number" defaultValue={item.quantity} className="w-20 text-center bg-slate-50 rounded-lg px-2 py-1 text-sm border" onBlur={e => updateQty(item.menu_item_id, e.target.value)} />
                </td>
                <td className="px-6 py-4 text-center text-sm text-slate-500">{item.low_stock_threshold || 5}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${item.quantity <= (item.low_stock_threshold || 5) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {item.quantity <= 0 ? 'Rupture' : item.quantity <= (item.low_stock_threshold || 5) ? 'Bas' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun stock configuré. Ajoutez des quantités via le menu.</p>}
      </div>
    </div>
  );
}

// ===== QR CODE MANAGER =====
function QRCodeManager() {
  const [qrCodes, setQrCodes] = useState([]);
  const [tableNum, setTableNum] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadQR(); }, []);

  const loadQR = async () => {
    try {
      const data = await qrCodeAPI.getMyQR();
      setQrCodes(data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const generate = async () => {
    if (!tableNum.trim()) return;
    try {
      await qrCodeAPI.generate(tableNum);
      setTableNum('');
      loadQR();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce QR code ?')) return;
    try {
      await qrCodeAPI.remove(id);
      loadQR();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">QR Codes - Tables</h2>
      <p className="text-sm text-slate-500 mb-6">Générez des QR codes pour que vos clients commandent depuis leur table</p>

      <div className="flex gap-3 mb-6">
        <input type="text" value={tableNum} onChange={e => setTableNum(e.target.value)} placeholder="N° de table (ex: A1, B3)" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        <button onClick={generate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors">Générer QR</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {qrCodes.map((qr, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-xl mx-auto mb-3 flex items-center justify-center">
              <span className="text-4xl">📱</span>
            </div>
            <h4 className="font-bold text-slate-800">Table {qr.table_number}</h4>
            <p className="text-xs text-slate-400 mt-1">ID: {qr.id}</p>
            <button onClick={() => remove(qr.id)} className="mt-3 text-xs text-red-500 font-bold hover:text-red-700">Supprimer</button>
          </div>
        ))}
      </div>
      {qrCodes.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun QR code. Générez-en pour vos tables.</p>}
    </div>
  );
}

// ===== STORIES MANAGER =====
function StoriesManager() {
  const [stories, setStories] = useState([]);
  const [form, setForm] = useState({ image_url: '', caption: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStories(); }, []);

  const loadStories = async () => {
    try {
      const data = await storiesAPI.getActive();
      setStories(data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const createStory = async () => {
    if (!form.image_url) return alert('URL image requise');
    try {
      await storiesAPI.create(form);
      setForm({ image_url: '', caption: '' });
      loadStories();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Stories</h2>
      <p className="text-sm text-slate-500 mb-6">Publiez des stories éphémères (plat du jour, promos flash)</p>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6 space-y-3">
        <input type="text" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="URL de l'image" className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none" />
        <input type="text" value={form.caption} onChange={e => setForm({...form, caption: e.target.value})} placeholder="Légende (optionnel)" className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none" />
        <button onClick={createStory} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm w-full transition-colors">Publier la story</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stories.map((s, i) => (
          <div key={i} className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            <img src={s.image_url} alt={s.caption} className="w-full h-48 object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-4">
              <p className="text-white text-sm font-bold">{s.caption || 'Sans légende'}</p>
              <p className="text-white/60 text-xs">{s.views_count || 0} vues</p>
            </div>
          </div>
        ))}
      </div>
      {stories.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucune story active</p>}
    </div>
  );
}

// ===== CATERING MANAGER =====
function CateringManager() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      const data = await cateringAPI.getRequests();
      setRequests(data.data || data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const respond = async (id, status) => {
    try {
      await cateringAPI.respond(id, status);
      loadRequests();
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  const statusColors = { pending: 'bg-yellow-100 text-yellow-700', accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', completed: 'bg-blue-100 text-blue-700' };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Demandes Traiteur</h2>
      <p className="text-sm text-slate-500 mb-6">Gérez les demandes d'événements et commandes groupées</p>

      <div className="space-y-4">
        {requests.map((r, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800">{r.client_name || `Client #${r.client_id}`}</h3>
                <p className="text-sm text-slate-500">{new Date(r.event_date).toLocaleDateString('fr-FR')} - {r.guest_count} invités</p>
                {r.budget && <p className="text-sm font-bold text-indigo-600 mt-1">Budget: {parseFloat(r.budget).toLocaleString()} FCFA</p>}
                {r.notes && <p className="text-xs text-slate-400 mt-2 italic">"{r.notes}"</p>}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[r.status]}`}>{r.status}</span>
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => respond(r.id, 'accepted')} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-bold text-sm transition-colors">Accepter</button>
                <button onClick={() => respond(r.id, 'rejected')} className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-xl font-bold text-sm transition-colors">Refuser</button>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucune demande traiteur</p>}
      </div>
    </div>
  );
}

// ===== OPTIONS MANAGER =====
function OptionsManager({ menuItems }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [options, setOptions] = useState([]);
  const [showAddOption, setShowAddOption] = useState(false);
  const [optForm, setOptForm] = useState({ name: '', type: 'single', is_required: false });
  const [valForm, setValForm] = useState({ name: '', price_extra: '' });
  const [addingValueTo, setAddingValueTo] = useState(null);

  const loadOptions = async (menuItemId) => {
    try {
      const data = await customizationAPI.getOptions(menuItemId);
      setOptions(data || []);
    } catch(e) { console.error(e); }
  };

  const selectItem = (item) => {
    setSelectedItem(item);
    loadOptions(item.id);
  };

  const addOption = async () => {
    if (!optForm.name.trim()) return;
    try {
      await customizationAPI.createOption({ ...optForm, menu_item_id: selectedItem.id });
      setOptForm({ name: '', type: 'single', is_required: false });
      setShowAddOption(false);
      loadOptions(selectedItem.id);
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  const deleteOption = async (id) => {
    if (!confirm('Supprimer cette option ?')) return;
    try {
      await customizationAPI.deleteOption(id);
      loadOptions(selectedItem.id);
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  const addValue = async (optionId) => {
    if (!valForm.name.trim()) return;
    try {
      await customizationAPI.addValue(optionId, { name: valForm.name, price_extra: parseFloat(valForm.price_extra) || 0 });
      setValForm({ name: '', price_extra: '' });
      setAddingValueTo(null);
      loadOptions(selectedItem.id);
    } catch(e) { alert(e.message || 'Erreur'); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Options & Personnalisation</h2>
      <p className="text-sm text-slate-500 mb-6">Ajoutez des options de personnalisation à vos plats (taille, suppléments, sauces...)</p>

      {!selectedItem ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y">
          {menuItems.map(item => (
            <div key={item.id} onClick={() => selectItem(item)} className="flex items-center px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-400">{item.category} - {parseFloat(item.price).toLocaleString()} FCFA</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </div>
          ))}
          {menuItems.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun plat dans le menu</p>}
        </div>
      ) : (
        <div>
          <button onClick={() => { setSelectedItem(null); setOptions([]); }} className="flex items-center text-sm text-slate-500 hover:text-slate-800 font-bold mb-4">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour au menu
          </button>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-4">
            <h3 className="font-bold text-slate-800 text-lg">{selectedItem.name}</h3>
            <p className="text-sm text-slate-500">{selectedItem.category}</p>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700">Groupes d'options</h3>
            <button onClick={() => setShowAddOption(!showAddOption)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
              {showAddOption ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {showAddOption && (
            <div className="bg-slate-50 rounded-2xl p-4 mb-4 space-y-3">
              <input type="text" value={optForm.name} onChange={e => setOptForm({...optForm, name: e.target.value})} placeholder="Nom du groupe (ex: Sauce, Taille)" className="w-full bg-white rounded-xl px-4 py-3 text-sm outline-none border" />
              <div className="flex gap-3">
                <select value={optForm.type} onChange={e => setOptForm({...optForm, type: e.target.value})} className="bg-white rounded-xl px-4 py-3 text-sm outline-none border">
                  <option value="single">Choix unique</option>
                  <option value="multiple">Choix multiples</option>
                </select>
                <label className="flex items-center text-sm"><input type="checkbox" checked={optForm.is_required} onChange={e => setOptForm({...optForm, is_required: e.target.checked})} className="mr-2" /> Obligatoire</label>
              </div>
              <button onClick={addOption} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm w-full">Créer le groupe</button>
            </div>
          )}

          <div className="space-y-4">
            {options.map(opt => (
              <div key={opt.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className="font-bold text-slate-800">{opt.name}</h4>
                    <p className="text-xs text-slate-400">{opt.type === 'single' ? 'Choix unique' : 'Choix multiples'} {opt.is_required ? '(obligatoire)' : ''}</p>
                  </div>
                  <button onClick={() => deleteOption(opt.id)} className="text-red-400 hover:text-red-600 text-xs font-bold">Supprimer</button>
                </div>

                <div className="space-y-2">
                  {(opt.values || []).map(v => (
                    <div key={v.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2">
                      <span className="text-sm text-slate-700">{v.name}</span>
                      <span className="text-xs text-indigo-600 font-bold">{v.price_extra > 0 ? `+${parseFloat(v.price_extra).toLocaleString()} F` : 'Inclus'}</span>
                    </div>
                  ))}
                </div>

                {addingValueTo === opt.id ? (
                  <div className="flex gap-2 mt-3">
                    <input type="text" value={valForm.name} onChange={e => setValForm({...valForm, name: e.target.value})} placeholder="Nom" className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-sm outline-none border" />
                    <input type="number" value={valForm.price_extra} onChange={e => setValForm({...valForm, price_extra: e.target.value})} placeholder="Prix +" className="w-24 bg-slate-50 rounded-xl px-3 py-2 text-sm outline-none border" />
                    <button onClick={() => addValue(opt.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">OK</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingValueTo(opt.id)} className="mt-3 text-xs text-indigo-600 font-bold hover:text-indigo-800">+ Ajouter une valeur</button>
                )}
              </div>
            ))}
            {options.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Aucune option configurée pour ce plat</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Composant Analytiques Dashboard
function AnalyticsDashboard() {
  const [overview, setOverview] = useState(null);
  const [popularItems, setPopularItems] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async () => {
    try {
      const [ov, pop, peak, rev] = await Promise.all([
        analyticsAPI.getOverview().catch(() => null),
        analyticsAPI.getPopularItems().catch(() => []),
        analyticsAPI.getPeakHours().catch(() => []),
        analyticsAPI.getRevenueChart().catch(() => []),
      ]);
      setOverview(ov);
      setPopularItems(Array.isArray(pop) ? pop : pop?.items || []);
      setPeakHours(Array.isArray(peak) ? peak : peak?.hours || []);
      setRevenueChart(Array.isArray(rev) ? rev : rev?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fmt = (n) => {
    if (n == null) return '—';
    return Number(n).toLocaleString('fr-FR');
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  const overviewCards = [
    { label: "Aujourd'hui", value: overview?.today ?? 0, color: 'bg-indigo-500', icon: DollarSign },
    { label: 'Cette semaine', value: overview?.week ?? 0, color: 'bg-emerald-500', icon: TrendingUp },
    { label: 'Ce mois', value: overview?.month ?? 0, color: 'bg-amber-500', icon: ShoppingBag },
    { label: 'Total', value: overview?.total ?? 0, color: 'bg-slate-700', icon: Star },
  ];

  const maxPeakOrders = Math.max(...(peakHours.map(h => h.orders || h.count || 0)), 1);
  const maxRevenue = Math.max(...(revenueChart.map(d => d.revenue || d.amount || 0)), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Analytiques</h2>
      <p className="text-sm text-slate-500 mb-6">Vue d'ensemble des performances de votre restaurant</p>

      {/* Revenue Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {overviewCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 ${card.color} opacity-10 rounded-bl-[40px]`} />
            <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.label}</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{fmt(card.value)} <span className="text-sm font-medium text-slate-400">FCFA</span></p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Popular Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" /> Top 10 Plats
          </h3>
          {popularItems.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Aucune donnée disponible</p>}
          <div className="space-y-3">
            {popularItems.slice(0, 10).map((item, i) => {
              const maxCount = Math.max(...popularItems.slice(0, 10).map(it => it.order_count || it.count || 0), 1);
              const count = item.order_count || item.count || 0;
              const pct = (count / maxCount) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-700 truncate">{item.name || item.item_name || `Plat #${item.menu_item_id}`}</span>
                      <span className="text-xs font-bold text-slate-500 ml-2 flex-shrink-0">{count} cmd</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Heures de pointe
          </h3>
          {peakHours.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Aucune donnée disponible</p>}
          <div className="flex items-end gap-1 h-48">
            {peakHours.map((h, i) => {
              const orders = h.orders || h.count || 0;
              const pct = (orders / maxPeakOrders) * 100;
              const hour = h.hour != null ? h.hour : i;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <span className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{orders}</span>
                  <div
                    className="w-full bg-indigo-500 rounded-t-md transition-all duration-300 hover:bg-indigo-600 min-h-[2px]"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                    title={`${hour}h - ${orders} commandes`}
                  />
                  <span className="text-[9px] font-semibold text-slate-400">{hour}h</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue Trend - Last 30 days */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500" /> Tendance des revenus (30 derniers jours)
        </h3>
        {revenueChart.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Aucune donnée disponible</p>}
        <div className="flex items-end gap-[3px] h-52">
          {revenueChart.map((d, i) => {
            const rev = d.revenue || d.amount || 0;
            const pct = (rev / maxRevenue) * 100;
            const label = d.date || d.day || '';
            const shortLabel = label.length > 5 ? label.slice(5) : label;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <span className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{fmt(rev)}</span>
                <div
                  className="w-full bg-emerald-400 rounded-t-md transition-all duration-300 hover:bg-emerald-500 min-h-[2px]"
                  style={{ height: `${Math.max(pct, 1)}%` }}
                  title={`${label} - ${fmt(rev)} FCFA`}
                />
                {i % 5 === 0 && <span className="text-[8px] font-semibold text-slate-400 whitespace-nowrap">{shortLabel}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
