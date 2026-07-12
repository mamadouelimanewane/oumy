import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Default Icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Fix Leaflet Default Icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker() {
  const [position, setPosition] = React.useState(null);
  const map = useMap();

  React.useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, 14);
    });
  }, [map]);

  return position === null ? null : (
    <Marker position={position}>
      <Popup>📍 Vous êtes ici</Popup>
    </Marker>
  );
}

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
    try { const saved = localStorage.getItem('senfood_panier'); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [socket, setSocket] = useState(null);
  const [orders, setOrders] = useState([]);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [courierLoc, setCourierLoc] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // === LIVRAISON STATE ===
  const [userPosition, setUserPosition] = useState(null); // {lat, lng}
  const [deliveryPrice, setDeliveryPrice] = useState(0);
  const [activeLivraison, setActiveLivraison] = useState(null); // null | livraison object
  const [livreurPosition, setLivreurPosition] = useState(null); // position simulée en mouvement
  const [livraisonStep, setLivraisonStep] = useState(0); // 0=prép 1=en route 2=livré
  const [selectedLivreur, setSelectedLivreur] = useState(null); // pour la page admin livreurs
  const livraisonInterval = useRef(null);

  // 5 Livreurs fictifs à Dakar
  const LIVREURS = [
    { id:1, name:"Moussa Diallo", phone:"77 432 10 98", avatar:"https://ui-avatars.com/api/?name=Moussa+Diallo&background=f97316&color=fff&size=100", lat:14.698, lng:-17.468, status:"disponible", courses:8, note:4.9, revenus:12400 },
    { id:2, name:"Ibrahima Fall", phone:"76 543 21 09", avatar:"https://ui-avatars.com/api/?name=Ibrahima+Fall&background=22c55e&color=fff&size=100", lat:14.685, lng:-17.453, status:"en_course", courses:5, note:4.7, revenus:8750 },
    { id:3, name:"Fatou Sarr", phone:"78 654 32 10", avatar:"https://ui-avatars.com/api/?name=Fatou+Sarr&background=8b5cf6&color=fff&size=100", lat:14.710, lng:-17.480, status:"disponible", courses:11, note:5.0, revenus:17600 },
    { id:4, name:"Abdou Ndiaye", phone:"70 765 43 21", avatar:"https://ui-avatars.com/api/?name=Abdou+Ndiaye&background=3b82f6&color=fff&size=100", lat:14.675, lng:-17.445, status:"hors_ligne", courses:0, note:4.8, revenus:0 },
    { id:5, name:"Aminata Diouf", phone:"77 876 54 32", avatar:"https://ui-avatars.com/api/?name=Aminata+Diouf&background=ef4444&color=fff&size=100", lat:14.702, lng:-17.460, status:"disponible", courses:6, note:4.6, revenus:9800 },
  ];

  // Calcul distance GPS (formule Haversine)
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // Calcul prix livraison
  const calcDeliveryPrice = (userLat, userLng, restLat, restLng) => {
    const dist = haversineKm(userLat, userLng, restLat, restLng);
    const dureeMin = (dist / 25) * 60; // 25 km/h vitesse moto
    const base = 500;
    const parKm = Math.round(dist * 200);
    const parMin = Math.round(dureeMin * 30);
    return { total: base + parKm + parMin, dist: dist.toFixed(1), duree: Math.round(dureeMin), base, parKm, parMin };
  };

  // Géolocalisation utilisateur automatique
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setUserPosition({ lat, lng });
          // Calcul prix délivraison par défaut depuis plateau
          const priceData = calcDeliveryPrice(lat, lng, 14.693, -17.473);
          setDeliveryPrice(priceData.total);
        },
        () => {
          // Fallback: Plateau Dakar
          setUserPosition({ lat: 14.693, lng: -17.450 });
          setDeliveryPrice(800);
        }
      );
    }
  }, []);

  // Simulation du mouvement du livreur vers le client
  const startLivraisonSimulation = (livreur, destLat, destLng) => {
    let step = 0;
    const totalSteps = 30;
    const startLat = livreur.lat;
    const startLng = livreur.lng;
    setLivreurPosition({ lat: startLat, lng: startLng });
    setLivraisonStep(1);
    if (livraisonInterval.current) clearInterval(livraisonInterval.current);
    livraisonInterval.current = setInterval(() => {
      step++;
      const progress = step / totalSteps;
      const curLat = startLat + (destLat - startLat) * progress;
      const curLng = startLng + (destLng - startLng) * progress;
      setLivreurPosition({ lat: curLat, lng: curLng });
      if (step >= totalSteps) {
        clearInterval(livraisonInterval.current);
        setLivraisonStep(2);
      }
    }, 2000); // toutes les 2 secondes
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

  // SOCKET.IO
  useEffect(() => {
    if (!token) return;
    import('./api').then(({ createSocketConnection }) => {
       createSocketConnection(token).then(s => {
          setSocket(s);
          s.on('order_status_changed', (data) => {
             setOrderStatus('status_update');
             setTimeout(() => setOrderStatus(null), 3000);
             fetchOrders(); // Rafraîchir
          });
          s.on('courier_location_update', (data) => {
            if (trackingOrder && data.orderId === trackingOrder.id) {
              setCourierLoc({ lat: data.latitude, lng: data.longitude });
            }
          });
       });
    });
    return () => { if (socket) socket.disconnect(); };
  }, [token, trackingOrder]);

  const fetchOrders = async () => {
    try {
      const { clientAPI } = await import('./api');
      const data = await clientAPI.getOrders();
      setOrders(data.items || []);
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
      if (prev.length > 0 && prev[0].restaurant_id !== plat.restaurant_id) {
         if (confirm("Votre panier contient des produits d'un autre restaurant. Voulez-vous vider le panier pour ce nouveau restaurant ?")) {
            return [{...plat, qty: 1}];
         }
         return prev;
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
      const orderData = {
        restaurant_id: panier[0].restaurant_id,
        items: panier.map(p => ({ menu_item_id: p.id, quantity: p.qty })),
        delivery_address: "Plateau, Dakar", // Placeholder, ideally from user profile
        latitude: 14.6937,
        longitude: -17.4441,
        payment_method: paymentMethod,
        promo_code: promoApplied ? promoCode : null
      };

      await clientAPI.createOrder(orderData);
      
      setPanier([]);
      setPromoCode('');
      setPromoDiscount(0);
      setPromoApplied(false);
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

  const RESTAURANTS_DATA = {
    "Alkimia": { lat: 14.743, lng: -17.513, desc: "Restaurant gastronomique, spécialités de la mer aux Almadies" },
    "Le Lagon 1": { lat: 14.667, lng: -17.433, desc: "Fruits de mer avec vue imprenable sur l'océan, Plateau" },
    "Radisson Blu": { lat: 14.693, lng: -17.473, desc: "Restaurant de l'hôtel 5 étoiles, Sea Plaza" },
    "Terrou-Bi": { lat: 14.685, lng: -17.465, desc: "Gastronomie et cadre luxueux sur la Corniche" },
    "KFC Sea Plaza": { lat: 14.693, lng: -17.473, desc: "Le célèbre poulet frit" },
    "Burger King": { lat: 14.693, lng: -17.473, desc: "Burgers grillés à la flamme" },
    "Chez Loutcha": { lat: 14.668, lng: -17.435, desc: "Cuisine généreuse sénégalaise et cap-verdienne" },
    "La Fourchette": { lat: 14.666, lng: -17.432, desc: "Cuisine internationale et fusion au Plateau" },
    "Le Djoloff": { lat: 14.685, lng: -17.471, desc: "Restaurant boutique hôtel à Fann Hock" },
    "Noflaye Beach": { lat: 14.750, lng: -17.520, desc: "Crêperie et grillades en bord de mer, Almadies" },
    "Chef Ousmane (Dark Kitchen)": { lat: 14.710, lng: -17.460, desc: "Saveurs authentiques faites maison" },
    "Sen Burger Dakar": { lat: 14.692, lng: -17.465, desc: "Fast-food de qualité 100% sénégalais" }
  };

  // DONNÉES STATIQUES (50 plats certifiés) - garantit l'affichage même sans serveur
  const STATIC_PLATS = [
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
    { id:1, name:"Le Classique", description:"Steak haché pur bœuf, cheddar, salade, tomate", price:3500, category:"Fast Food", restaurant_name:"Sen Burger Dakar", image_url:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80", rating:"4.7", deliveryTime:"20-30 min", featured:false },
    { id:51, name:"Thiof Braisé", description:"Mérou blanc braisé aux épices douces, frites de patate douce", price:12000, category:"Grillades", restaurant_name:"Le Lagon 1", image_url:"https://images.unsplash.com/photo-1544979144-411a76d4dfba?w=500&q=80", rating:"4.9", deliveryTime:"35-45 min", featured:true },
    { id:52, name:"Filet de Bœuf Rossini", description:"Filet mignon, foie gras, sauce aux truffes", price:25000, category:"Gastronomie", restaurant_name:"Terrou-Bi", image_url:"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80", rating:"5.0", deliveryTime:"40-50 min", featured:true },
    { id:53, name:"Bucket 10 Pièces", description:"10 pièces de poulet frit croustillant, frites familiales", price:15000, category:"Fast Food", restaurant_name:"KFC Sea Plaza", image_url:"https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?w=500&q=80", rating:"4.5", deliveryTime:"20-30 min", featured:false },
    { id:54, name:"Whopper", description:"Le légendaire burger au bœuf grillé à la flamme", price:4500, category:"Fast Food", restaurant_name:"Burger King", image_url:"https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=500&q=80", rating:"4.6", deliveryTime:"15-25 min", featured:true },
    { id:55, name:"Catchupa", description:"Ragoût cap-verdien riche au maïs, haricots, viandes", price:4000, category:"Africain", restaurant_name:"Chez Loutcha", image_url:"https://images.unsplash.com/photo-1602253057119-44d745d9b860?w=500&q=80", rating:"4.8", deliveryTime:"25-35 min", featured:true },
    { id:56, name:"Sushi Boat", description:"Assortiment premium de 24 sushis, makis et sashimis", price:22000, category:"Asiatique", restaurant_name:"La Fourchette", image_url:"https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80", rating:"4.9", deliveryTime:"30-40 min", featured:false },
    { id:57, name:"Brunch Royal", description:"Viennoiseries, saumon fumé, œufs bénédictine, jus frais", price:18000, category:"Brunch", restaurant_name:"Radisson Blu", image_url:"https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&q=80", rating:"4.7", deliveryTime:"30-45 min", featured:false },
    { id:58, name:"Ceviche de Daurade", description:"Daurade fraîche marinée au citron vert et fruit de la passion", price:11000, category:"Gastronomie", restaurant_name:"Alkimia", image_url:"https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80", rating:"4.8", deliveryTime:"25-35 min", featured:false },
    { id:59, name:"Crevettes à la Plancha", description:"Grandes crevettes grillées, riz safrané, sauce à l'ail", price:8000, category:"Grillades", restaurant_name:"Le Djoloff", image_url:"https://images.unsplash.com/photo-1559742811-822873691fc8?w=500&q=80", rating:"4.7", deliveryTime:"25-35 min", featured:false },
    { id:60, name:"Crêpe Complète", description:"Jambon, œuf, fromage, champignons sur galette sarrasin", price:4500, category:"Crêpes", restaurant_name:"Noflaye Beach", image_url:"https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&q=80", rating:"4.6", deliveryTime:"20-30 min", featured:true },
    { id:61, name:"Carpaccio de Saumon", description:"Saumon d'Écosse, huile d'olive vierge, citron et câpres", price:9000, category:"Gastronomie", restaurant_name:"Alkimia", image_url:"https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80", rating:"4.8", deliveryTime:"25-35 min", featured:false },
    { id:62, name:"Langouste Grillée", description:"Demi-langouste rôtie au beurre d'ail, pommes grenailles", price:18000, category:"Gastronomie", restaurant_name:"Alkimia", image_url:"https://images.unsplash.com/photo-1559742811-822873691fc8?w=500&q=80", rating:"4.9", deliveryTime:"35-45 min", featured:true },
    { id:63, name:"Fondant au Chocolat", description:"Cœur coulant chocolat noir, glace vanille de Madagascar", price:5000, category:"Desserts", restaurant_name:"Alkimia", image_url:"https://images.unsplash.com/photo-1511381939415-e440c9c3e981?w=500&q=80", rating:"4.7", deliveryTime:"15-25 min", featured:false },
    { id:64, name:"Plateau de Fruits de Mer", description:"Huîtres, crevettes, bulots et langoustines sur glace", price:22000, category:"Gastronomie", restaurant_name:"Le Lagon 1", image_url:"https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&q=80", rating:"4.9", deliveryTime:"40-50 min", featured:true },
    { id:65, name:"Sole Meunière", description:"Sole fraîche au beurre noisette, persil et citron", price:14000, category:"Gastronomie", restaurant_name:"Le Lagon 1", image_url:"https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80", rating:"4.8", deliveryTime:"35-45 min", featured:false },
    { id:66, name:"Club Sandwich Premium", description:"Poulet rôti, bacon, œuf, crudités, frites maison", price:8500, category:"Fast Food", restaurant_name:"Radisson Blu", image_url:"https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80", rating:"4.5", deliveryTime:"25-35 min", featured:false },
    { id:67, name:"Entrecôte Angus (300g)", description:"Viande d'exception, sauce béarnaise et pommes sautées", price:19500, category:"Grillades", restaurant_name:"Radisson Blu", image_url:"https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=500&q=80", rating:"4.9", deliveryTime:"35-45 min", featured:true },
    { id:68, name:"Magret de Canard au Miel", description:"Magret du sud-ouest, sauce miel et purée de patates douces", price:16000, category:"Gastronomie", restaurant_name:"Terrou-Bi", image_url:"https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?w=500&q=80", rating:"4.8", deliveryTime:"35-45 min", featured:true },
    { id:69, name:"Tiramisu au Café Touba", description:"Le classique italien revisité avec du café sénégalais parfumé", price:4500, category:"Desserts", restaurant_name:"Terrou-Bi", image_url:"https://images.unsplash.com/photo-1571115177098-24de63ef3e18?w=500&q=80", rating:"4.9", deliveryTime:"15-20 min", featured:false },
    { id:70, name:"Menu Zinger Burger", description:"Burger poulet épicé, frites moyennes, boisson", price:4500, category:"Fast Food", restaurant_name:"KFC Sea Plaza", image_url:"https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500&q=80", rating:"4.6", deliveryTime:"20-30 min", featured:true },
    { id:71, name:"Tenders (5 pièces)", description:"Vrais filets de poulet panés et croustillants", price:3500, category:"Fast Food", restaurant_name:"KFC Sea Plaza", image_url:"https://images.unsplash.com/photo-1562967914-01efa7e87832?w=500&q=80", rating:"4.7", deliveryTime:"15-25 min", featured:false },
    { id:72, name:"Menu Long Chicken", description:"Long sandwich au poulet pané, frites, boisson", price:4200, category:"Fast Food", restaurant_name:"Burger King", image_url:"https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=500&q=80", rating:"4.4", deliveryTime:"15-25 min", featured:false },
    { id:73, name:"Onion Rings", description:"Rondelles d'oignons frites et croustillantes", price:1500, category:"Fast Food", restaurant_name:"Burger King", image_url:"https://images.unsplash.com/photo-1639024471210-20512809187f?w=500&q=80", rating:"4.5", deliveryTime:"10-20 min", featured:false },
    { id:74, name:"Thiou aux Crevettes", description:"Sauce tomate riche aux grosses crevettes et riz blanc", price:5500, category:"Sénégalais", restaurant_name:"Chez Loutcha", image_url:"https://images.unsplash.com/photo-1547592180-85f173990554?w=500&q=80", rating:"4.8", deliveryTime:"30-40 min", featured:true },
    { id:75, name:"Poulet Braisé", description:"Poulet entier mariné et grillé, sauce oignon, alloco", price:7000, category:"Africain", restaurant_name:"Chez Loutcha", image_url:"https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&q=80", rating:"4.9", deliveryTime:"35-45 min", featured:false },
    { id:76, name:"Pad Thaï aux Crevettes", description:"Pâtes de riz sautées, tofu, crevettes, cacahuètes", price:6500, category:"Asiatique", restaurant_name:"La Fourchette", image_url:"https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500&q=80", rating:"4.7", deliveryTime:"25-35 min", featured:true },
    { id:77, name:"Ceviche Péruvien", description:"Poisson frais mariné au lait de tigre, patate douce", price:7500, category:"Gastronomie", restaurant_name:"La Fourchette", image_url:"https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80", rating:"4.8", deliveryTime:"20-30 min", featured:false },
    { id:78, name:"Burger Djoloff", description:"Pain brioché, steak haché maison, confit d'oignons", price:6000, category:"Fast Food", restaurant_name:"Le Djoloff", image_url:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80", rating:"4.6", deliveryTime:"25-35 min", featured:true },
    { id:79, name:"Brochettes de Lotte", description:"Lotte marinée aux épices douces, grillée au feu de bois", price:8500, category:"Grillades", restaurant_name:"Le Djoloff", image_url:"https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80", rating:"4.7", deliveryTime:"30-40 min", featured:false },
    { id:80, name:"Gaufre au Nutella", description:"Gaufre tiède croustillante nappée de chocolat noisette", price:2500, category:"Desserts", restaurant_name:"Noflaye Beach", image_url:"https://images.unsplash.com/photo-1562376552-0d160a2f9fc6?w=500&q=80", rating:"4.8", deliveryTime:"15-25 min", featured:true },
    { id:81, name:"Smoothie Mangue-Passion", description:"Fruits frais mixés, rafraîchissant pour l'été", price:2000, category:"Jus Locaux", restaurant_name:"Noflaye Beach", image_url:"https://images.unsplash.com/photo-1622597467836-f3e6707f4b0d?w=500&q=80", rating:"4.9", deliveryTime:"10-15 min", featured:false }
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

  // Moteur de recherche sémantique (Fuse.js) — plats ET restaurants
  const fuse = useMemo(() => new Fuse(plats, {
    keys: [
      { name: 'name',            weight: 0.5 },
      { name: 'restaurant_name', weight: 0.3 },
      { name: 'category',        weight: 0.1 },
      { name: 'description',     weight: 0.1 },
    ],
    threshold: 0.35,
    includeScore: true
  }), [plats]);

  // Résultats live pour le dropdown de suggestions
  const searchResults = useMemo(() => {
    if (searchQuery.trim().length < 2) return { restaurants: [], plats: [], allItems: [] };
    const results = fuse.search(searchQuery);
    const seen = new Set();
    const matchedRestaurants = [];
    const matchedPlats = [];
    results.forEach(({ item }) => {
      if (!seen.has(item.restaurant_name)) {
        seen.add(item.restaurant_name);
        matchedRestaurants.push(item.restaurant_name);
      }
      if (matchedPlats.length < 5) matchedPlats.push(item);
    });
    const allItems = [
      ...matchedRestaurants.slice(0, 4).map(r => ({ type: 'restaurant', label: r })),
      ...matchedPlats.map(p => ({ type: 'plat', label: p.name, plat: p }))
    ];
    return { restaurants: matchedRestaurants.slice(0, 4), plats: matchedPlats, allItems };
  }, [searchQuery, fuse]);

  // Ghost text: complète la saisie avec le premier résultat
  const ghostHint = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return '';
    const first = searchResults.allItems[0];
    if (!first) return '';
    const label = first.label;
    if (label.toLowerCase().startsWith(searchQuery.toLowerCase())) {
      return searchQuery + label.slice(searchQuery.length);
    }
    return '';
  }, [searchQuery, searchResults]);


  const filteredPlats = useMemo(() => {
    let result = activeCategory === 'Tous'
      ? plats
      : plats.filter(p => p.category === activeCategory);
    if (searchQuery.trim().length > 1) {
      const searchRes = fuse.search(searchQuery);
      result = searchRes.map(r => r.item);
    }
    return result;
  }, [plats, activeCategory, searchQuery, fuse]);


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
                 <p className="text-gray-400 text-sm font-medium">Livrer à</p>
                 <div className="flex items-center gap-2 cursor-pointer">
                   <span className="font-bold text-lg md:text-xl">Plateau, Dakar 🇸🇳</span>
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
                  Se connecter
                </button>
              )}
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              </div>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-1 tracking-tight">Que voulez-vous</h1>
            <h1 className="text-3xl md:text-5xl font-extrabold text-primary mb-8 tracking-tight">manger aujourd'hui ?</h1>
          </div>

          {/* Search Bar with Ghost-text Autocomplete */}
          <div className="relative max-w-xl" ref={searchRef}>
            <div className={`glass rounded-2xl flex items-center p-2 group transition-all ${
              searchOpen && searchQuery ? 'ring-4 ring-primary/25 rounded-b-none' : 'focus-within:ring-4 focus-within:ring-primary/20'
            }`}>
              <svg className="w-6 h-6 text-gray-500 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>

              {/* Ghost text layer + real input stacked */}
              <div className="relative flex-1 mx-3 h-8 flex items-center">
                {/* Ghost text (behind the real input) */}
                {ghostHint && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center pointer-events-none select-none font-medium text-base"
                    style={{whiteSpace:'pre'}}
                  >
                    <span className="text-transparent">{searchQuery}</span>
                    <span className="text-gray-400/60">{ghostHint.slice(searchQuery.length)}</span>
                  </span>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); setActiveIndex(-1); }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => { setSearchOpen(false); setActiveIndex(-1); }, 150)}
                  onKeyDown={(e) => {
                    const items = searchResults.allItems;
                    if (e.key === 'Tab' || e.key === 'ArrowRight') {
                      if (ghostHint) { e.preventDefault(); setSearchQuery(ghostHint); setActiveIndex(-1); }
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveIndex(i => Math.min(i + 1, items.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveIndex(i => Math.max(i - 1, -1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const selected = items[activeIndex];
                      if (selected) {
                        if (selected.type === 'restaurant') {
                          setSelectedRestaurant(selected.label); setActivePage('restaurant-detail');
                        } else {
                          addToPanier(selected.plat);
                        }
                        setSearchQuery(''); setSearchOpen(false); setActiveIndex(-1);
                      } else if (ghostHint) {
                        setSearchQuery(ghostHint);
                      }
                    } else if (e.key === 'Escape') {
                      setSearchOpen(false); setActiveIndex(-1); setSearchQuery('');
                    }
                  }}
                  placeholder="Plat, restaurant, cuisine..."
                  className="relative w-full bg-transparent border-none focus:outline-none text-gray-800 placeholder-gray-500 font-medium text-base"
                  autoComplete="off"
                />
              </div>

              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchOpen(false); setActiveIndex(-1); }} className="p-1 text-gray-400 hover:text-gray-600 mr-1 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
              <button className="bg-primary hover:bg-orange-600 text-white rounded-xl p-3 transition-colors flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </button>
            </div>

            {/* Hint pill: Tab to accept */}
            {ghostHint && searchOpen && activeIndex === -1 && (
              <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-[10px] font-black text-gray-400 bg-white/80 border border-gray-200 px-2 py-1 rounded-md tracking-wide">
                  Tab ↵
                </span>
              </div>
            )}

            {/* Dropdown suggestions */}
            {searchOpen && searchQuery.trim().length >= 2 && (searchResults.restaurants.length > 0 || searchResults.plats.length > 0) && (
              <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl rounded-b-2xl shadow-2xl border border-gray-100 border-t-0 z-[200] overflow-hidden max-h-[70vh] overflow-y-auto">

                {/* Section Restaurants */}
                {searchResults.restaurants.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">🏪 Restaurants</span>
                    </div>
                    {searchResults.restaurants.map((restName, idx) => {
                      const rImg = plats.find(p => p.restaurant_name === restName)?.image_url;
                      const isActive = activeIndex === idx;
                      return (
                        <button
                          key={restName}
                          onMouseDown={() => { setSelectedRestaurant(restName); setActivePage('restaurant-detail'); setSearchQuery(''); setSearchOpen(false); }}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group ${
                            isActive ? 'bg-orange-50' : 'hover:bg-orange-50'
                          }`}
                        >
                          <img src={rImg} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">
                              {restName.toLowerCase().startsWith(searchQuery.toLowerCase())
                                ? <><span className="text-primary">{restName.slice(0, searchQuery.length)}</span>{restName.slice(searchQuery.length)}</>
                                : restName
                              }
                            </p>
                            <p className="text-xs text-gray-400">{plats.filter(p => p.restaurant_name === restName).length} plats disponibles</p>
                          </div>
                          <svg className={`w-4 h-4 transition-colors ${isActive ? 'text-primary' : 'text-gray-300 group-hover:text-primary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Divider */}
                {searchResults.restaurants.length > 0 && searchResults.plats.length > 0 && (
                  <div className="mx-4 border-t border-gray-100"></div>
                )}

                {/* Section Plats */}
                {searchResults.plats.length > 0 && (
                  <div className="pb-2">
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">🍽️ Plats</span>
                    </div>
                    {searchResults.plats.map((plat, idx) => {
                      const globalIdx = searchResults.restaurants.length + idx;
                      const isActive = activeIndex === globalIdx;
                      return (
                        <button
                          key={plat.id}
                          onMouseDown={() => { addToPanier(plat); setSearchQuery(''); setSearchOpen(false); }}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group ${
                            isActive ? 'bg-orange-50' : 'hover:bg-orange-50'
                          }`}
                        >
                          <img src={plat.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">
                              {plat.name.toLowerCase().startsWith(searchQuery.toLowerCase())
                                ? <><span className="text-primary">{plat.name.slice(0, searchQuery.length)}</span>{plat.name.slice(searchQuery.length)}</>
                                : plat.name
                              }
                            </p>
                            <p className="text-xs text-gray-400 truncate">{plat.restaurant_name}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-primary font-black text-sm">{plat.price.toLocaleString()} F</span>
                            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">+ Panier</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-gray-100 px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <button onMouseDown={() => { setSearchOpen(false); }} className="text-xs text-primary font-bold hover:underline">
                    Voir tous les résultats pour "{searchQuery}"
                  </button>
                  <span className="text-[10px] text-gray-400 hidden sm:flex items-center gap-2">
                    <kbd className="bg-white border border-gray-200 rounded px-1">↑↓</kbd> naviguer
                    <kbd className="bg-white border border-gray-200 rounded px-1">↵</kbd> valider
                    <kbd className="bg-white border border-gray-200 rounded px-1">Esc</kbd> fermer
                  </span>
                </div>
              </div>
            )}
          </div>
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
        </div>        {/* Restaurants Partenaires - Bande Défilante Auto */}
        <div className="mt-8 mb-12">
          <div className="flex justify-between items-end mb-6 px-2">
            <div>
              <h2 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">Nos Restaurants</h2>
              <p className="text-gray-500 font-medium mt-1">Découvrez nos partenaires</p>
            </div>
            <button onClick={() => setActivePage('restaurants')} className="text-primary text-sm md:text-base font-bold hover:underline bg-primary/10 px-4 py-2 rounded-xl transition-all">Voir tout</button>
          </div>
          {/* Marquee container */}
          <div className="overflow-hidden -mx-6">
            <style>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .marquee-track {
                display: flex;
                animation: marquee 28s linear infinite;
                width: max-content;
              }
              .marquee-track:hover {
                animation-play-state: paused;
              }
            `}</style>
            <div className="marquee-track gap-5" style={{gap:'20px'}}>
              {[...Array.from(new Set(plats.map(p => p.restaurant_name))).filter(Boolean),
                ...Array.from(new Set(plats.map(p => p.restaurant_name))).filter(Boolean)
              ].map((restName, idx) => {
                const restPlats = plats.filter(p => p.restaurant_name === restName);
                const firstPlat = restPlats[0];
                return (
                  <div
                    key={`${restName}-${idx}`}
                    onClick={() => { setSelectedRestaurant(restName); setActivePage('restaurant-detail'); }}
                    className="flex-shrink-0 bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 group"
                    style={{width:'260px', marginRight:'20px'}}
                  >
                    <div className="h-36 w-full relative overflow-hidden">
                      <img src={firstPlat?.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                      <div className="absolute bottom-3 left-4 right-4">
                        <span className="text-white font-black text-base line-clamp-1 drop-shadow">{restName}</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="flex items-center gap-1 text-orange-500 text-xs font-black">⭐ {firstPlat?.rating || '4.5'}</span>
                      <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{restPlats.length} plats</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Plats List */}
        <div className="mt-8">
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
                    <span className="text-gray-500 font-bold flex items-center gap-1">
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
                    Ajouter au panier
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
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-2xl mx-auto">
          <button onClick={() => setActivePage('explorer')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            Retour
          </button>
          <h2 className="text-3xl font-black text-gray-900 mb-8">Mon Panier 🛒</h2>
          {panier.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-7xl mb-6">🛒</div>
              <h3 className="text-xl font-bold text-gray-700">Votre panier est vide</h3>
              <p className="text-gray-400 mt-2">Ajoutez des plats depuis l'onglet Explorer</p>
              <button onClick={() => setActivePage('explorer')} className="mt-8 bg-primary text-white font-bold px-8 py-4 rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-primary/30">
                Explorer les plats
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
                <h4 className="font-bold text-gray-900 mb-3">Code promo</h4>
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
                    Appliquer
                  </button>
                </div>
                {promoApplied && (
                  <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-bold">
                    <span>✅</span>
                    <span>Code "{promoCode.toUpperCase()}" appliqué : -{promoDiscount.toLocaleString()} FCFA</span>
                  </div>
                )}
              </div>

              {/* Résumé de paiement */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-medium">Sous-total</span>
                  <span className="font-bold">{totalPanier.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-medium">Livraison</span>
                  <span className="font-bold text-green-600">Gratuite</span>
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
                  <span className="text-xl font-black text-gray-900">Total</span>
                  <span className="text-2xl font-black text-primary">{(totalPanier - promoDiscount).toLocaleString()} FCFA</span>
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
                  {orderStatus === 'loading' ? 'Finalisation...' : `Confirmer Commande (${(totalPanier - promoDiscount).toLocaleString()} F)`}
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
            Retour
          </button>
          <h2 className="text-3xl font-black text-gray-900 mb-8">Mes Commandes 📦</h2>
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
                        setCourierLoc({ lat: order.courier_lat, lng: order.courier_lng });
                      }}
                      className="flex-1 bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                      Suivre le livreur
                    </button>
                  )}
                  {order.status === 'livree' && (
                    <button
                      className="flex-1 bg-secondary hover:bg-gray-800 text-white font-bold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      Re-commander
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <span className="text-5xl block mb-4">🛒</span>
                <p className="text-gray-400 font-bold">Aucune commande pour le moment</p>
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
                     {/* Google Map Implementation here */}
                     <iframe 
                       width="100%" 
                       height="100%" 
                       style={{ border: 0 }} 
                       loading="lazy" 
                       allowFullScreen 
                       src={`https://www.google.com/maps/embed/v1/place?key=VOTRE_GOOGLE_MAPS_API_KEY&q=${courierLoc?.lat},${courierLoc?.lng}&zoom=15`}
                     ></iframe>
                     
                     <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md rounded-3xl p-5 shadow-xl border border-white/50 flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                           <span className="text-2xl">🏍️</span>
                        </div>
                        <div className="flex-1">
                           <p className="text-[10px] font-black text-primary uppercase tracking-widest">Livreur en approche</p>
                           <h4 className="font-black text-gray-900">Moussa Diop</h4>
                           <p className="text-xs text-gray-500 font-medium">Estimé : 5-8 minutes</p>
                        </div>
                        <a href="tel:770000000" className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                           <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        </a>
                     </div>
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
            Retour
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
                  { icon:'📍', label:'Adresses', value:'Gérer mes adresses' },
                  { icon:'💳', label:'Paiements', value:'Wave par défaut' },
                  { icon:'🎁', label:'Parrainage', value:'Gagnez 5 000 FCFA' },
                  { icon:'⚙️', label:'Paramètres', value:'Notifications, Sécurité' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center px-6 py-5 hover:bg-neutral-50 cursor-pointer transition-colors">
                    <span className="text-2xl mr-4">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter mb-0.5">{item.label}</p>
                      <p className="font-bold text-gray-800 text-sm whitespace-nowrap">{item.value}</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                  </div>
                ))}
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
                Déconnexion
              </button>
            </div>
            </>
          )}
          </div>
        </main>
      )}

      {/* PAGE CARTE (GEOLOCALISATION) */}
      {activePage === 'carte' && (
        <main className="h-screen w-full relative pb-20">
          <div className="absolute top-6 left-6 right-6 z-[400] bg-white/90 backdrop-blur-xl shadow-xl rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
             <div className="bg-primary/10 p-3 rounded-xl text-primary">📍</div>
             <div>
               <h3 className="font-black text-gray-900 leading-tight">Carte des Restaurants</h3>
               <p className="text-xs font-bold text-gray-500">Trouvez les meilleures adresses autour de vous</p>
             </div>
          </div>
          <MapContainer center={[14.693, -17.473]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            />
            <LocationMarker />
            {Object.entries(RESTAURANTS_DATA).map(([name, data]) => (
              <Marker key={name} position={[data.lat, data.lng]}>
                <Popup className="rounded-2xl">
                  <div className="text-center p-1">
                    <h4 className="font-black text-gray-900 text-sm mb-1">{name}</h4>
                    <p className="text-xs text-gray-500 mb-2">{data.desc}</p>
                    <button 
                      onClick={() => { setSelectedRestaurant(name); setActivePage('restaurant-detail'); }}
                      className="bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-lg w-full"
                    >
                      Voir le Menu
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </main>
      )}

      {/* PAGE RESTAURANTS */}
      {activePage === 'restaurants' && (
        <main className="min-h-screen bg-neutral-50 px-6 pt-6 pb-32">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-black text-gray-900 mb-6 tracking-tight">Restaurants 🏪</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {Array.from(new Set(plats.map(p => p.restaurant_name))).filter(Boolean).map(restName => {
                 const restPlats = plats.filter(p => p.restaurant_name === restName);
                 const firstPlat = restPlats[0];
                 return (
                   <div key={restName} onClick={() => { setSelectedRestaurant(restName); setActivePage('restaurant-detail'); }} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl transition-all group">
                     <div className="h-40 w-full relative overflow-hidden">
                       <img src={firstPlat?.image_url} alt={restName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                       <div className="absolute bottom-4 left-4 right-4">
                         <h3 className="text-white font-black text-xl line-clamp-1 m-0">{restName}</h3>
                       </div>
                     </div>
                     <div className="p-4 flex justify-between items-center bg-white">
                       <span className="flex items-center gap-1 bg-orange-50 text-orange-600 px-3 py-1 rounded-xl text-sm font-black">⭐ {firstPlat?.rating || '4.5'}</span>
                       <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">{restPlats.length} plats</span>
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
            <button onClick={() => setActivePage('restaurants')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-6 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              Retour
            </button>
            <div className="bg-gradient-to-br from-secondary to-gray-900 rounded-[32px] p-8 text-white shadow-2xl mb-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80" className="w-full h-full object-cover" alt="" />
              </div>
              <div className="relative z-10">
                <span className="bg-primary/90 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">Restaurant</span>
                <h2 className="text-3xl font-black mt-3">{selectedRestaurant}</h2>
                <div className="flex items-center gap-4 mt-4 mb-6">
                  <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">⭐ 4.8</span>
                  <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">🕐 20-35 min</span>
                </div>
                {RESTAURANTS_DATA[selectedRestaurant] && (
                  <div className="h-40 rounded-2xl overflow-hidden border-4 border-white/10 shadow-inner mt-4 relative z-20">
                    <MapContainer 
                      center={[RESTAURANTS_DATA[selectedRestaurant].lat, RESTAURANTS_DATA[selectedRestaurant].lng]} 
                      zoom={15} 
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                      dragging={false}
                      scrollWheelZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[RESTAURANTS_DATA[selectedRestaurant].lat, RESTAURANTS_DATA[selectedRestaurant].lng]} />
                    </MapContainer>
                  </div>
                )}
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-4">Menu 🍽️</h3>
            <div className="space-y-4">
              {plats.filter(p => p.restaurant_name === selectedRestaurant).map(plat => (
                <div key={plat.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-4 items-center cursor-pointer" onClick={() => addToPanier(plat)}>
                  <img src={plat.image_url} alt={plat.name} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 text-sm">{plat.name}</h4>
                    <p className="text-xs text-gray-400 line-clamp-1">{plat.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-primary font-black">{plat.price.toLocaleString()} FCFA</span>
                      <button className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ============================================================
          PAGE LIVRAISONS
      ============================================================ */}
      {activePage === 'livraisons' && (
        <main className="min-h-screen bg-neutral-50 pb-32">
          {/* Tabs Livraisons */}
          <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
            <div className="max-w-2xl mx-auto px-6 pt-6 pb-0">
              <h2 className="text-2xl font-black text-gray-900 mb-4">Livraisons 🛵</h2>
              <div className="flex gap-4">
                {['suivi', 'livreurs', 'tarifs'].map(t => (
                  <button key={t} onClick={() => setSelectedLivreur(t)}
                    className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
                      selectedLivreur === t ? 'border-primary text-primary' : 'border-transparent text-gray-400'
                    }`}>
                    {t === 'suivi' ? '📍 Suivi' : t === 'livreurs' ? '🛵 Livreurs' : '💰 Tarifs'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* --- ONGLET SUIVI --- */}
          {(selectedLivreur === 'suivi' || !selectedLivreur) && (
            <div className="max-w-2xl mx-auto px-6 pt-6">
              {activeLivraison ? (
                <>
                  {/* Statuts */}
                  <div className="flex items-center justify-between mb-6">
                    {['⏳ Préparation', '🛵 En route', '✅ Livré'].map((s, i) => (
                      <div key={i} className={`flex flex-col items-center gap-1 ${
                        i <= livraisonStep ? 'opacity-100' : 'opacity-30'
                      }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2 ${
                          i < livraisonStep ? 'bg-green-500 border-green-500 text-white' :
                          i === livraisonStep ? 'bg-primary border-primary text-white animate-pulse' :
                          'bg-white border-gray-200'
                        }`}>{i + 1}</div>
                        <span className="text-[9px] font-bold text-center leading-tight max-w-[60px]">{s}</span>
                      </div>
                    ))}
                  </div>
                  {/* Carte de suivi */}
                  <div className="rounded-3xl overflow-hidden shadow-xl mb-6" style={{height: '280px'}}>
                    <MapContainer
                      center={userPosition ? [userPosition.lat, userPosition.lng] : [14.693, -17.473]}
                      zoom={14} style={{height:'100%', width:'100%'}} zoomControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {userPosition && (
                        <Marker position={[userPosition.lat, userPosition.lng]}>
                          <Popup>📍 Votre adresse</Popup>
                        </Marker>
                      )}
                      {livreurPosition && (
                        <Marker position={[livreurPosition.lat, livreurPosition.lng]}>
                          <Popup>🛵 Votre livreur</Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>
                  {/* Fiche livreur */}
                  <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
                    <img src={activeLivraison.livreur.avatar} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                    <div className="flex-1">
                      <p className="font-black text-gray-900">{activeLivraison.livreur.name}</p>
                      <p className="text-xs text-gray-400">⭐ {activeLivraison.livreur.note} · Livreur vérifié</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${
                          livraisonStep === 0 ? 'bg-yellow-100 text-yellow-700' :
                          livraisonStep === 1 ? 'bg-blue-100 text-blue-700 animate-pulse' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {livraisonStep === 0 ? '⏳ Prépare votre commande' :
                           livraisonStep === 1 ? '🛵 En route vers vous' :
                           '✅ Commande livrée !'}
                        </span>
                      </div>
                    </div>
                    <a href={`tel:${activeLivraison.livreur.phone}`}
                      className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    </a>
                  </div>
                  {/* Facture */}
                  <div className="bg-gradient-to-br from-secondary to-slate-800 rounded-3xl p-6 text-white mt-4">
                    <h3 className="font-black text-lg mb-4">Facture de livraison 🧾</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-white/60">Tarif de base</span><span className="font-bold">500 FCFA</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Distance ({activeLivraison.priceData?.dist} km × 200)</span><span className="font-bold">{activeLivraison.priceData?.parKm} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Durée ({activeLivraison.priceData?.duree} min × 30)</span><span className="font-bold">{activeLivraison.priceData?.parMin} FCFA</span></div>
                      <div className="border-t border-white/20 pt-2 flex justify-between text-base">
                        <span className="font-black">Total livraison</span>
                        <span className="font-black text-primary">{activeLivraison.priceData?.total?.toLocaleString()} FCFA</span>
                      </div>
                    </div>
                  </div>
                  {livraisonStep === 2 && (
                    <button onClick={() => { setActiveLivraison(null); setLivraisonStep(0); setLivreurPosition(null); }}
                      className="mt-6 w-full bg-green-500 text-white font-black py-5 rounded-3xl shadow-xl">
                      ✅ Confirmer la réception
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-20">
                  <div className="text-7xl mb-4">🛵</div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">Aucune livraison active</h3>
                  <p className="text-gray-500 text-sm mb-8">Vos livraisons en cours apparaîtront ici</p>
                  <button onClick={() => setActivePage('explorer')} className="bg-primary text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-primary/20">
                    Commander maintenant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* --- ONGLET LIVREURS --- */}
          {selectedLivreur === 'livreurs' && (
            <div className="max-w-2xl mx-auto px-6 pt-6">
              {/* Carte des livreurs */}
              <div className="rounded-3xl overflow-hidden shadow-xl mb-6" style={{height:'220px'}}>
                <MapContainer center={[14.693, -17.465]} zoom={13} style={{height:'100%',width:'100%'}} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {LIVREURS.map(l => (
                    <Marker key={l.id} position={[l.lat, l.lng]}>
                      <Popup>
                        <div className="text-center">
                          <p className="font-black text-sm">{l.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            l.status==='disponible' ? 'bg-green-100 text-green-700' :
                            l.status==='en_course' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {l.status==='disponible'?'🟢 Disponible':l.status==='en_course'?'🟡 En course':'⚫ Hors ligne'}
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              {/* Stats rapides */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-2xl font-black text-green-500">{LIVREURS.filter(l=>l.status==='disponible').length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Dispos</p>
                </div>
                <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-2xl font-black text-yellow-500">{LIVREURS.filter(l=>l.status==='en_course').length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">En course</p>
                </div>
                <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-2xl font-black text-gray-400">{LIVREURS.filter(l=>l.status==='hors_ligne').length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Hors ligne</p>
                </div>
              </div>
              {/* Liste livreurs */}
              <div className="space-y-4">
                {LIVREURS.map(l => (
                  <div key={l.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                      <img src={l.avatar} className="w-14 h-14 rounded-2xl" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-black text-gray-900">{l.name}</p>
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                            l.status==='disponible'?'bg-green-100 text-green-700':
                            l.status==='en_course'?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-500'
                          }`}>
                            {l.status==='disponible'?'🟢 Disponible':l.status==='en_course'?'🟡 En course':'⚫ Hors ligne'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{l.phone}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-bold text-gray-600">⭐ {l.note}</span>
                          <span className="text-xs font-bold text-gray-400">{l.courses} courses</span>
                          <span className="text-xs font-black text-primary">{l.revenus.toLocaleString()} F</span>
                        </div>
                      </div>
                    </div>
                    {l.status === 'disponible' && (
                      <button
                        onClick={() => {
                          const dest = userPosition || { lat: 14.693, lng: -17.450 };
                          const restLat = 14.693, restLng = -17.473;
                          const priceData = calcDeliveryPrice(dest.lat, dest.lng, restLat, restLng);
                          setActiveLivraison({ livreur: l, priceData });
                          startLivraisonSimulation(l, dest.lat, dest.lng);
                          setSelectedLivreur('suivi');
                        }}
                        className="mt-4 w-full bg-primary/10 text-primary font-black text-sm py-3 rounded-2xl hover:bg-primary hover:text-white transition-all">
                        🛵 Assigner une livraison test
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- ONGLET TARIFS --- */}
          {selectedLivreur === 'tarifs' && (
            <div className="max-w-2xl mx-auto px-6 pt-6">
              {/* Formule */}
              <div className="bg-gradient-to-br from-primary to-orange-600 rounded-3xl p-6 text-white mb-6 shadow-xl">
                <h3 className="font-black text-xl mb-2">Formule de calcul</h3>
                <p className="text-white/70 text-sm mb-4">Prix calculé en temps réel selon votre position</p>
                <div className="bg-white/20 rounded-2xl p-4 font-mono text-sm">
                  Prix = Base + (km × 200) + (min × 30)
                </div>
              </div>
              {/* Grille tarifaire */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4">
                <h3 className="font-black text-gray-900 mb-4">Grille tarifaire</h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-left">
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase">Composante</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase text-right">Prix</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr><td className="py-3 text-gray-700 font-medium">Tarif de base</td><td className="py-3 text-right font-black">500 FCFA</td></tr>
                    <tr><td className="py-3 text-gray-700 font-medium">Par kilomètre</td><td className="py-3 text-right font-black">200 FCFA/km</td></tr>
                    <tr><td className="py-3 text-gray-700 font-medium">Par minute</td><td className="py-3 text-right font-black">30 FCFA/min</td></tr>
                    <tr><td className="py-3 text-gray-700 font-medium">Vitesse moto</td><td className="py-3 text-right font-black text-gray-400">25 km/h</td></tr>
                  </tbody>
                </table>
              </div>
              {/* Simulateur */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-black text-gray-900 mb-4">Simulateur de prix</h3>
                {userPosition ? (
                  <div className="space-y-3">
                    {Object.entries(RESTAURANTS_DATA).slice(0, 6).map(([name, data]) => {
                      const pd = calcDeliveryPrice(userPosition.lat, userPosition.lng, data.lat, data.lng);
                      return (
                        <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{name}</p>
                            <p className="text-xs text-gray-400">{pd.dist} km · {pd.duree} min</p>
                          </div>
                          <span className="font-black text-primary">{pd.total.toLocaleString()} FCFA</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Activez la géolocalisation pour voir les estimations</p>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* BOTTOM NAV BAR */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.07)] z-50">
        <div className="flex justify-around items-center h-20 max-w-2xl mx-auto px-6">
          {[
            { id:'explorer', label:'Explorer', icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg> },
            { id:'restaurants', label:'Restau', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> },
            { id:'livraisons', label:'Livraison', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> },
            { id:'panier', label:'Panier', badge: panier.length, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg> },
            { id:'carte', label:'Carte', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg> },
            { id:'profil', label:'Profil', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> },
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

export default App;
