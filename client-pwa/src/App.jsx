import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [activePage, setActivePageRaw] = useState('explorer');
  const setActivePage = (page) => { setActivePageRaw(page); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [plats, setPlats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState(null); // loading | success | error | added
  const [panier, setPanier] = useState(() => {
    try { const saved = localStorage.getItem('nooreat_panier'); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [orders, setOrders] = useState([]);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [courierLoc, setCourierLoc] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null); // {lat, lng} for custom delivery address
  const [deliveryAddressCustom, setDeliveryAddressCustom] = useState(''); // custom delivery address text

  // DARK MODE
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('nooreat_dark') === 'true');

  // LANGUAGE
  const [lang, setLang] = useState(() => localStorage.getItem('nooreat_lang') || 'fr');

  // SAVED ADDRESSES
  const [savedAddresses, setSavedAddresses] = useState(() => {
    try { const s = localStorage.getItem('nooreat_addresses'); return s ? JSON.parse(s) : [
      { id: 1, label: 'Maison', icon: '🏠', address: 'Sacré-Cœur 3, Dakar', lat: 14.7167, lng: -17.4677 },
      { id: 2, label: 'Bureau', icon: '💼', address: 'Plateau, Rue Carnot', lat: 14.6697, lng: -17.4381 },
    ]; } catch { return []; }
  });
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');

  // REFERRAL
  const referralCode = user ? `NOOREAT${user.phone?.slice(-4) || 'X'}` : 'NOOREATX';
  const [referralCopied, setReferralCopied] = useState(false);

  // MINI-GAMES
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [scratchRevealed, setScratchRevealed] = useState(false);
  const [scratchPrize, setScratchPrize] = useState(null);
  const [prizeHistory, setPrizeHistory] = useState(() => {
    try { const s = localStorage.getItem('nooreat_prizes'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // CHAT LIVE
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // ADVANCED FILTERS
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ minPrice: 0, maxPrice: 50000, minRating: 0, maxDelivery: 60, diet: [], category: '' });

  // RESTAURANT DETAIL
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // NOTIFICATIONS
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Bienvenue sur NOOR EAT !', body: 'Profitez de -20% sur votre première commande', time: 'Maintenant', read: false, icon: '🎉' },
    { id: 2, title: 'Nouveau restaurant', body: 'Chef Ousmane a ajouté 5 nouveaux plats', time: 'Il y a 2h', read: false, icon: '🍽️' },
    { id: 3, title: 'Livraison gratuite', body: 'Ce week-end, livraison offerte dès 5000 FCFA', time: 'Hier', read: true, icon: '🚚' },
  ]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const unreadNotifs = notifications.filter(n => !n.read).length;

  // PHOTO REVIEWS
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState(null);

  // GROUP ORDER
  const [groupOrderCode, setGroupOrderCode] = useState(null);
  const [groupParticipants, setGroupParticipants] = useState([]);

  // MEAL PLAN
  const [mealPlan, setMealPlan] = useState({ Lundi: [], Mardi: [], Mercredi: [], Jeudi: [], Vendredi: [], Samedi: [], Dimanche: [] });
  const [mealPlanDay, setMealPlanDay] = useState(null);
  const [mealPlanActive, setMealPlanActive] = useState(false);

  // VOICE COMMAND
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');

  // TRANSLATIONS
  const T = {
    fr: {
      explorer: 'Explorer', panier: 'Panier', commandes: 'Commandes', profil: 'Profil',
      rechercher: 'Rechercher un plat, un restaurant...', ajouter_au_panier: 'Ajouter au panier',
      commander: 'Commander', total: 'Total', livraison: 'Livraison', sous_total: 'Sous-total',
      gratuite: 'Gratuite', retour: 'Retour', mon_panier: 'Mon Panier 🛒',
      code_promo: 'Code promo', appliquer: 'Appliquer', confirmer: 'Confirmer Commande',
      portefeuille: 'Portefeuille', defis: 'Défis & Badges', support: 'Support',
      deconnexion: 'Déconnexion', bienvenue: 'Bienvenue !',
      que_voulez_vous_manger: 'Que voulez-vous', manger_aujourdhui: "manger aujourd'hui ?",
      mes_commandes: 'Mes Commandes 📦', re_commander: '🔄 Re-commander',
      suivre_livreur: 'Suivre le livreur', aucune_commande: 'Aucune commande pour le moment',
      panier_vide: 'Votre panier est vide', explorer_plats: 'Explorer les plats',
      adresse_livraison: '📍 Adresse de livraison', mes_adresses: 'Mes Adresses',
      ajouter_adresse: 'Ajouter une adresse', parrainage: 'Parrainage 🎁',
      copier_code: 'Copier le code', code_copie: 'Copié !',
      mini_jeux: '🎮 Mini-Jeux', roue_fortune: 'Roue de la Fortune',
      carte_gratter: 'Carte à Gratter', historique_gains: 'Historique des gains',
      tourner: 'Tourner la roue !', gratter: 'Gratter !', mode_sombre: 'Mode Sombre',
      langue: 'Langue', envoyer: 'Envoyer', chat_livreur: 'Chat Livreur',
      se_connecter: 'Se connecter', livrer_a: 'Livrer à', restaurants: 'Restaurants',
    },
    wo: {
      explorer: 'Wut', panier: 'Paañe', commandes: 'Commandes yi', profil: 'Sàmm',
      rechercher: 'Seet lekk, restoraan...', ajouter_au_panier: 'Dugal ci paañe bi',
      commander: 'Commande', total: 'Tolaal', livraison: 'Yóbbu', sous_total: 'Suub-tolaal',
      gratuite: 'Am njaay', retour: 'Dellu', mon_panier: 'Sama Paañe 🛒',
      code_promo: 'Code promo', appliquer: 'Jëfandikoo', confirmer: 'Dëggal Commande bi',
      portefeuille: 'Portmone', defis: 'Jalgati & Badges', support: 'Ndimbal',
      deconnexion: 'Génn', bienvenue: 'Dalal Jàmm !',
      que_voulez_vous_manger: 'Lu nga bëgg', manger_aujourdhui: 'lekk tey ?',
      mes_commandes: 'Sama Commandes yi 📦', re_commander: '🔄 Commande ko',
      suivre_livreur: 'Toppatoo livreur bi', aucune_commande: 'Amul commande bi tey',
      panier_vide: 'Sa paañe bi amul dara', explorer_plats: 'Wut lekk yi',
      adresse_livraison: '📍 Adresse yóbbu', mes_adresses: 'Sama Adresses yi',
      ajouter_adresse: 'Dugal adresse bu bees', parrainage: 'Parrainage 🎁',
      copier_code: 'Copier code bi', code_copie: 'Copie na !',
      mini_jeux: '🎮 Po yi', roue_fortune: 'Roue bu Chance',
      carte_gratter: 'Carte bu Gratter', historique_gains: 'Liggéey gains yi',
      tourner: 'Wëndeelu roue bi !', gratter: 'Grattee !', mode_sombre: 'Leer bu Lëndëm',
      langue: 'Làkk', envoyer: 'Yónnee', chat_livreur: 'Chat ak livreur bi',
      se_connecter: 'Duggu', livrer_a: 'Yóbbu ci', restaurants: 'Restoraan yi',
    }
  };

  // AUTH CHECK
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // DARK MODE EFFECT
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('nooreat_dark', darkMode);
  }, [darkMode]);

  // LANGUAGE PERSISTENCE
  useEffect(() => {
    localStorage.setItem('nooreat_lang', lang);
  }, [lang]);

  // SAVED ADDRESSES PERSISTENCE
  useEffect(() => {
    localStorage.setItem('nooreat_addresses', JSON.stringify(savedAddresses));
  }, [savedAddresses]);

  // PRIZE HISTORY PERSISTENCE
  useEffect(() => {
    localStorage.setItem('nooreat_prizes', JSON.stringify(prizeHistory));
  }, [prizeHistory]);

  // CHAT LIVE SEND
  const sendChatMessage = async (msg) => {
    if (!msg.trim()) return;
    const newMsg = { id: Date.now(), text: msg, sender: 'client', time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    try {
      const { chatLiveAPI } = await import('./api');
      const response = await chatLiveAPI.send({ orderId: trackingOrder?.id, message: msg });
      if (response?.message) {
        setChatMessages(prev => [...prev, { id: Date.now() + 1, text: response.message, sender: 'courier', time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
      }
    } catch {
      // Auto-reply simulation if API unavailable
      setTimeout(() => {
        setChatMessages(prev => [...prev, { id: Date.now() + 1, text: "J'arrive dans quelques minutes ! 🏍️", sender: 'courier', time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
      }, 1500);
    }
  };

  // WHEEL SPIN HANDLER
  const spinWheel = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setWheelResult(null);
    const prizes = ['500 FCFA', '100 FCFA', 'Livraison gratuite', '200 FCFA', 'Dessert offert', '50 FCFA', '1000 FCFA', 'Rien'];
    const idx = Math.floor(Math.random() * prizes.length);
    const newRotation = wheelRotation + 1440 + (idx * 45) + Math.random() * 30;
    setWheelRotation(newRotation);
    setTimeout(() => {
      setWheelSpinning(false);
      const prize = prizes[idx];
      setWheelResult(prize);
      if (prize !== 'Rien') {
        setPrizeHistory(prev => [{ prize, date: new Date().toLocaleDateString('fr-FR'), type: 'roue' }, ...prev].slice(0, 20));
      }
    }, 4000);
  };

  // SCRATCH CARD HANDLER
  const revealScratch = () => {
    if (scratchRevealed) return;
    const prizes = ['200 FCFA', '500 FCFA', 'Livraison gratuite', '100 FCFA', 'Rien', '300 FCFA'];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    setScratchPrize(prize);
    setScratchRevealed(true);
    if (prize !== 'Rien') {
      setPrizeHistory(prev => [{ prize, date: new Date().toLocaleDateString('fr-FR'), type: 'gratter' }, ...prev].slice(0, 20));
    }
  };

  // RE-ORDER HANDLER
  const reOrder = (order) => {
    if (order.items && order.items.length > 0) {
      setPanier(order.items.map(item => ({ ...item, qty: item.qty || 1 })));
    }
    setActivePage('panier');
  };

  // GEOLOCATION - Detect user position
  const detectLocation = async () => {
    setGeoLoading(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const { latitude, longitude } = pos.coords;
      setUserLocation({ lat: latitude, lng: longitude });

      // Reverse geocode with OpenStreetMap Nominatim (free, no API key)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=fr`);
        const data = await res.json();
        const addr = data.address;
        const shortAddr = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || 'Dakar';
        setUserAddress(`${shortAddr}, ${addr.city || addr.state || 'Sénégal'}`);
      } catch { setUserAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`); }
    } catch (err) {
      console.warn('Geolocation error:', err.message);
      // Default to Dakar center
      setUserLocation({ lat: 14.6937, lng: -17.4441 });
      setUserAddress('Plateau, Dakar');
    }
    setGeoLoading(false);
  };

  useEffect(() => { detectLocation(); }, []);

  // Calculate delivery distance/fee estimate
  const calculateDeliveryEstimate = async (restaurantLat, restaurantLng) => {
    if (!userLocation) return;
    const R = 6371;
    const dLat = (userLocation.lat - restaurantLat) * Math.PI / 180;
    const dLng = (userLocation.lng - restaurantLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(restaurantLat * Math.PI / 180) * Math.cos(userLocation.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const fee = Math.ceil((500 + dist * 200) / 100) * 100;
    setDeliveryEstimate({
      distance_km: Math.round(dist * 10) / 10,
      delivery_fee: fee,
      estimated_time_min: Math.round(dist * 4 + 10),
    });
  };

  // Auto-calculate delivery estimate when userLocation is available
  useEffect(() => {
    if (userLocation && !deliveryEstimate) {
      // Default estimate from Dakar center
      const R = 6371;
      const rLat = 14.6937; const rLng = -17.4441;
      const dLat = (userLocation.lat - rLat) * Math.PI / 180;
      const dLng = (userLocation.lng - rLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat * Math.PI / 180) * Math.cos(userLocation.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const fee = Math.ceil((500 + dist * 200) / 100) * 100;
      setDeliveryEstimate({ distance_km: Math.round(dist * 10) / 10, delivery_fee: fee, estimated_time_min: Math.round(dist * 4 + 10) });
    }
  }, [userLocation]);

  // SUIVI COMMANDE — sondage REST (remplace Socket.IO, indisponible sur ce
  // deploiement serverless Vercel : le backend n'expose que l'app Express a
  // la fonction, jamais le http.Server auquel Socket.IO attache ses upgrades).
  useEffect(() => {
    if (!token || !trackingOrder) return;
    let cancelled = false;
    let prevStatus = trackingOrder.status;
    const poll = async () => {
      try {
        const { clientAPI } = await import('./api');
        const data = await clientAPI.trackOrder(trackingOrder.id);
        if (cancelled || !data || data.error) return;
        if (data.courier_lat && data.courier_lng) {
          setCourierLoc({ lat: Number(data.courier_lat), lng: Number(data.courier_lng) });
        }
        if (data.status !== prevStatus) {
          prevStatus = data.status;
          setOrderStatus('status_update');
          setTimeout(() => setOrderStatus(null), 3000);
          fetchOrders();
        }
        setTrackingOrder((prev) => (prev ? { ...prev, ...data } : prev));
      } catch (err) {
        console.error('Erreur suivi commande:', err);
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, trackingOrder?.id]);

  const fetchOrders = async () => {
    try {
      const { clientAPI } = await import('./api');
      const data = await clientAPI.getOrders();
      setOrders(data.data || []);
    } catch (err) {
      console.error('Fetch orders error:', err);
    }
  };

  useEffect(() => {
    if (user && activePage === 'commandes') {
      fetchOrders();
    }
  }, [user, activePage]);

  const addToPanier = (plat) => {
    setPanier(prev => {
      // Vérifier si le panier contient déjà des produits d'un autre restaurant
      if (prev.length > 0 && prev[0].restaurant_id && plat.restaurant_id && prev[0].restaurant_id !== plat.restaurant_id) {
         // Auto-switch restaurant cart
         return [{...plat, qty: 1}];
      }
      const exists = prev.find(p => p.id === plat.id);
      if (exists) return prev.map(p => p.id === plat.id ? {...p, qty: p.qty + 1} : p);
      return [...prev, {...plat, qty: 1}];
    });
    setOrderStatus('added');
    setTimeout(() => setOrderStatus(null), 2000);
  };

  const removeFromPanier = (id) => setPanier(prev => prev.filter(p => p.id !== id));

  const handleCheckout = async () => {
    if (!user) {
       setActivePage('profil');
       return;
    }
    setOrderStatus('loading');
    try {
      const { clientAPI } = await import('./api');
      const finalLat = deliveryCoords?.lat || userLocation?.lat || 14.6937;
      const finalLng = deliveryCoords?.lng || userLocation?.lng || -17.4441;
      const finalAddr = deliveryAddressCustom || userAddress || "Plateau, Dakar";
      const orderData = {
        restaurant_id: panier[0].restaurant_id,
        items: panier.map(p => ({ menu_item_id: p.id, quantity: p.qty })),
        delivery_address: finalAddr,
        latitude: finalLat,
        longitude: finalLng,
        payment_method: paymentMethod,
        promo_code: promoApplied ? promoCode : null,
        delivery_fee: deliveryEstimate?.delivery_fee || 0
      };

      await clientAPI.createOrder(orderData);
      
      setPanier([]);
      setPromoCode('');
      setPromoDiscount(0);
      setPromoApplied(false);
      setDeliveryAddressCustom('');
      setDeliveryCoords(null);
      setOrderStatus('success');
      setTimeout(() => {
        setOrderStatus(null);
        setActivePage('commandes');
      }, 2000);
    } catch (err) {
      alert(err.message || "Erreur lors de la commande");
      setOrderStatus('error');
      setTimeout(() => setOrderStatus(null), 3000);
    }
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    try {
      const { promotionsAPI } = await import('./api');
      const data = await promotionsAPI.validate(promoCode, totalPanier, panier[0]?.restaurant_id);
      setPromoDiscount(data.discount_amount);
      setPromoApplied(true);
    } catch (err) {
      alert(err.message || 'Code promo invalide');
      setPromoDiscount(0);
      setPromoApplied(false);
    }
  };

  const totalPanier = panier.reduce((acc, p) => acc + (p.price * p.qty), 0);

  // DONNÉES STATIQUES (50 plats certifiés) - garantit l'affichage même sans serveur
  const STATIC_PLATS = [
    { id:1, name:"Le Classique", description:"Steak haché pur bœuf, cheddar, salade, tomate", price:3500, category:"Fast Food", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80", rating:"4.7", deliveryTime:"20-30 min", featured:false },
    { id:2, name:"Tiep Bou Dien Rouge", description:"Le plat national sénégalais avec du poisson et riz rouge", price:3000, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80", rating:"4.9", deliveryTime:"25-35 min", featured:true },
    { id:3, name:"Pizza Margherita", description:"Sauce tomate, mozzarella fraîche, basilic", price:5000, category:"Pizza", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", rating:"4.5", deliveryTime:"20-30 min", featured:false },
    { id:4, name:"Jus de Bissap", description:"Délicieux jus d'hibiscus rafraîchissant", price:1000, category:"Jus Locaux", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80", rating:"4.8", deliveryTime:"10-15 min", featured:false },
    { id:5, name:"Dibi Agneau", description:"Agneau grillé au feu de bois avec oignons", price:7000, category:"Grillades", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", rating:"4.9", deliveryTime:"30-40 min", featured:true },
    { id:6, name:"Yassa Poulet", description:"Poulet mariné à la moutarde et aux oignons caramélisés", price:3500, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=500&q=80", rating:"4.8", deliveryTime:"25-35 min", featured:false },
    { id:7, name:"Thiébou Yapp", description:"Riz au bœuf à la sénégalaise avec légumes", price:3200, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1574484284002-952d92456975?w=500&q=80", rating:"4.6", deliveryTime:"30-40 min", featured:false },
    { id:8, name:"Mafé", description:"Ragoût de bœuf à la sauce d'arachide", price:3000, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1547592180-85f173990554?w=500&q=80", rating:"4.7", deliveryTime:"30-40 min", featured:false },
    { id:9, name:"Domoda", description:"Plat traditionnel à la courge et pâte d'arachide", price:2800, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80", rating:"4.5", deliveryTime:"25-35 min", featured:false },
    { id:10, name:"Chawarma Poulet", description:"Poulet grillé, légumes, sauce tahini dans une galette", price:3500, category:"Chawarma", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&q=80", rating:"4.6", deliveryTime:"15-25 min", featured:true },
    { id:11, name:"Pastels au Thon", description:"Beignets croustillants farcis au thon et légumes", price:1500, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1600803907087-f56d462fd26b?w=500&q=80", rating:"4.4", deliveryTime:"15-25 min", featured:false },
    { id:12, name:"Riz Sauté au Poulet", description:"Wok de riz sauté aux légumes et poulet tendre", price:4000, category:"Asiatique", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&q=80", rating:"4.5", deliveryTime:"20-30 min", featured:false },
    { id:13, name:"Nems au Porc", description:"Rouleaux de printemps frits, sauce nuoc-mam", price:3500, category:"Asiatique", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1564671165093-20688ff1fffa?w=500&q=80", rating:"4.3", deliveryTime:"20-30 min", featured:false },
    { id:14, name:"Salade César", description:"Salade romaine, parmesan, croûtons, sauce César", price:3200, category:"Salades", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=500&q=80", rating:"4.4", deliveryTime:"10-20 min", featured:false },
    { id:15, name:"Pizza Royale", description:"Jambon, champignons, mozzarella, sauce tomate", price:6500, category:"Pizza", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80", rating:"4.7", deliveryTime:"25-35 min", featured:true },
    { id:16, name:"Jus de Gingembre", description:"Jus de gingembre frais, tonique et revigorant", price:1200, category:"Jus Locaux", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80", rating:"4.7", deliveryTime:"10-15 min", featured:false },
    { id:17, name:"Brochettes de Bœuf", description:"Brochettes marinées aux épices et herbes fraîches", price:5500, category:"Grillades", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80", rating:"4.8", deliveryTime:"25-35 min", featured:false },
    { id:18, name:"Thiakry", description:"Couscous de mil au lait caillé et sucre", price:1500, category:"Desserts", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80", rating:"4.6", deliveryTime:"10-15 min", featured:false },
    { id:19, name:"Double Cheese Burger", description:"Double steak, double cheddar, bacon croustillant", price:5500, category:"Fast Food", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80", rating:"4.8", deliveryTime:"20-30 min", featured:true },
    { id:20, name:"Tacos Sénégalais", description:"Galette garnie de poulet braisé, frites et sauce blanche", price:3500, category:"Fast Food", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&q=80", rating:"4.5", deliveryTime:"15-25 min", featured:false },
    { id:21, name:"Ndambé", description:"Haricots rouges mijotés aux épices sénégalaises", price:1500, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1602253057119-44d745d9b860?w=500&q=80", rating:"4.4", deliveryTime:"20-30 min", featured:false },
    { id:22, name:"Poulet DG", description:"Poulet aux légumes façon camerounaise", price:5000, category:"Grillades", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&q=80", rating:"4.6", deliveryTime:"30-40 min", featured:false },
    { id:23, name:"Pizza 4 Fromages", description:"Mozzarella, gorgonzola, emmental, chèvre", price:7000, category:"Pizza", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80", rating:"4.7", deliveryTime:"25-35 min", featured:false },
    { id:24, name:"Salade Avocat Crevettes", description:"Salade fraîche, avocat tranché, crevettes roses", price:4500, category:"Salades", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", rating:"4.7", deliveryTime:"15-25 min", featured:true },
    { id:25, name:"Sushis Mixtes (8 pcs)", description:"Assortiment de sushis salmon, thon, crevette", price:8000, category:"Asiatique", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80", rating:"4.9", deliveryTime:"20-30 min", featured:true },
    { id:26, name:"Jus de Ditakh", description:"Jus de ditakhali, subtil et parfumé", price:1500, category:"Jus Locaux", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&q=80", rating:"4.5", deliveryTime:"10-15 min", featured:false },
    { id:27, name:"Chawarma Bœuf", description:"Fines tranches de bœuf, houmous, légumes marinés", price:4000, category:"Chawarma", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=500&q=80", rating:"4.6", deliveryTime:"15-25 min", featured:false },
    { id:28, name:"Churros au Nutella", description:"Churros dorés, sauce Nutella pour tremper", price:2500, category:"Desserts", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1541592553160-82008b127ccb?w=500&q=80", rating:"4.7", deliveryTime:"15-20 min", featured:false },
    { id:29, name:"Chicken Wings BBQ", description:"Ailes de poulet marinées, sauce BBQ fumée", price:4500, category:"Fast Food", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&q=80", rating:"4.7", deliveryTime:"20-30 min", featured:false },
    { id:30, name:"Poulet Rôti", description:"Poulet fermier rôti, herbes aromatiques, pommes de terre", price:8000, category:"Grillades", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1528575235951-5eb05e3df20c?w=500&q=80", rating:"4.8", deliveryTime:"35-45 min", featured:true },
    { id:31, name:"Pad Thaï", description:"Nouilles de riz sautées, crevettes, cacahuètes, citron", price:5500, category:"Asiatique", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80", rating:"4.7", deliveryTime:"20-30 min", featured:false },
    { id:32, name:"Tiep Bou Dien Blanc", description:"Riz blanc au poisson et légumes variés", price:2800, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&q=80", rating:"4.8", deliveryTime:"25-35 min", featured:false },
    { id:33, name:"Falafel Wrap", description:"Boulettes de pois chiches, salade, tzatziki", price:3000, category:"Chawarma", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=500&q=80", rating:"4.5", deliveryTime:"15-25 min", featured:false },
    { id:34, name:"Pizza Pepperoni", description:"Pepperoni généreux, sauce tomate piquante", price:6000, category:"Pizza", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&q=80", rating:"4.7", deliveryTime:"25-35 min", featured:false },
    { id:35, name:"Jus de Baobab", description:"Au fruit du baobab, riche en vitamines C", price:1500, category:"Jus Locaux", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1622597467836-f3e6707f4b0d?w=500&q=80", rating:"4.9", deliveryTime:"10-15 min", featured:true },
    { id:36, name:"Glace Artisanale 3 Boules", description:"Vanille, caramel, chocolat - fabrication locale", price:2500, category:"Desserts", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=500&q=80", rating:"4.6", deliveryTime:"10-20 min", featured:false },
    { id:37, name:"Ketchikan (Burger Poisson)", description:"Filet de poisson croustillant, sauce tartare", price:4000, category:"Fast Food", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500&q=80", rating:"4.5", deliveryTime:"20-30 min", featured:false },
    { id:38, name:"Ramen Poulet", description:"Soupe japonaise, nouilles, œuf mollet, nori", price:5500, category:"Asiatique", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=500&q=80", rating:"4.7", deliveryTime:"25-35 min", featured:false },
    { id:39, name:"Salade Niçoise", description:"Thon, haricots verts, œufs, olives, anchois", price:4000, category:"Salades", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80", rating:"4.5", deliveryTime:"15-25 min", featured:false },
    { id:40, name:"Thiou Boulettes", description:"Boulettes de poisson à la sauce tomate sénégalaise", price:2500, category:"Sénégalais", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1547592180-85f173990554?w=500&q=80", rating:"4.6", deliveryTime:"25-35 min", featured:true },
    { id:41, name:"Grillades Mixtes", description:"Assortiment de viandes grillées pour 2 personnes", price:12000, category:"Grillades", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80", rating:"4.9", deliveryTime:"35-45 min", featured:false },
    { id:42, name:"Crêpe Nutella Banane", description:"Crêpe fine, Nutella généreux, tranches de banane", price:2000, category:"Desserts", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&q=80", rating:"4.7", deliveryTime:"15-20 min", featured:false },
    { id:43, name:"Jus de Tamarin", description:"Jus de tamarin gingembre, acidulé et rafraîchissant", price:1200, category:"Jus Locaux", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=500&q=80", rating:"4.6", deliveryTime:"10-15 min", featured:false },
    { id:44, name:"Chawarma Mixte", description:"Poulet et agneau, sauce yaourt et épices orientales", price:4500, category:"Chawarma", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=500&q=80", rating:"4.8", deliveryTime:"15-25 min", featured:false },
    { id:45, name:"Spaghetti Bolognaise", description:"Pâtes al dente, sauce bolognaise maison", price:4000, category:"Asiatique", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1551183053-bf91798d792b?w=500&q=80", rating:"4.5", deliveryTime:"20-30 min", featured:false },
    { id:46, name:"Poulet Basquaise", description:"Poulet mijoté aux poivrons et tomates, style basque", price:5500, category:"Grillades", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=500&q=80", rating:"4.7", deliveryTime:"30-40 min", featured:true },
    { id:47, name:"Salade de Fruits Tropicaux", description:"Mangue, ananas, papaye, pastèque, jus de citron", price:2500, category:"Desserts", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1546173159-315724a31696?w=500&q=80", rating:"4.8", deliveryTime:"10-15 min", featured:false },
    { id:48, name:"Pizza Végétarienne", description:"Légumes rôtis, roquette, copeaux de parmesan", price:5500, category:"Pizza", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1571066811602-716837d681de?w=500&q=80", rating:"4.5", deliveryTime:"25-35 min", featured:false },
    { id:49, name:"Salade Grecque", description:"Concombre, feta, olives noires, tomates, origan", price:3500, category:"Salades", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80", rating:"4.6", deliveryTime:"10-20 min", featured:false },
    { id:50, name:"Lakh", description:"Semoule au lait caillé sucré, dessert traditionnel sénégalais", price:1500, category:"Desserts", restaurant_name:"Chef Ousmane (Dark Kitchen)", image_url:"https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80", rating:"4.8", deliveryTime:"10-15 min", featured:true },
  ];

  // FETCH BDD (essai live, fallback sur données statiques)
  useEffect(() => {
    // On charge d'abord les données statiques pour affichage immédiat
    setPlats(STATIC_PLATS);
    setLoading(false);

    // On tente en parallèle de récupérer les données live du serveur
    const apiUrl = '/api/client/plats';
    fetch(apiUrl, { headers: { 'bypass-tunnel-reminder': 'true' }, signal: AbortSignal.timeout(5000) })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map(p => ({
            ...p,
            rating: (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1),
            deliveryTime: '20-30 min',
            featured: p.id % 5 === 0
          }));
          setPlats(formatted);
          console.log('✅ Données live chargées:', formatted.length, 'plats');
        }
      })
      .catch(() => console.log('ℹ️ Mode hors-ligne: données statiques utilisées'));
  }, []);

  const categories = [
    { name: 'Tous', icon: '🍽️' },
    { name: 'Sénégalais', icon: '🐟' },
    { name: 'Fast Food', icon: '🍔' },
    { name: 'Pizza', icon: '🍕' },
    { name: 'Jus Locaux', icon: '🍹' },
    { name: 'Desserts', icon: '🍰' },
    { name: 'Grillades', icon: '🍢' },
    { name: 'Asiatique', icon: '🍣' },
    { name: 'Salades', icon: '🥗' },
    { name: 'Chawarma', icon: '🌯' },
  ];

  // Moteur de recherche sémantique (Fuse.js)
  const fuse = useMemo(() => new Fuse(plats, {
    keys: ['name', 'description', 'category'],
    threshold: 0.4, // Sensibilité (0 = exact, 1 = n'importe quoi)
    includeScore: true
  }), [plats]);

  const filteredPlats = useMemo(() => {
    let result = activeCategory === 'Tous'
      ? plats
      : plats.filter(p => p.category === activeCategory);

    if (searchQuery.trim().length > 1) {
      const searchResults = fuse.search(searchQuery);
      result = searchResults.map(r => r.item);
    }

    // Advanced filters
    if (filters.minPrice > 0) result = result.filter(p => p.price >= filters.minPrice);
    if (filters.maxPrice < 50000) result = result.filter(p => p.price <= filters.maxPrice);
    if (filters.minRating > 0) result = result.filter(p => parseFloat(p.rating) >= filters.minRating);
    if (filters.maxDelivery < 60) {
      result = result.filter(p => {
        const match = p.deliveryTime?.match(/(\d+)/);
        return match ? parseInt(match[1]) <= filters.maxDelivery : true;
      });
    }

    return result;
  }, [plats, activeCategory, searchQuery, fuse, filters]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20 relative">
      
      {/* TOAST / ALERTE COMMANDE */}
      {orderStatus && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-sm flex items-center justify-center transition-all animate-in fade-in zoom-in duration-300">
          {orderStatus === 'added' && (
            <div className="bg-secondary text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
               <span className="text-2xl animate-bounce">🛒</span>
               <span className="font-bold">Ajouté au panier !</span>
            </div>
          )}
          {orderStatus === 'loading' && (
            <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-100">
               <div className="w-5 h-5 rounded-full border-4 border-t-primary border-l-primary border-b-gray-200 border-r-gray-200 animate-spin"></div>
               <span className="font-bold text-gray-800">Communication avec {paymentMethod.toUpperCase()}...</span>
            </div>
          )}
          {orderStatus === 'success' && (
            <div className="bg-green-500 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
               <span className="text-white text-2xl">🎉</span>
               <span className="font-bold text-white">Commande réussie !</span>
            </div>
          )}
          {orderStatus === 'status_update' && (
            <div className="bg-indigo-600 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20">
               <span className="text-white text-2xl">🔔</span>
               <span className="font-bold text-white text-sm">Votre commande a été mise à jour !</span>
            </div>
          )}
        </div>
      )}

      {/* HEADER / HERO - seulement sur Explorer */}
      {activePage === 'explorer' && (
      <>
      <header className="relative bg-secondary text-white rounded-b-[40px] overflow-hidden">
        {/* Background Graphic */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20">
          <img 
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
            alt="Food bg" 
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="relative z-10 px-6 pt-12 pb-16 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
               <div className="hidden sm:flex w-12 h-12 bg-primary rounded-2xl items-center justify-center shadow-lg shadow-primary/20 scale-110">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
               </div>
               <div>
                 <p className="text-gray-400 text-sm font-medium">{T[lang].livrer_a}</p>
                 <div className="flex items-center gap-2 cursor-pointer">
                   <span onClick={detectLocation} className="font-bold text-lg md:text-xl cursor-pointer">{geoLoading ? '📍 Localisation...' : `${userAddress || 'Plateau, Dakar'} 🇸🇳`}</span>
                   <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                 </div>
               </div>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                  <span className="text-sm font-bold">{user.name}</span>
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f97316&color=fff`} className="w-8 h-8 rounded-full" alt="User"/>
                </div>
              ) : (
                <button onClick={() => setActivePage('profil')} className="bg-primary hover:bg-orange-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20">
                  {T[lang].se_connecter}
                </button>
              )}
              <div onClick={() => setActivePage('notifications')} className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {unreadNotifs > 0 && <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce">{unreadNotifs}</span>}
              </div>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-1 tracking-tight">{T[lang].que_voulez_vous_manger}</h1>
            <h1 className="text-3xl md:text-5xl font-extrabold text-primary mb-8 tracking-tight">{T[lang].manger_aujourdhui}</h1>
          </div>

          {/* Search Bar */}
          <div className="relative glass rounded-2xl flex items-center p-2 max-w-xl group focus-within:ring-4 focus-within:ring-primary/20 transition-all">
            <svg className="w-6 h-6 text-gray-500 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={T[lang].rechercher}
              className="w-full bg-transparent border-none focus:outline-none text-gray-800 px-3 placeholder-gray-500 font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="p-1 text-gray-400 hover:text-gray-600 mr-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            )}
            {/* Voice Command Button */}
            <button
              onClick={() => {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                  const recognition = new SpeechRecognition();
                  recognition.lang = lang === 'wo' ? 'fr-FR' : 'fr-FR';
                  recognition.continuous = false;
                  recognition.onstart = () => setVoiceListening(true);
                  recognition.onresult = (e) => { setSearchQuery(e.results[0][0].transcript); setVoiceListening(false); };
                  recognition.onerror = () => setVoiceListening(false);
                  recognition.onend = () => setVoiceListening(false);
                  recognition.start();
                } else { alert('Commande vocale non supportée'); }
              }}
              className={`p-3 rounded-xl transition-colors ${voiceListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/80 text-gray-500 hover:text-primary'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            </button>
            {/* Filter Button */}
            <button onClick={() => setShowFilters(!showFilters)} className="bg-primary hover:bg-orange-600 text-white rounded-xl p-3 transition-colors relative">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
               {(filters.minPrice > 0 || filters.maxPrice < 50000 || filters.minRating > 0 || filters.maxDelivery < 60) && (
                 <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
               )}
            </button>
          </div>

          {/* FILTER PANEL */}
          {showFilters && (
            <div className="mt-4 glass rounded-2xl p-6 animate-in slide-in-from-top duration-300">
              <h4 className="font-black text-white text-sm mb-4">{lang === 'fr' ? 'Filtres avancés' : 'Filtres yi'}</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Prix */}
                <div>
                  <label className="text-[10px] font-bold text-white/60 uppercase">{lang === 'fr' ? 'Prix min' : 'Prix min'}</label>
                  <input type="number" value={filters.minPrice} onChange={e => setFilters(f => ({...f, minPrice: +e.target.value}))} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/60 uppercase">{lang === 'fr' ? 'Prix max' : 'Prix max'}</label>
                  <input type="number" value={filters.maxPrice} onChange={e => setFilters(f => ({...f, maxPrice: +e.target.value}))} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none" placeholder="50000" />
                </div>
                {/* Rating */}
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-white/60 uppercase mb-2 block">{lang === 'fr' ? 'Note minimum' : 'Note minimum'}</label>
                  <div className="flex gap-2">
                    {[0, 3, 3.5, 4, 4.5].map(r => (
                      <button key={r} onClick={() => setFilters(f => ({...f, minRating: r}))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${filters.minRating === r ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                        {r === 0 ? 'Tous' : `${r}⭐`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Delivery time */}
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-white/60 uppercase mb-2 block">{lang === 'fr' ? 'Temps de livraison' : 'Waxtub yóbbu'}</label>
                  <div className="flex gap-2">
                    {[{v: 60, l: 'Tous'}, {v: 20, l: '< 20 min'}, {v: 30, l: '< 30 min'}, {v: 45, l: '< 45 min'}].map(t => (
                      <button key={t.v} onClick={() => setFilters(f => ({...f, maxDelivery: t.v}))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${filters.maxDelivery === t.v ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setFilters({ minPrice: 0, maxPrice: 50000, minRating: 0, maxDelivery: 60, diet: [], category: '' }); }} className="flex-1 py-3 bg-white/10 text-white font-bold rounded-xl text-xs hover:bg-white/20 transition-colors">
                  {lang === 'fr' ? 'Réinitialiser' : 'Teddaat'}
                </button>
                <button onClick={() => setShowFilters(false)} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl text-xs hover:bg-orange-600 transition-colors">
                  {lang === 'fr' ? 'Appliquer' : 'Jëfandikoo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 relative">
        {/* Categories */}
        <div className="relative mb-6">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0 scroll-smooth pr-10" id="categoryScroll">
            {categories.map((cat, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveCategory(cat.name)}
                className={`flex flex-col items-center min-w-[90px] md:min-w-[110px] p-4 rounded-3xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                  activeCategory === cat.name 
                    ? 'bg-primary text-white shadow-xl shadow-primary/30 -translate-y-1' 
                    : 'bg-white text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="text-3xl mb-2">{cat.icon}</div>
                <span className="text-xs md:text-sm font-bold whitespace-nowrap">{cat.name}</span>
              </button>
            ))}
          </div>
          {/* Indicateur de scroll (visible sur mobile uniquement) */}
          <div 
            className="absolute top-0 right-0 h-full w-14 pointer-events-none md:hidden flex items-center justify-end pr-2 bg-gradient-to-l from-neutral-50 to-transparent -mr-6"
          >
            <div className="bg-white/90 backdrop-blur-sm shadow-md rounded-full p-1 animate-bounce-x text-primary border border-gray-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </div>
        </div>



        {/* Restaurants List */}
        <div className="mt-12">
          <div className="flex justify-between items-end mb-8 px-2">
            <div>
              <h2 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">
                {activeCategory === 'Tous' ? 'Autour de vous' : `Top en ${activeCategory}`}
              </h2>
              <p className="text-gray-500 font-medium mt-1">Les meilleures adresses sélectionnées pour vous.</p>
            </div>
            <button className="text-primary text-sm md:text-base font-bold hover:underline bg-primary/10 px-4 py-2 rounded-xl transition-all">Voir tout</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {loading ? (
              <div className="text-center py-10 text-gray-400 font-medium">Chargement des plats...</div>
            ) : filteredPlats.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-bold text-gray-900">Aucun résultat trouvé</h3>
                <p className="text-gray-500 text-sm mt-1">Essayez d'autres mots clés ou une autre catégorie.</p>
                <button 
                  onClick={() => { setSearchQuery(""); setActiveCategory("Tous"); }}
                  className="mt-6 text-primary font-bold hover:underline"
                >
                  Afficher tout
                </button>
              </div>
            ) : filteredPlats.map(plat => (
              <div key={plat.id} className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer group flex flex-col h-full">
                <div className="h-48 relative overflow-hidden">
                  <img src={plat.image_url} alt={plat.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                  {plat.featured && (
                    <div className="absolute top-4 left-4 bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-tighter">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                      Coup de cœur
                    </div>
                  )}
                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[10px] font-black text-secondary shadow-lg">
                    {plat.deliveryTime}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{plat.name}</h3>
                    <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-lg text-xs font-black">
                      <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                      {plat.rating}
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs font-medium mb-4 line-clamp-2 leading-relaxed flex-1">{plat.description}</p>
                  <div className="flex justify-between items-center text-sm font-medium border-t border-gray-100 pt-4">
                    <span className="text-gray-500 font-bold flex items-center gap-1 cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedRestaurant(plat.restaurant_name); setActivePage('restaurant-detail'); }}>
                      <Store className="w-4 h-4 text-gray-300" />
                      {plat.restaurant_name}
                    </span>
                    <span className="text-primary font-black text-xl">{plat.price.toLocaleString()} <span className="text-[10px] uppercase ml-0.5">FCFA</span></span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); addToPanier(plat); }}
                    className="mt-6 w-full bg-secondary hover:bg-gray-800 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-lg flex justify-center items-center gap-2 group/btn"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    {T[lang].ajouter_au_panier}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      </>
      )}

      {/* PAGE PANIER */}
      {activePage === 'panier' && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-48">
          <div className="max-w-2xl mx-auto">
          <button onClick={() => setActivePage('explorer')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            {T[lang].retour}
          </button>
          <h2 className="text-3xl font-black text-gray-900 mb-8">{T[lang].mon_panier}</h2>
          {panier.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-7xl mb-6">🛒</div>
              <h3 className="text-xl font-bold text-gray-700">{T[lang].panier_vide}</h3>
              <p className="text-gray-400 mt-2">{lang === 'fr' ? "Ajoutez des plats depuis l'onglet Explorer" : "Dugal lekk yi ci Explorer"}</p>
              <button onClick={() => setActivePage('explorer')} className="mt-8 bg-primary text-white font-bold px-8 py-4 rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-primary/30">
                {T[lang].explorer_plats}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-10">
                {panier.map(item => (
                  <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                      <p className="text-gray-400 text-sm">{item.restaurant_name}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-primary font-black text-lg">{(item.price * item.qty).toLocaleString()} FCFA</span>
                        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-2 py-1">
                          <button onClick={() => item.qty > 1 ? setPanier(prev => prev.map(p => p.id === item.id ? {...p, qty: p.qty-1} : p)) : removeFromPanier(item.id)} className="w-6 h-6 text-gray-600 font-black text-lg leading-none flex items-center justify-center">-</button>
                          <span className="font-black text-gray-800 w-5 text-center">{item.qty}</span>
                          <button onClick={() => setPanier(prev => prev.map(p => p.id === item.id ? {...p, qty: p.qty+1} : p))} className="w-6 h-6 text-gray-600 font-black text-lg leading-none flex items-center justify-center">+</button>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeFromPanier(item.id)} className="text-red-400 hover:text-red-600 p-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Code Promo */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-4">
                <h4 className="font-bold text-gray-900 mb-3">{T[lang].code_promo}</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Entrez votre code"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    onClick={applyPromoCode}
                    className="bg-secondary text-white font-bold px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors text-sm"
                  >
                    {T[lang].appliquer}
                  </button>
                </div>
                {promoApplied && (
                  <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-bold">
                    <span>✅</span>
                    <span>Code "{promoCode.toUpperCase()}" appliqué : -{promoDiscount.toLocaleString()} FCFA</span>
                  </div>
                )}
              </div>

              {/* Adresse de livraison */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-4">
                <h4 className="font-bold text-gray-900 mb-3">📍 Adresse de livraison</h4>
                <AddressPicker
                  value={deliveryAddressCustom || userAddress}
                  onChange={(v) => setDeliveryAddressCustom(v)}
                  onSelect={(s) => {
                    setDeliveryAddressCustom(s.display);
                    setDeliveryCoords({ lat: s.lat, lng: s.lng });
                    // Recalculate delivery estimate with new coords
                    if (panier.length > 0) {
                      const R = 6371;
                      const rLat = 14.6937; // Default restaurant lat (Dakar)
                      const rLng = -17.4441;
                      const dLat = (s.lat - rLat) * Math.PI / 180;
                      const dLng = (s.lng - rLng) * Math.PI / 180;
                      const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat * Math.PI / 180) * Math.cos(s.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                      const fee = Math.ceil((500 + dist * 200) / 100) * 100;
                      setDeliveryEstimate({
                        distance_km: Math.round(dist * 10) / 10,
                        delivery_fee: fee,
                        estimated_time_min: Math.round(dist * 4 + 10),
                      });
                    }
                  }}
                  userLocation={userLocation}
                />
                {/* Mini map preview */}
                <div className="mt-3">
                  <MiniMapPreview
                    lat={deliveryCoords?.lat || userLocation?.lat || 14.6937}
                    lng={deliveryCoords?.lng || userLocation?.lng || -17.4441}
                    label={deliveryAddressCustom || userAddress || 'Plateau, Dakar'}
                  />
                </div>
                {deliveryEstimate && (
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                      {deliveryEstimate.distance_km} km
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      ~{deliveryEstimate.estimated_time_min} min
                    </span>
                    <span className="flex items-center gap-1 font-bold text-primary">
                      🛵 {deliveryEstimate.delivery_fee.toLocaleString()} FCFA
                    </span>
                  </div>
                )}
              </div>

              {/* Résumé de paiement */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-medium">{T[lang].sous_total}</span>
                  <span className="font-bold">{totalPanier.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-medium">{T[lang].livraison}</span>
                  <span className={`font-bold ${deliveryEstimate?.delivery_fee ? 'text-gray-800' : 'text-green-600'}`}>
                    {deliveryEstimate?.delivery_fee ? `${deliveryEstimate.delivery_fee.toLocaleString()} FCFA` : T[lang].gratuite}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span className="font-medium">Temps estimé: 25-35 min</span>
                </div>
                {promoApplied && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-600 font-medium">Réduction promo</span>
                    <span className="font-bold text-green-600">-{promoDiscount.toLocaleString()} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 mb-6">
                  <span className="text-xl font-black text-gray-900">{T[lang].total}</span>
                  <span className="text-2xl font-black text-primary">{(totalPanier - promoDiscount + (deliveryEstimate?.delivery_fee || 0)).toLocaleString()} FCFA</span>
                </div>

                {/* Choix du moyen de paiement */}
                <div className="mb-4">
                  <p className="text-sm font-bold text-gray-700 mb-3">Moyen de paiement</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod('wave')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 transition-all font-bold text-sm ${paymentMethod === 'wave' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      <img src="/wave-logo.png" className="h-5 object-contain rounded" alt="Wave"/>
                      Wave
                    </button>
                    <button
                      onClick={() => setPaymentMethod('orange_money')}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 transition-all font-bold text-sm ${paymentMethod === 'orange_money' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      <span className="text-lg">🟠</span>
                      Orange Money
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={orderStatus === 'loading'}
                  className="w-full bg-primary hover:bg-orange-600 disabled:opacity-70 text-white font-black py-5 rounded-2xl text-lg transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-3"
                >
                  {orderStatus === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : paymentMethod === 'wave' ? (
                    <img src="https://static.wave.com/images/favicon.png" className="h-6 object-contain rounded" alt="Wave"/>
                  ) : (
                    <span className="text-xl">🟠</span>
                  )}
                  {orderStatus === 'loading' ? 'Finalisation...' : `${T[lang].confirmer} (${(totalPanier - promoDiscount + (deliveryEstimate?.delivery_fee || 0)).toLocaleString()} F)`}
                </button>
              </div>
            </>
          )}
          </div>
        </main>
      )}

      {/* PAGE COMMANDES */}
      {activePage === 'commandes' && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-2xl mx-auto">
          <button onClick={() => setActivePage('explorer')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            {T[lang].retour}
          </button>
          <h2 className="text-3xl font-black text-gray-900 mb-8">{T[lang].mes_commandes}</h2>
          <div className="space-y-4">
            {orders.length > 0 ? orders.map(order => (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">#{order.id}</span>
                    <h4 className="font-bold text-gray-900 text-lg mt-0.5">{order.restaurant_name}</h4>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                    order.status === 'en_route' ? 'bg-blue-50 text-blue-600 animate-pulse' : 
                    order.status === 'livree' ? 'bg-green-50 text-green-600' : 
                    order.status === 'annulee' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {order.status === 'nouvelle' ? 'Attente ⏳' : 
                     order.status === 'preparation' ? 'Cuisine 👨‍🍳' : 
                     order.status === 'prete' ? 'Prête ✅' : 
                     order.status === 'en_route' ? 'En Livraison 🏍️' : 
                     order.status === 'livree' ? 'Livré ✨' : order.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-100 mb-4">
                  <span className="text-gray-400 text-sm">{new Date(order.created_at).toLocaleDateString()}</span>
                  <span className="font-black text-primary">{order.total_amount.toLocaleString()} F</span>
                </div>
                
                <div className="flex gap-2">
                  {order.status === 'en_route' && (
                    <button
                      onClick={() => {
                        setTrackingOrder(order);
                        setCourierLoc(order.courier_lat && order.courier_lng ? { lat: Number(order.courier_lat), lng: Number(order.courier_lng) } : null);
                      }}
                      className="flex-1 bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                      {T[lang].suivre_livreur}
                    </button>
                  )}
                  {order.status === 'livree' && (
                    <>
                    <button
                      onClick={() => reOrder(order)}
                      className="flex-1 bg-secondary hover:bg-gray-800 text-white font-bold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      {T[lang].re_commander}
                    </button>
                    <button
                      onClick={() => { setReviewOrder(order); setReviewStars(5); setReviewText(''); setReviewPhoto(null); }}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      ⭐ {lang === 'fr' ? 'Avis' : 'Xalaat'}
                    </button>
                    </>
                  )}
                </div>

                {/* Photo Review Modal */}
                {reviewOrder?.id === order.id && (
                  <div className="mt-4 bg-yellow-50 rounded-2xl p-5 border border-yellow-200 animate-in slide-in-from-top">
                    <h4 className="font-black text-gray-900 text-sm mb-3">{lang === 'fr' ? 'Laisser un avis' : 'Wax sa xalaat'} ⭐</h4>
                    <div className="flex gap-2 mb-3">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setReviewStars(s)} className={`text-2xl transition-all ${s <= reviewStars ? 'scale-110' : 'opacity-30'}`}>⭐</button>
                      ))}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder={lang === 'fr' ? 'Partagez votre expérience...' : 'Séddal sa expérience...'}
                      className="w-full bg-white rounded-xl p-3 text-sm border border-yellow-200 outline-none focus:ring-2 focus:ring-yellow-400 resize-none h-20"
                    />
                    {/* Photo upload */}
                    <div className="flex items-center gap-3 mt-3">
                      <label className="flex items-center gap-2 bg-white border border-yellow-200 rounded-xl px-4 py-2 cursor-pointer hover:bg-yellow-100 transition-colors">
                        <span className="text-sm">📷</span>
                        <span className="text-xs font-bold text-gray-600">{lang === 'fr' ? 'Ajouter photo' : 'Dugal photo'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setReviewPhoto(ev.target.result);
                            reader.readAsDataURL(file);
                          }
                        }} />
                      </label>
                      {reviewPhoto && <img src={reviewPhoto} className="w-12 h-12 rounded-lg object-cover border-2 border-yellow-300" alt="preview" />}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setReviewOrder(null)} className="flex-1 py-2 bg-gray-100 text-gray-500 font-bold rounded-xl text-xs">{lang === 'fr' ? 'Annuler' : 'Neenal'}</button>
                      <button onClick={async () => {
                        try {
                          const { ratingsAPI } = await import('./api');
                          await ratingsAPI.create({ order_id: order.id, restaurant_id: order.restaurant_id, rating: reviewStars, comment: reviewText });
                        } catch {}
                        setReviewOrder(null);
                        setOrderStatus('added');
                        setTimeout(() => setOrderStatus(null), 2000);
                      }} className="flex-1 py-2 bg-yellow-500 text-white font-bold rounded-xl text-xs hover:bg-yellow-600 transition-colors">
                        {lang === 'fr' ? 'Publier' : 'Yónnee'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <span className="text-5xl block mb-4">🛒</span>
                <p className="text-gray-400 font-bold">{T[lang].aucune_commande}</p>
              </div>
            )}
          </div>
          </div>

          {/* MODAL TRACKING */}
          {trackingOrder && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
               <div className="bg-white w-full max-w-2xl h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-500 flex flex-col">
                  <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                       <h3 className="text-xl font-black text-gray-900">Suivi Commande #{trackingOrder.id}</h3>
                       <p className="text-xs text-green-500 font-bold">En route vers vous 🏁</p>
                    </div>
                    <button onClick={() => setTrackingOrder(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                  
                  <div className="flex-1 bg-gray-100 relative min-h-[300px]">
                     <LiveTrackingMap
                       courierLat={courierLoc?.lat || 14.6937}
                       courierLng={courierLoc?.lng || -17.4441}
                       clientLat={userLocation?.lat || 14.7445}
                       clientLng={userLocation?.lng || -17.5134}
                       restaurantLat={trackingOrder?.restaurant_lat || 14.6928}
                       restaurantLng={trackingOrder?.restaurant_lng || -17.4660}
                     />

                     <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md rounded-3xl p-5 shadow-xl border border-white/50 flex items-center gap-4 z-[500]">
                        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                           <span className="text-2xl">🏍️</span>
                        </div>
                        <div className="flex-1">
                           <p className="text-[10px] font-black text-primary uppercase tracking-widest">Livreur en approche</p>
                           <h4 className="font-black text-gray-900">{trackingOrder?.courier_name || 'Livreur'}</h4>
                           <p className="text-xs text-gray-500 font-medium">
                             {courierLoc?.lat != null && courierLoc?.lng != null ? `Position : ${Number(courierLoc.lat).toFixed(4)}, ${Number(courierLoc.lng).toFixed(4)}` : 'Localisation...'}
                           </p>
                        </div>
                        <button onClick={() => setChatOpen(!chatOpen)} className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
                           <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                        </button>
                        <a href={`tel:${trackingOrder?.courier_phone || '770000000'}`} className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                           <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        </a>
                     </div>

                     {/* CHAT PANEL */}
                     {chatOpen && (
                       <div className="absolute top-16 right-4 bottom-24 w-[85%] max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 z-[600] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                         <div className="p-4 border-b bg-primary text-white flex justify-between items-center rounded-t-3xl">
                           <h4 className="font-black text-sm">{T[lang].chat_livreur} 💬</h4>
                           <button onClick={() => setChatOpen(false)} className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                           </button>
                         </div>
                         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
                           {chatMessages.length === 0 && (
                             <p className="text-gray-400 text-xs text-center py-8">{lang === 'fr' ? 'Envoyez un message au livreur' : 'Yónneel bataaxal livreur bi'}</p>
                           )}
                           {chatMessages.map(msg => (
                             <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                               <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.sender === 'client' ? 'bg-primary text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'}`}>
                                 <p className="font-medium">{msg.text}</p>
                                 <p className={`text-[10px] mt-1 ${msg.sender === 'client' ? 'text-white/60' : 'text-gray-400'}`}>{msg.time}</p>
                               </div>
                             </div>
                           ))}
                         </div>
                         <div className="p-3 border-t bg-white flex gap-2">
                           <input
                             type="text"
                             value={chatInput}
                             onChange={e => setChatInput(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && sendChatMessage(chatInput)}
                             placeholder={lang === 'fr' ? 'Votre message...' : 'Sa bataaxal...'}
                             className="flex-1 bg-neutral-50 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                           />
                           <button
                             onClick={() => sendChatMessage(chatInput)}
                             className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-orange-600 transition-colors"
                           >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                           </button>
                         </div>
                       </div>
                     )}
                  </div>
               </div>
            </div>
          )}
        </main>
      )}

      {/* PAGE PROFIL / AUTH */}
      {activePage === 'profil' && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
          <button onClick={() => setActivePage('explorer')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            {T[lang].retour}
          </button>

          {!user ? (
            <AuthScreen 
              mode={authMode} 
              setMode={setAuthMode} 
              onSuccess={(u, t) => { 
                setUser(u); setToken(t); 
                localStorage.setItem('user', JSON.stringify(u));
                localStorage.setItem('token', t);
                setActivePage('explorer');
              }} 
            />
          ) : (
            <>
            <div className="text-center mb-10">
              <div className="relative inline-block group">
                 <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f97316&color=fff&size=200`} className="w-28 h-28 rounded-[40px] mx-auto border-4 border-white shadow-2xl transition-transform group-hover:scale-105" alt="Profil" />
                 <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-white"></div>
              </div>
              <h2 className="text-3xl font-black text-gray-900 mt-6">{user.name}</h2>
              <p className="text-gray-400 font-medium">{user.phone}</p>
              
              <div className="flex justify-center gap-8 mt-8">
                <div className="bg-white py-4 px-6 rounded-3xl shadow-sm border border-gray-100 flex-1">
                  <p className="text-2xl font-black text-primary">12</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Commandes</p>
                </div>
                <div className="bg-white py-4 px-6 rounded-3xl shadow-sm border border-gray-100 flex-1">
                  <p className="text-2xl font-black text-green-500">4.9</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Note</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-secondary to-slate-800 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-1">Programme Fidélité</p>
                   <h3 className="text-xl font-black">Niveau Or ✨</h3>
                   <div className="flex items-center gap-2 mt-4 mb-2">
                      <span className="text-2xl font-black text-primary">2 450</span>
                      <span className="text-xs text-white/60 font-medium">points disponibles</span>
                   </div>
                   <div className="w-full bg-white/10 h-2 rounded-full mt-4">
                      <div className="bg-primary h-full w-[80%] rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                   </div>
                </div>
                <svg className="absolute -right-10 -bottom-10 w-40 h-40 text-white/5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>

              <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {[
                  { icon:'📍', label: T[lang].mes_adresses, value: lang === 'fr' ? 'Gérer mes adresses' : 'Saytu sama adresses' },
                  { icon:'💰', label: T[lang].portefeuille, value: lang === 'fr' ? 'Solde & transactions' : 'Sold ak transactions' , page:'wallet' },
                  { icon:'🏆', label: T[lang].defis, value: 'Gamification', page:'gamification' },
                  { icon:'🎁', label:'Cartes Cadeau', value:'Offrir ou utiliser', page:'giftcards' },
                  { icon:'📅', label:'Abonnements', value:'Forfaits repas', page:'subscriptions' },
                  { icon:'🍽️', label:'Traiteur', value:'Événements & groupes', page:'catering' },
                  { icon:'🎫', label:'Parrainage', value:'Gagnez 5 000 FCFA' },
                  { icon:'👥', label: lang === 'fr' ? 'Commande Groupée' : 'Commande Mbooloo', value: lang === 'fr' ? 'Commander à plusieurs' : 'Commande ak mbooloo', page:'group-order' },
                  { icon:'🗓️', label: lang === 'fr' ? 'Planning Repas' : 'Planning Lekk', value: lang === 'fr' ? 'Planifiez votre semaine' : 'Planifié sa ayu-bis', page:'meal-plan' },
                  { icon:'🎮', label: T[lang].mini_jeux, value: lang === 'fr' ? 'Roue, Scratch & prix' : 'Roue, Scratch ak prix', page:'jeux' },
                  { icon:'📞', label: T[lang].support, value: lang === 'fr' ? 'Aide & réclamations' : 'Ndimbal & réclamations', page:'support' },
                  { icon:'🔔', label: lang === 'fr' ? 'Notifications' : 'Notifications yi', value: unreadNotifs > 0 ? `${unreadNotifs} non lues` : (lang === 'fr' ? 'À jour' : 'Neex na'), page:'notifications' },
                  { icon:'⚙️', label: lang === 'fr' ? 'Paramètres' : 'Paramètres yi', value: lang === 'fr' ? 'Notifications, Sécurité' : 'Notifications, Kaarange' },
                ].map((item, i) => (
                  <div key={i} onClick={() => item.page && setActivePage(item.page)} className="flex items-center px-6 py-5 hover:bg-neutral-50 cursor-pointer transition-colors">
                    <span className="text-2xl mr-4">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter mb-0.5">{item.label}</p>
                      <p className="font-bold text-gray-800 text-sm whitespace-nowrap">{item.value}</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                  </div>
                ))}
              </div>

              {/* DARK MODE TOGGLE */}
              <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{darkMode ? '🌙' : '☀️'}</span>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{T[lang].mode_sombre}</p>
                    <p className="text-xs text-gray-400">{darkMode ? (lang === 'fr' ? 'Activé' : 'Dafa dox') : (lang === 'fr' ? 'Désactivé' : 'Tëdduwul')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${darkMode ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${darkMode ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              </div>

              {/* LANGUAGE SWITCHER */}
              <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🌍</span>
                  <p className="font-bold text-gray-800 text-sm">{T[lang].langue}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setLang('fr')}
                    className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${lang === 'fr' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    <span className="text-lg">🇫🇷</span> FR
                  </button>
                  <button
                    onClick={() => setLang('wo')}
                    className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${lang === 'wo' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    <span className="text-lg">🇸🇳</span> Wolof
                  </button>
                </div>
              </div>

              {/* SAVED ADDRESSES */}
              <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6">
                <h4 className="font-black text-gray-900 text-lg mb-4">{T[lang].mes_adresses}</h4>
                <div className="space-y-3">
                  {savedAddresses.map(addr => (
                    <div key={addr.id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl">
                      <span className="text-2xl">{addr.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{addr.label}</p>
                        <p className="text-xs text-gray-400 truncate">{addr.address}</p>
                      </div>
                      <button onClick={() => setSavedAddresses(prev => prev.filter(a => a.id !== addr.id))} className="text-red-400 hover:text-red-600 p-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
                {!showAddressForm ? (
                  <button onClick={() => setShowAddressForm(true)} className="w-full mt-4 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold text-sm hover:border-primary hover:text-primary transition-colors">
                    + {T[lang].ajouter_adresse}
                  </button>
                ) : (
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={newAddressLabel}
                      onChange={e => setNewAddressLabel(e.target.value)}
                      placeholder={lang === 'fr' ? 'Nom (ex: Maison, Bureau...)' : 'Tur bi (ex: Kër, Bureau...)'}
                      className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                    />
                    <AddressPicker
                      value=""
                      onChange={() => {}}
                      onSelect={(s) => {
                        if (newAddressLabel.trim()) {
                          const icons = ['🏠', '💼', '🏫', '🏥', '🏪', '📍'];
                          setSavedAddresses(prev => [...prev, {
                            id: Date.now(),
                            label: newAddressLabel.trim(),
                            icon: icons[prev.length % icons.length],
                            address: s.display,
                            lat: s.lat,
                            lng: s.lng,
                          }]);
                          setNewAddressLabel('');
                          setShowAddressForm(false);
                        }
                      }}
                      userLocation={userLocation}
                    />
                    <button onClick={() => { setShowAddressForm(false); setNewAddressLabel(''); }} className="text-gray-400 text-xs font-bold hover:text-gray-600">
                      {lang === 'fr' ? 'Annuler' : 'Neenal'}
                    </button>
                  </div>
                )}
              </div>

              {/* REFERRAL SECTION */}
              <div className="bg-gradient-to-br from-primary/10 to-orange-50 rounded-[32px] border border-primary/20 p-6">
                <h4 className="font-black text-gray-900 text-lg mb-2">{T[lang].parrainage}</h4>
                <p className="text-xs text-gray-500 mb-4">{lang === 'fr' ? 'Partagez votre code et gagnez 5 000 FCFA par filleul !' : 'Séddal sa code te mënël 5 000 FCFA !'}</p>
                <div className="bg-white rounded-2xl p-4 flex items-center justify-between mb-4">
                  <span className="font-black text-xl text-primary tracking-wider">{referralCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(referralCode);
                      setReferralCopied(true);
                      setTimeout(() => setReferralCopied(false), 2000);
                    }}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${referralCopied ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-orange-600'}`}
                  >
                    {referralCopied ? T[lang].code_copie : T[lang].copier_code}
                  </button>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 bg-white rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-primary">3</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{lang === 'fr' ? 'Filleuls' : 'Filleuls yi'}</p>
                  </div>
                  <div className="flex-1 bg-white rounded-2xl p-3 text-center">
                    <p className="text-2xl font-black text-green-500">15 000</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{lang === 'fr' ? 'FCFA gagnés' : 'FCFA mënël'}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  setUser(null); setToken(null);
                  setActivePage('explorer');
                }}
                className="w-full py-5 text-red-500 font-black text-sm uppercase tracking-widest hover:bg-red-50 rounded-3xl transition-colors"
              >
                {T[lang].deconnexion}
              </button>
            </div>
            </>
          )}
          </div>
        </main>
      )}

      {/* PAGE PORTEFEUILLE */}
      {activePage === 'wallet' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <WalletPage user={user} />
          </div>
        </main>
      )}

      {/* PAGE GAMIFICATION */}
      {activePage === 'gamification' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <GamificationPage user={user} />
          </div>
        </main>
      )}

      {/* PAGE CARTES CADEAU */}
      {activePage === 'giftcards' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <GiftCardsPage user={user} />
          </div>
        </main>
      )}

      {/* PAGE ABONNEMENTS */}
      {activePage === 'subscriptions' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <SubscriptionsPage user={user} />
          </div>
        </main>
      )}

      {/* PAGE TRAITEUR */}
      {activePage === 'catering' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <CateringPage user={user} />
          </div>
        </main>
      )}

      {/* PAGE SUPPORT */}
      {activePage === 'support' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <SupportPage user={user} />
          </div>
        </main>
      )}

      {/* PAGE MINI-JEUX */}
      {activePage === 'jeux' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <h2 className="text-3xl font-black text-gray-900 mb-8">{T[lang].mini_jeux}</h2>

            {/* FORTUNE WHEEL */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 mb-6">
              <h3 className="font-black text-gray-900 text-lg mb-4">{T[lang].roue_fortune} 🎡</h3>
              <div className="relative w-64 h-64 mx-auto mb-6">
                {/* Wheel */}
                <div
                  className="w-full h-full rounded-full border-4 border-primary/30 overflow-hidden relative"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: wheelSpinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  }}
                >
                  {['500F', '100F', 'Livr.', '200F', 'Dessert', '50F', '1000F', 'Rien'].map((prize, i) => (
                    <div
                      key={i}
                      className="absolute w-full h-full"
                      style={{ transform: `rotate(${i * 45}deg)` }}
                    >
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-black pt-3 text-center"
                        style={{ color: i % 2 === 0 ? '#f97316' : '#1e293b', width: '60px' }}
                      >
                        {prize}
                      </div>
                    </div>
                  ))}
                  {/* Wheel segments background */}
                  <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -z-10">
                    {[0,1,2,3,4,5,6,7].map(i => {
                      const startAngle = i * 45 * Math.PI / 180;
                      const endAngle = (i + 1) * 45 * Math.PI / 180;
                      const x1 = 100 + 100 * Math.cos(startAngle);
                      const y1 = 100 + 100 * Math.sin(startAngle);
                      const x2 = 100 + 100 * Math.cos(endAngle);
                      const y2 = 100 + 100 * Math.sin(endAngle);
                      return (
                        <path
                          key={i}
                          d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
                          fill={i % 2 === 0 ? '#fff7ed' : '#f1f5f9'}
                          stroke="#e2e8f0"
                          strokeWidth="0.5"
                        />
                      );
                    })}
                  </svg>
                </div>
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                  <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg"></div>
                </div>
              </div>
              <button
                onClick={spinWheel}
                disabled={wheelSpinning}
                className="w-full bg-primary hover:bg-orange-600 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-lg shadow-primary/30"
              >
                {wheelSpinning ? '🎡 ...' : T[lang].tourner}
              </button>
              {wheelResult && (
                <div className={`mt-4 text-center p-4 rounded-2xl font-black text-lg ${wheelResult === 'Rien' ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600 animate-bounce'}`}>
                  {wheelResult === 'Rien' ? (lang === 'fr' ? 'Pas de chance ! Réessayez 😅' : 'Amul chance ! Jéemaat 😅') : `🎉 ${wheelResult}`}
                </div>
              )}
            </div>

            {/* SCRATCH CARD */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 mb-6">
              <h3 className="font-black text-gray-900 text-lg mb-4">{T[lang].carte_gratter} 🎫</h3>
              <div
                onClick={revealScratch}
                className={`relative w-full h-40 rounded-3xl cursor-pointer overflow-hidden transition-all duration-700 ${scratchRevealed ? 'scale-105' : 'hover:scale-[1.02]'}`}
              >
                {!scratchRevealed ? (
                  <div className="w-full h-full bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-4xl block mb-2">🎫</span>
                      <p className="text-white font-black text-sm uppercase tracking-widest">{T[lang].gratter}</p>
                    </div>
                    {/* Scratch texture overlay */}
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)' }}></div>
                  </div>
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${scratchPrize === 'Rien' ? 'bg-gray-100' : 'bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-100'}`}>
                    <div className="text-center animate-in zoom-in duration-500">
                      <span className="text-5xl block mb-2">{scratchPrize === 'Rien' ? '😅' : '🎉'}</span>
                      <p className={`font-black text-2xl ${scratchPrize === 'Rien' ? 'text-gray-400' : 'text-primary'}`}>{scratchPrize}</p>
                    </div>
                  </div>
                )}
              </div>
              {scratchRevealed && (
                <button
                  onClick={() => { setScratchRevealed(false); setScratchPrize(null); }}
                  className="w-full mt-4 py-3 bg-secondary text-white font-bold rounded-2xl text-sm hover:bg-gray-800 transition-colors"
                >
                  {lang === 'fr' ? 'Nouvelle carte' : 'Carte bu bees'}
                </button>
              )}
            </div>

            {/* PRIZE HISTORY */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6">
              <h3 className="font-black text-gray-900 text-lg mb-4">{T[lang].historique_gains} 🏆</h3>
              {prizeHistory.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {prizeHistory.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{p.type === 'roue' ? '🎡' : '🎫'}</span>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{p.prize}</p>
                          <p className="text-[10px] text-gray-400">{p.date}</p>
                        </div>
                      </div>
                      <span className="text-green-500 text-xs font-bold">+1</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">{lang === 'fr' ? 'Aucun gain pour le moment' : 'Amul gain ba leegi'}</p>
              )}
            </div>
          </div>
        </main>
      )}

      {/* PAGE RESTAURANTS */}
      {activePage === 'restaurants' && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-black text-gray-900 mb-6 tracking-tight">{T[lang].restaurants} 🏪</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {Array.from(new Set(plats.map(p => p.restaurant_name))).filter(Boolean).map(restName => {
                 const restPlats = plats.filter(p => p.restaurant_name === restName);
                 const firstPlat = restPlats[0];
                 return (
                   <div key={restName} onClick={() => { setSelectedRestaurant(restName); setActivePage('restaurant-detail'); }} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl transition-all group">
                     <div className="h-40 w-full relative overflow-hidden">
                       <img src={firstPlat?.image_url} alt={restName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                       <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                         <span className="text-white font-black text-xl line-clamp-1">{restName}</span>
                         <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg text-white text-[10px] font-bold">20-30 min</span>
                       </div>
                     </div>
                     <div className="p-4 flex justify-between items-center bg-white">
                       <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-700">⭐ {firstPlat?.rating || '4.5'}</span>
                       <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{restPlats.length} {lang === 'fr' ? 'plats' : 'lekk yi'}</span>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        </main>
      )}

      {/* PAGE RESTAURANT DETAIL */}
      {activePage === 'restaurant-detail' && selectedRestaurant && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setActivePage('explorer')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            {/* Restaurant Header */}
            <div className="bg-gradient-to-br from-secondary to-gray-900 rounded-[32px] p-8 text-white shadow-2xl mb-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80" className="w-full h-full object-cover" alt="" />
              </div>
              <div className="relative z-10">
                <span className="bg-primary/90 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">{lang === 'fr' ? 'Restaurant' : 'Restoraan'}</span>
                <h2 className="text-3xl font-black mt-3">{selectedRestaurant}</h2>
                <div className="flex items-center gap-4 mt-4">
                  <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">⭐ 4.8</span>
                  <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">🕐 20-35 min</span>
                  <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">📍 2.3 km</span>
                </div>
                <p className="text-white/60 text-sm mt-3">{lang === 'fr' ? 'Cuisine sénégalaise authentique, plats faits maison' : 'Lekk bu sénégalais bu dëgg, lekk bu defar ca kër'}</p>
              </div>
            </div>
            {/* Mini Map */}
            <div className="mb-8">
              <MiniMapPreview lat={14.6937} lng={-17.4441} label={selectedRestaurant} />
            </div>
            {/* Info cards */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                <span className="text-2xl">🕐</span>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{lang === 'fr' ? 'Horaires' : 'Waxtu yi'}</p>
                <p className="text-xs font-black text-gray-800">8h - 23h</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                <span className="text-2xl">📞</span>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{lang === 'fr' ? 'Téléphone' : 'Telefon'}</p>
                <p className="text-xs font-black text-gray-800">77 123 45 67</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                <span className="text-2xl">🏍️</span>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{lang === 'fr' ? 'Livraison' : 'Yóbbu'}</p>
                <p className="text-xs font-black text-primary">500 FCFA</p>
              </div>
            </div>
            {/* Menu */}
            <h3 className="text-xl font-black text-gray-900 mb-4">{lang === 'fr' ? 'Menu' : 'Menu bi'} 🍽️</h3>
            <div className="space-y-4">
              {plats.filter(p => p.restaurant_name === selectedRestaurant).map(plat => (
                <div key={plat.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-4 items-center">
                  <img src={plat.image_url} alt={plat.name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 text-sm">{plat.name}</h4>
                    <p className="text-xs text-gray-400 line-clamp-1">{plat.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-primary font-black">{plat.price.toLocaleString()} FCFA</span>
                      <button onClick={() => addToPanier(plat)} className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* PAGE NOTIFICATIONS */}
      {activePage === 'notifications' && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('explorer')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <h2 className="text-3xl font-black text-gray-900 mb-2">{lang === 'fr' ? 'Notifications' : 'Notifications yi'} 🔔</h2>
            {/* Push permission */}
            {'Notification' in window && Notification.permission !== 'granted' && (
              <button
                onClick={async () => {
                  try {
                    const { enableBrowserPush } = await import('./api');
                    await enableBrowserPush();
                    alert('Notifications activées ! 🎉');
                  } catch (e) { alert(e.message); }
                }}
                className="w-full mb-6 py-4 bg-gradient-to-r from-primary to-orange-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-primary/30 hover:shadow-xl transition-all"
              >
                {lang === 'fr' ? '🔔 Activer les notifications push' : '🔔 Dëggal notifications push'}
              </button>
            )}
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-gray-400 font-bold">{notifications.length} notifications</span>
              <button onClick={() => setNotifications(prev => prev.map(n => ({...n, read: true})))} className="text-xs text-primary font-bold hover:underline">
                {lang === 'fr' ? 'Tout marquer lu' : 'Tolaal lu'}
              </button>
            </div>
            <div className="space-y-3">
              {notifications.map(notif => (
                <div key={notif.id} onClick={() => setNotifications(prev => prev.map(n => n.id === notif.id ? {...n, read: true} : n))}
                  className={`bg-white rounded-2xl p-5 shadow-sm border transition-all cursor-pointer ${notif.read ? 'border-gray-100 opacity-70' : 'border-primary/30 shadow-primary/10'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{notif.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-sm">{notif.title}</h4>
                        {!notif.read && <span className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0"></span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{notif.body}</p>
                      <p className="text-[10px] text-gray-300 font-bold mt-2">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* PAGE GROUP ORDER */}
      {activePage === 'group-order' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <h2 className="text-3xl font-black text-gray-900 mb-8">{lang === 'fr' ? 'Commande Groupée' : 'Commande Mbooloo'} 👥</h2>

            {!groupOrderCode ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] p-8 text-white shadow-2xl text-center">
                  <span className="text-5xl block mb-4">👥</span>
                  <h3 className="text-xl font-black mb-2">{lang === 'fr' ? 'Commandez à plusieurs !' : 'Commandez ak mbooloo !'}</h3>
                  <p className="text-white/70 text-sm mb-6">{lang === 'fr' ? 'Partagez un lien, chacun choisit son plat, payez ensemble ou séparément.' : 'Séddal lien bi, ku nekk tànn lekk bum, fey ñépp walla seneen.'}</p>
                  <button
                    onClick={() => {
                      const code = `GRP${Date.now().toString(36).toUpperCase()}`;
                      setGroupOrderCode(code);
                      setGroupParticipants([{ name: user.name, items: [...panier], paid: false }]);
                    }}
                    className="bg-white text-blue-600 font-black py-4 px-8 rounded-2xl text-sm hover:bg-gray-100 transition-all shadow-lg"
                  >
                    {lang === 'fr' ? 'Créer une commande groupée' : 'Sos commande mbooloo'}
                  </button>
                </div>
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6">
                  <h4 className="font-bold text-gray-800 text-sm mb-3">{lang === 'fr' ? 'Comment ça marche ?' : 'Nan la def ?'}</h4>
                  <div className="space-y-3">
                    {[
                      { step: '1', text: lang === 'fr' ? 'Créez une commande groupée' : 'Sos commande mbooloo' },
                      { step: '2', text: lang === 'fr' ? 'Partagez le code avec vos amis' : 'Séddal code bi ak say xarit' },
                      { step: '3', text: lang === 'fr' ? 'Chacun ajoute ses plats' : 'Ku nekk dugal lekk bum' },
                      { step: '4', text: lang === 'fr' ? 'Finalisez et payez' : 'Jeexal te fey' },
                    ].map(s => (
                      <div key={s.step} className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-black">{s.step}</span>
                        <span className="text-sm text-gray-600 font-medium">{s.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Share code */}
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-2">{lang === 'fr' ? 'Code de partage' : 'Code séddal'}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-blue-600 tracking-wider flex-1">{groupOrderCode}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(groupOrderCode); }} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors">
                      {lang === 'fr' ? 'Copier' : 'Copier'}
                    </button>
                  </div>
                </div>
                {/* Participants */}
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6">
                  <h4 className="font-black text-gray-900 text-lg mb-4">{lang === 'fr' ? 'Participants' : 'Participants yi'} ({groupParticipants.length})</h4>
                  <div className="space-y-3">
                    {groupParticipants.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=3b82f6&color=fff`} className="w-10 h-10 rounded-full" alt="" />
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 text-sm">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.items.length} {lang === 'fr' ? 'articles' : 'articles'}</p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${p.paid ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {p.paid ? '✓ Payé' : 'En attente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => { setGroupOrderCode(null); setGroupParticipants([]); }} className="w-full py-4 bg-secondary text-white font-black rounded-2xl text-sm hover:bg-gray-800 transition-colors shadow-lg">
                  {lang === 'fr' ? 'Finaliser la commande' : 'Jeexal commande bi'}
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* PAGE MEAL PLAN */}
      {activePage === 'meal-plan' && user && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-md mx-auto">
            <button onClick={() => setActivePage('profil')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              {T[lang].retour}
            </button>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black text-gray-900">{lang === 'fr' ? 'Planning Repas' : 'Planning Lekk'} 🗓️</h2>
              <button onClick={() => setMealPlanActive(!mealPlanActive)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${mealPlanActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${mealPlanActive ? 'translate-x-7' : 'translate-x-1'}`}></div>
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(mealPlan).map(([day, meals]) => (
                <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-black text-gray-900">{day}</h4>
                    <button onClick={() => setMealPlanDay(day)} className="text-primary text-xs font-bold bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors">
                      + {lang === 'fr' ? 'Ajouter' : 'Dugal'}
                    </button>
                  </div>
                  {meals.length > 0 ? (
                    <div className="space-y-2">
                      {meals.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-neutral-50 rounded-xl">
                          <img src={m.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" loading="lazy" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{m.name}</p>
                            <p className="text-[10px] text-gray-400">{m.price.toLocaleString()} FCFA</p>
                          </div>
                          <button onClick={() => setMealPlan(prev => ({...prev, [day]: prev[day].filter((_, j) => j !== i)}))} className="text-red-400 text-xs">✕</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300 italic">{lang === 'fr' ? 'Aucun repas planifié' : 'Amul lekk bu planifié'}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-primary to-orange-600 rounded-2xl p-5 mt-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{lang === 'fr' ? 'Budget hebdomadaire' : 'Budget ayu-bis'}</span>
                <span className="text-2xl font-black">{Object.values(mealPlan).flat().reduce((acc, m) => acc + m.price, 0).toLocaleString()} FCFA</span>
              </div>
            </div>
          </div>

          {/* Meal selection modal */}
          {mealPlanDay && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setMealPlanDay(null)}>
              <div className="bg-white rounded-t-[40px] w-full max-h-[70vh] overflow-y-auto p-6 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                <h3 className="font-black text-gray-900 text-lg mb-4">{lang === 'fr' ? `Ajouter un repas pour ${mealPlanDay}` : `Dugal lekk ci ${mealPlanDay}`}</h3>
                <div className="space-y-3">
                  {plats.slice(0, 20).map(p => (
                    <div key={p.id} onClick={() => { setMealPlan(prev => ({...prev, [mealPlanDay]: [...prev[mealPlanDay], p]})); setMealPlanDay(null); }}
                      className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl cursor-pointer hover:bg-primary/10 transition-colors">
                      <img src={p.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" loading="lazy" />
                      <div className="flex-1">
                        <p className="font-bold text-sm text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.price.toLocaleString()} FCFA</p>
                      </div>
                      <span className="text-primary font-bold text-xs">+</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* BOTTOM NAV BAR */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.07)] z-50">
        <div className="flex justify-around items-center h-20 max-w-2xl mx-auto px-6">
          {[
            { id:'explorer', label: T[lang].explorer, icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg> },
            { id:'restaurants', label: T[lang].restaurants, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> },
            { id:'panier', label: T[lang].panier, badge: panier.length, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg> },
            { id:'commandes', label: T[lang].commandes, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> },
            { id:'profil', label: T[lang].profil, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              className={`flex flex-col items-center gap-1.5 relative transition-all ${activePage === tab.id ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`p-2 rounded-2xl transition-colors ${activePage === tab.id ? 'bg-primary/10' : 'bg-transparent hover:bg-gray-100'}`}>
                {tab.icon}
              </div>
              {tab.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center">{tab.badge}</span>
              )}
              <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// COMPOSANT AUTH
function AuthScreen({ mode, setMode, onSuccess }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { authAPI } = await import('./api');
      let data;
      if (mode === 'login') {
        data = await authAPI.login(phone, password);
      } else {
        data = await authAPI.register({ phone, password, name, role: 'client' });
      }
      
      if (data.token) {
        onSuccess(data.user, data.token);
      } else {
        setError(data.error || 'Une erreur est survenue');
      }
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="text-center mb-8">
         <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">👤</span>
         </div>
         <h3 className="text-2xl font-black text-gray-900">{mode === 'login' ? 'Bienvenue !' : 'Créer un compte'}</h3>
         <p className="text-gray-400 text-sm font-medium mt-1">{mode === 'login' ? 'Connectez-vous pour commander' : 'Rejoignez la révolution food'}</p>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Nom complet</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Oumy Dia" className="w-full bg-neutral-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" required />
          </div>
        )}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Téléphone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="77 000 00 00" className="w-full bg-neutral-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" required />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-neutral-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" required />
        </div>
        
        <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 mt-4 flex justify-center items-center">
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (mode === 'login' ? 'Se connecter' : "S'inscrire")}
        </button>
      </form>

      <div className="mt-8 text-center">
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-xs font-bold text-gray-400 hover:text-primary transition-colors">
          {mode === 'login' ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </div>
  );
}

// Composants Icones
const Store = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5"></path></svg>
);
const ChevronRight = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
);

// ===== LIVE TRACKING MAP (OpenStreetMap/Leaflet - FREE, no API key) =====
function LiveTrackingMap({ courierLat, courierLng, clientLat, clientLng, restaurantLat, restaurantLng }) {
  const mapRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markersRef = React.useRef({});

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current, { zoomControl: false }).setView([courierLat, courierLng], 14);
      mapInstanceRef.current = map;

      // Dark-styled OpenStreetMap tiles (CartoDB Dark)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // Courier marker (orange pulsing)
      const courierIcon = L.divIcon({
        className: '',
        html: `<div style="width:40px;height:40px;border-radius:50%;background:rgba(249,115,22,0.3);display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite">
          <div style="width:16px;height:16px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      markersRef.current.courier = L.marker([courierLat, courierLng], { icon: courierIcon }).addTo(map).bindPopup('🏍️ Livreur');

      // Restaurant marker
      const restoIcon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;border-radius:10px;background:#1f2937;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.3)"><span style="font-size:18px">🍽️</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([restaurantLat, restaurantLng], { icon: restoIcon }).addTo(map).bindPopup('Restaurant');

      // Client marker (you)
      const clientIcon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;border-radius:10px;background:#10b981;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.3)"><span style="font-size:18px">📍</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([clientLat, clientLng], { icon: clientIcon }).addTo(map).bindPopup('Vous');

      // Draw route line
      const routeLine = L.polyline([
        [restaurantLat, restaurantLng],
        [courierLat, courierLng],
        [clientLat, clientLng],
      ], { color: '#f97316', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(map);

      // Fit bounds to show all markers
      const bounds = L.latLngBounds([
        [courierLat, courierLng],
        [restaurantLat, restaurantLng],
        [clientLat, clientLng],
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });

      // Add pulse animation CSS
      if (!document.getElementById('map-pulse-css')) {
        const style = document.createElement('style');
        style.id = 'map-pulse-css';
        style.textContent = `@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.7}}`;
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

  // Update courier marker position in real-time
  useEffect(() => {
    if (markersRef.current.courier && window.L) {
      markersRef.current.courier.setLatLng([courierLat, courierLng]);
    }
  }, [courierLat, courierLng]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 300, zIndex: 1 }} />;
}

// ===== ADDRESS PICKER WITH AUTOCOMPLETE =====
function AddressPicker({ value, onChange, onSelect, userLocation }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = React.useRef(null);

  const search = async (q) => {
    if (q.length < 3) { setSuggestions([]); return; }
    try {
      const bounds = userLocation
        ? `&viewbox=${userLocation.lng - 0.2},${userLocation.lat - 0.2},${userLocation.lng + 0.2},${userLocation.lat + 0.2}&bounded=1`
        : '';
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=sn&limit=5&addressdetails=1${bounds}`);
      const data = await res.json();
      setSuggestions(data.map(d => ({
        display: d.display_name.split(',').slice(0, 3).join(', '),
        full: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      })));
      setShowSuggestions(true);
    } catch { setSuggestions([]); }
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange && onChange(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  };

  const handleSelect = (s) => {
    setQuery(s.display);
    setShowSuggestions(false);
    onSelect && onSelect(s);
  };

  return (
    <div className="relative">
      <div className="flex items-center bg-neutral-50 rounded-2xl border border-gray-100 overflow-hidden">
        <span className="pl-4 text-lg">📍</span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Entrez votre adresse de livraison..."
          className="flex-1 bg-transparent px-3 py-4 text-sm font-bold outline-none"
        />
        {userLocation && (
          <button onClick={() => {
            setQuery('Ma position actuelle');
            onSelect && onSelect({ display: 'Ma position', lat: userLocation.lat, lng: userLocation.lng });
            setShowSuggestions(false);
          }} className="pr-4 text-primary text-xs font-bold whitespace-nowrap">
            GPS
          </button>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => handleSelect(s)} className="flex items-center px-4 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0">
              <span className="text-lg mr-3">📍</span>
              <span className="text-sm font-medium text-gray-700 line-clamp-1">{s.display}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== MINI MAP PREVIEW (for checkout/order) =====
function MiniMapPreview({ lat, lng, label }) {
  const mapRef = React.useRef(null);

  useEffect(() => {
    if (!lat || !lng) return;

    const loadLeaflet = () => {
      return new Promise((resolve) => {
        if (window.L) return resolve(window.L);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });
    };

    let map;
    loadLeaflet().then(L => {
      map = L.map(mapRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '', maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:30px;height:30px;border-radius:50%;background:rgba(249,115,22,0.3);display:flex;align-items:center;justify-content:center">
          <div style="width:12px;height:12px;border-radius:50%;background:#f97316;border:2px solid white"></div>
        </div>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      L.marker([lat, lng], { icon }).addTo(map);
    });

    return () => { if (map) map.remove(); };
  }, [lat, lng]);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div ref={mapRef} style={{ width: '100%', height: 150 }} />
      {label && <div className="bg-white px-4 py-2"><p className="text-xs font-bold text-gray-600 truncate">📍 {label}</p></div>}
    </div>
  );
}

// ===== WALLET PAGE =====
function WalletPage({ user }) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('wave');
  const [depositRef, setDepositRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const { walletAPI } = await import('./api');
      const b = await walletAPI.getBalance();
      setBalance(b.balance);
      const t = await walletAPI.getTransactions();
      setTransactions(t.data || []);
    } catch(e) { console.error(e); }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) < 100) return alert('Montant minimum 100 FCFA');
    if (!depositRef.trim()) return alert('Indiquez la référence de la transaction reçue par SMS après votre paiement');
    setLoading(true);
    try {
      const { walletAPI } = await import('./api');
      await walletAPI.deposit(parseFloat(depositAmount), depositMethod, depositRef.trim());
      setDepositAmount('');
      setDepositRef('');
      setShowDeposit(false);
      alert('Dépôt enregistré, en attente de vérification. Il sera crédité une fois le paiement confirmé.');
      loadWallet();
    } catch(e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary to-orange-600 rounded-[32px] p-8 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Solde Portefeuille</p>
        <h2 className="text-4xl font-black mt-2">{balance.toLocaleString()} <span className="text-lg">FCFA</span></h2>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowDeposit(!showDeposit)} className="flex-1 bg-white/20 hover:bg-white/30 rounded-2xl py-3 text-sm font-black transition-colors">Recharger</button>
          <button className="flex-1 bg-white/20 hover:bg-white/30 rounded-2xl py-3 text-sm font-black transition-colors">Retirer</button>
        </div>
      </div>

      {showDeposit && (
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">
          <h3 className="font-black text-gray-900 mb-4">Recharger le portefeuille</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1000, 2000, 5000].map(a => (
              <button key={a} onClick={() => setDepositAmount(String(a))} className={`py-3 rounded-2xl text-sm font-bold border-2 transition-colors ${depositAmount === String(a) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 text-gray-600'}`}>
                {a.toLocaleString()}
              </button>
            ))}
          </div>
          <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Montant personnalisé" className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none mb-3" />
          <div className="flex gap-2 mb-4">
            {['wave', 'orange_money'].map(m => (
              <button key={m} onClick={() => setDepositMethod(m)} className={`flex-1 py-3 rounded-2xl text-xs font-bold border-2 transition-colors ${depositMethod === m ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 text-gray-500'}`}>
                {m === 'wave' ? 'Wave' : 'Orange Money'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            Envoyez d'abord le montant via {depositMethod === 'wave' ? 'Wave' : 'Orange Money'}, puis indiquez ci-dessous la référence reçue par SMS pour vérification.
          </p>
          <input type="text" value={depositRef} onChange={e => setDepositRef(e.target.value)} placeholder="Référence de transaction (SMS)" className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none mb-4" />
          <button onClick={handleDeposit} disabled={loading} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? 'Chargement...' : 'Confirmer le dépôt'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 overflow-hidden">
        <h3 className="font-black text-gray-900 px-6 pt-5 pb-3">Transactions récentes</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm px-6 pb-6">Aucune transaction</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((t, i) => (
              <div key={i} className="flex items-center px-6 py-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mr-4 ${t.amount > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <span className="text-lg">{t.type === 'deposit' ? '💰' : t.type === 'cashback' ? '🎁' : t.type === 'payment' ? '🛒' : '💸'}</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800">{t.description}</p>
                  <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={`font-black text-sm ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {t.amount > 0 ? '+' : ''}{parseFloat(t.amount).toLocaleString()} F
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== GAMIFICATION PAGE =====
function GamificationPage({ user }) {
  const [badges, setBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [myChallenges, setMyChallenges] = useState([]);
  const [tab, setTab] = useState('badges');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { gamificationAPI } = await import('./api');
      const [b, mb, c, mc] = await Promise.all([
        gamificationAPI.getBadges().catch(() => []),
        gamificationAPI.getMyBadges().catch(() => []),
        gamificationAPI.getChallenges().catch(() => []),
        gamificationAPI.getMyChallenges().catch(() => []),
      ]);
      setBadges(b); setMyBadges(mb); setChallenges(c); setMyChallenges(mc);
    } catch(e) { console.error(e); }
  };

  const joinChallenge = async (id) => {
    try {
      const { gamificationAPI } = await import('./api');
      await gamificationAPI.joinChallenge(id);
      loadData();
    } catch(e) { alert(e.message); }
  };

  const earnedIds = new Set((myBadges || []).map(b => b.badge_id));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Défis & Badges</h2>
      <div className="flex gap-2">
        {['badges', 'challenges'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors ${tab === t ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-100'}`}>
            {t === 'badges' ? 'Badges' : 'Défis'}
          </button>
        ))}
      </div>

      {tab === 'badges' && (
        <div className="grid grid-cols-3 gap-3">
          {(badges || []).map(b => (
            <div key={b.id} className={`bg-white rounded-3xl p-4 text-center shadow-sm border ${earnedIds.has(b.id) ? 'border-primary' : 'border-gray-100 opacity-50'}`}>
              <span className="text-3xl">{b.icon || '🏅'}</span>
              <p className="text-xs font-black mt-2 text-gray-800">{b.name}</p>
              {earnedIds.has(b.id) && <span className="text-[9px] font-bold text-primary">Obtenu!</span>}
            </div>
          ))}
          {(badges || []).length === 0 && <p className="col-span-3 text-gray-400 text-sm text-center py-8">Aucun badge disponible</p>}
        </div>
      )}

      {tab === 'challenges' && (
        <div className="space-y-3">
          {(challenges || []).map(c => {
            const myC = (myChallenges || []).find(mc => mc.challenge_id === c.id);
            return (
              <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${c.type === 'daily' ? 'bg-blue-100 text-blue-600' : c.type === 'weekly' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                      {c.type}
                    </span>
                    <h4 className="font-black text-gray-900 mt-2">{c.title}</h4>
                    <p className="text-xs text-gray-400 mt-1">{c.description}</p>
                  </div>
                  <span className="text-2xl">{c.reward_type === 'points' ? '🪙' : c.reward_type === 'discount' ? '🏷️' : '🎁'}</span>
                </div>
                {myC ? (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-gray-500">{myC.current_value}/{c.target_value}</span>
                      <span className="font-bold text-primary">{myC.is_completed ? 'Terminé!' : `${Math.round(myC.current_value/c.target_value*100)}%`}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full">
                      <div className={`h-full rounded-full ${myC.is_completed ? 'bg-green-500' : 'bg-primary'}`} style={{width: `${Math.min(100, myC.current_value/c.target_value*100)}%`}}></div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => joinChallenge(c.id)} className="mt-4 w-full bg-primary/10 text-primary font-bold py-3 rounded-2xl text-sm hover:bg-primary/20 transition-colors">
                    Participer
                  </button>
                )}
              </div>
            );
          })}
          {(challenges || []).length === 0 && <p className="text-gray-400 text-sm text-center py-8">Aucun défi actif</p>}
        </div>
      )}
    </div>
  );
}

// ===== GIFT CARDS PAGE =====
function GiftCardsPage({ user }) {
  const [tab, setTab] = useState('send');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [sentCards, setSentCards] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadSent(); }, []);

  const loadSent = async () => {
    try {
      const { giftCardAPI } = await import('./api');
      const data = await giftCardAPI.getSent();
      setSentCards(data || []);
    } catch(e) { console.error(e); }
  };

  const handleSend = async () => {
    if (!amount || !phone) return alert('Remplissez tous les champs');
    setLoading(true);
    try {
      const { giftCardAPI } = await import('./api');
      const result = await giftCardAPI.create({ amount: parseFloat(amount), recipient_phone: phone, message });
      alert(`Carte cadeau envoyée! Code: ${result.gift_card.code}`);
      setAmount(''); setPhone(''); setMessage('');
      loadSent();
    } catch(e) { alert(e.message); }
    setLoading(false);
  };

  const handleRedeem = async () => {
    if (!redeemCode) return;
    setLoading(true);
    try {
      const { giftCardAPI } = await import('./api');
      const result = await giftCardAPI.redeem(redeemCode);
      alert(result.message);
      setRedeemCode('');
    } catch(e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Cartes Cadeau</h2>
      <div className="flex gap-2">
        {['send', 'redeem', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase transition-colors ${tab === t ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-100'}`}>
            {t === 'send' ? 'Offrir' : t === 'redeem' ? 'Utiliser' : 'Historique'}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[2000, 5000, 10000].map(a => (
              <button key={a} onClick={() => setAmount(String(a))} className={`py-3 rounded-2xl text-sm font-bold border-2 ${amount === String(a) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 text-gray-600'}`}>
                {a.toLocaleString()} F
              </button>
            ))}
          </div>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Montant personnalisé" className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone du destinataire" className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Message (optionnel)" rows={2} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none resize-none" />
          <button onClick={handleSend} disabled={loading} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? 'Envoi...' : 'Envoyer la carte cadeau'}
          </button>
        </div>
      )}

      {tab === 'redeem' && (
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100 space-y-4">
          <input type="text" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} placeholder="Entrez le code cadeau" className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none text-center tracking-widest" />
          <button onClick={handleRedeem} disabled={loading} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-500/20 disabled:opacity-50">
            {loading ? 'Vérification...' : 'Utiliser la carte'}
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {sentCards.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Aucune carte envoyée</p>
          ) : sentCards.map((c, i) => (
            <div key={i} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-black text-gray-900">{parseFloat(c.amount).toLocaleString()} FCFA</p>
                  <p className="text-xs text-gray-400 mt-1">Pour: {c.recipient_phone}</p>
                  <p className="text-xs text-gray-400">Code: {c.code}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${c.is_redeemed ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                  {c.is_redeemed ? 'Utilisée' : 'Active'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== SUBSCRIPTIONS PAGE =====
function SubscriptionsPage({ user }) {
  const [plans, setPlans] = useState([]);
  const [mySub, setMySub] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { subscriptionAPI } = await import('./api');
      const [p, s] = await Promise.all([
        subscriptionAPI.getPlans().catch(() => []),
        subscriptionAPI.getMySubscription().catch(() => null),
      ]);
      setPlans(p || []);
      setMySub(s);
    } catch(e) { console.error(e); }
  };

  const subscribe = async (planId) => {
    setLoading(true);
    try {
      const { subscriptionAPI } = await import('./api');
      await subscriptionAPI.subscribe(planId);
      loadData();
    } catch(e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Abonnements Repas</h2>

      {mySub && mySub.status === 'active' && (
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-[28px] p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Abonnement actif</p>
          <h3 className="text-xl font-black mt-1">{mySub.plan_name || 'Forfait'}</h3>
          <p className="text-white/80 text-sm mt-2">Repas restants: <span className="font-black text-white">{mySub.meals_remaining}</span></p>
          <p className="text-white/60 text-xs mt-1">Expire: {new Date(mySub.expires_at).toLocaleDateString('fr-FR')}</p>
        </div>
      )}

      <div className="space-y-4">
        {(plans || []).map(plan => (
          <div key={plan.id} className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-gray-900 text-lg">{plan.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{plan.description}</p>
              </div>
              {plan.discount_percent > 0 && (
                <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold">-{plan.discount_percent}%</span>
              )}
            </div>
            <div className="flex items-end gap-2 mt-4">
              <span className="text-3xl font-black text-primary">{parseFloat(plan.price_per_week).toLocaleString()}</span>
              <span className="text-gray-400 text-sm font-medium mb-1">FCFA/semaine</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{plan.meals_per_week} repas/semaine</p>
            <button onClick={() => subscribe(plan.id)} disabled={loading || (mySub && mySub.status === 'active')} className="w-full mt-4 bg-primary text-white font-black py-3 rounded-2xl disabled:opacity-40">
              {mySub && mySub.status === 'active' ? 'Déjà abonné' : "S'abonner"}
            </button>
          </div>
        ))}
        {plans.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Aucun forfait disponible pour le moment</p>}
      </div>
    </div>
  );
}

// ===== CATERING PAGE =====
function CateringPage({ user }) {
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ restaurant_id: '', event_date: '', guest_count: '', budget: '', notes: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      const { cateringAPI } = await import('./api');
      const data = await cateringAPI.getMyRequests();
      setRequests(data || []);
    } catch(e) { console.error(e); }
  };

  const handleSubmit = async () => {
    if (!form.restaurant_id || !form.event_date || !form.guest_count) return alert('Remplissez les champs obligatoires');
    setLoading(true);
    try {
      const { cateringAPI } = await import('./api');
      await cateringAPI.create({ ...form, restaurant_id: parseInt(form.restaurant_id), guest_count: parseInt(form.guest_count), budget: form.budget ? parseFloat(form.budget) : undefined });
      setShowForm(false);
      setForm({ restaurant_id: '', event_date: '', guest_count: '', budget: '', notes: '' });
      loadRequests();
    } catch(e) { alert(e.message); }
    setLoading(false);
  };

  const statusColors = { pending: 'bg-yellow-100 text-yellow-600', accepted: 'bg-green-100 text-green-600', rejected: 'bg-red-100 text-red-600', completed: 'bg-blue-100 text-blue-600' };
  const statusLabels = { pending: 'En attente', accepted: 'Acceptée', rejected: 'Rejetée', completed: 'Terminée' };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-gray-900">Mode Traiteur</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary text-white px-4 py-2 rounded-2xl text-xs font-bold">
          {showForm ? 'Fermer' : '+ Demande'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100 space-y-3">
          <input type="number" placeholder="ID Restaurant" value={form.restaurant_id} onChange={e => setForm({...form, restaurant_id: e.target.value})} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <input type="datetime-local" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <input type="number" placeholder="Nombre d'invités" value={form.guest_count} onChange={e => setForm({...form, guest_count: e.target.value})} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <input type="number" placeholder="Budget (FCFA)" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none resize-none" />
          <button onClick={handleSubmit} disabled={loading} className="w-full bg-primary text-white font-black py-4 rounded-2xl disabled:opacity-50">
            {loading ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Aucune demande traiteur</p>
        ) : requests.map((r, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-black text-gray-900">{r.restaurant_name || `Restaurant #${r.restaurant_id}`}</h4>
                <p className="text-xs text-gray-400 mt-1">{new Date(r.event_date).toLocaleDateString('fr-FR')} - {r.guest_count} invités</p>
                {r.budget && <p className="text-xs text-gray-500 font-bold">Budget: {parseFloat(r.budget).toLocaleString()} FCFA</p>}
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                {statusLabels[r.status] || r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== SUPPORT PAGE =====
function SupportPage({ user }) {
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [viewTicket, setViewTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [form, setForm] = useState({ subject: '', category: 'general', order_id: '' });
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    try {
      const { supportAPI } = await import('./api');
      const data = await supportAPI.getMyTickets();
      setTickets(data.data || data || []);
    } catch(e) { console.error(e); }
  };

  const handleCreate = async () => {
    if (!form.subject) return alert('Sujet requis');
    setLoading(true);
    try {
      const { supportAPI } = await import('./api');
      await supportAPI.create({ ...form, order_id: form.order_id ? parseInt(form.order_id) : undefined });
      setShowForm(false);
      setForm({ subject: '', category: 'general', order_id: '' });
      loadTickets();
    } catch(e) { alert(e.message); }
    setLoading(false);
  };

  const openTicket = async (ticket) => {
    setViewTicket(ticket);
    try {
      const { supportAPI } = await import('./api');
      const data = await supportAPI.getTicket(ticket.id);
      setTicketMessages(data.messages || []);
    } catch(e) { console.error(e); }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setLoading(true);
    try {
      const { supportAPI } = await import('./api');
      await supportAPI.reply(viewTicket.id, replyText);
      setReplyText('');
      openTicket(viewTicket);
    } catch(e) { alert(e.message); }
    setLoading(false);
  };

  const statusColors = { open: 'bg-blue-100 text-blue-600', in_progress: 'bg-yellow-100 text-yellow-600', resolved: 'bg-green-100 text-green-600', closed: 'bg-gray-100 text-gray-600' };
  const statusLabels = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };
  const catLabels = { order_issue: 'Commande', payment: 'Paiement', delivery: 'Livraison', general: 'Général', refund: 'Remboursement' };

  if (viewTicket) return (
    <div className="space-y-4">
      <button onClick={() => { setViewTicket(null); setTicketMessages([]); }} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
        Retour aux tickets
      </button>
      <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-black text-gray-900">{viewTicket.subject}</h3>
            <p className="text-xs text-gray-400 mt-1">{catLabels[viewTicket.category]} - #{viewTicket.id}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${statusColors[viewTicket.status]}`}>{statusLabels[viewTicket.status]}</span>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {ticketMessages.map((m, i) => (
            <div key={i} className={`rounded-2xl p-4 ${m.is_admin ? 'bg-blue-50 ml-4' : 'bg-neutral-50 mr-4'}`}>
              <p className="text-xs font-bold text-gray-500 mb-1">{m.is_admin ? 'Support' : 'Vous'}</p>
              <p className="text-sm text-gray-800">{m.message}</p>
              <p className="text-[10px] text-gray-400 mt-1">{new Date(m.created_at).toLocaleString('fr-FR')}</p>
            </div>
          ))}
        </div>
        {viewTicket.status !== 'closed' && (
          <div className="flex gap-2 mt-4">
            <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Votre message..." className="flex-1 bg-neutral-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none" onKeyDown={e => e.key === 'Enter' && handleReply()} />
            <button onClick={handleReply} disabled={loading} className="bg-primary text-white px-5 py-3 rounded-2xl font-bold text-sm disabled:opacity-50">Envoyer</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-gray-900">Support</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary text-white px-4 py-2 rounded-2xl text-xs font-bold">
          {showForm ? 'Fermer' : '+ Ticket'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100 space-y-3">
          <input type="text" placeholder="Sujet" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none">
            {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" placeholder="N° commande (optionnel)" value={form.order_id} onChange={e => setForm({...form, order_id: e.target.value})} className="w-full bg-neutral-50 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
          <button onClick={handleCreate} disabled={loading} className="w-full bg-primary text-white font-black py-4 rounded-2xl disabled:opacity-50">
            {loading ? 'Envoi...' : 'Créer le ticket'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl">📞</span>
            <p className="text-gray-400 text-sm mt-4">Aucun ticket de support</p>
            <p className="text-gray-300 text-xs">Créez un ticket si vous avez besoin d'aide</p>
          </div>
        ) : tickets.map((t, i) => (
          <div key={i} onClick={() => openTicket(t)} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:bg-neutral-50 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-black text-gray-900 text-sm">{t.subject}</h4>
                <p className="text-xs text-gray-400 mt-1">{catLabels[t.category]} - {new Date(t.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
