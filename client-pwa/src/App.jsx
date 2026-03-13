import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';

function App() {
  const [activePage, setActivePage] = useState('explorer'); // explorer | panier | commandes | profil
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [plats, setPlats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState(null); // loading | success | error
  const [panier, setPanier] = useState([]);

  const addToPanier = (plat) => {
    setPanier(prev => {
      const exists = prev.find(p => p.id === plat.id);
      if (exists) return prev.map(p => p.id === plat.id ? {...p, qty: p.qty + 1} : p);
      return [...prev, {...plat, qty: 1}];
    });
    setOrderStatus('added');
    setTimeout(() => setOrderStatus(null), 2000);
  };

  const removeFromPanier = (id) => setPanier(prev => prev.filter(p => p.id !== id));

  const handleWaveOrder = () => {
    setOrderStatus('loading');
    // Simuler le paiement Wave
    setTimeout(() => {
      setPanier([]);
      setOrderStatus('success');
      setActivePage('commandes');
      setTimeout(() => setOrderStatus(null), 3000);
    }, 2000);
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
    const apiUrl = 'https://senfood-api-final-2026.loca.lt/api/client/plats';
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
    // 1. Appliquer d'abord la catégorie
    let result = activeCategory === 'Tous' 
      ? plats 
      : plats.filter(p => p.category === activeCategory);

    // 2. Appliquer la recherche (Sémantique si > 2 caractères)
    if (searchQuery.trim().length > 1) {
      const searchResults = fuse.search(searchQuery);
      result = searchResults.map(r => r.item);
    }

    return result;
  }, [plats, activeCategory, searchQuery, fuse]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20 relative">
      
      {/* TOAST / ALERTE COMMANDE */}
      {orderStatus && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-sm flex items-center justify-center transition-all">
          {orderStatus === 'added' && (
            <div className="bg-secondary text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 animate-bounce">
               <span className="text-2xl">🛒</span>
               <span className="font-bold">Ajouté au panier !</span>
            </div>
          )}
          {orderStatus === 'loading' && (
            <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-100">
               <div className="w-5 h-5 rounded-full border-4 border-t-primary border-l-primary border-b-gray-200 border-r-gray-200 animate-spin"></div>
               <img src="/wave-logo.png" className="h-5 object-contain" alt="Wave"/>
               <span className="font-bold text-gray-800">Paiement Wave en cours...</span>
            </div>
          )}
          {orderStatus === 'success' && (
            <div className="bg-green-500 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
               <span className="text-white text-2xl">✅</span>
               <span className="font-bold text-white">Commande confirmée !</span>
            </div>
          )}
        </div>
      )}

      {/* HEADER / HERO */}
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
              <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                <span className="text-sm font-bold">Oumy Dia</span>
                <img src="https://ui-avatars.com/api/?name=Oumy+Dia&background=f97316&color=fff" className="w-8 h-8 rounded-full" alt="User"/>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              </div>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-1 tracking-tight">Que voulez-vous</h1>
            <h1 className="text-3xl md:text-5xl font-extrabold text-primary mb-8 tracking-tight">manger aujourd'hui ?</h1>
          </div>

          {/* Search Bar */}
          <div className="relative glass rounded-2xl flex items-center p-2 max-w-xl group focus-within:ring-4 focus-within:ring-primary/20 transition-all">
            <svg className="w-6 h-6 text-gray-500 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un plat, un restaurant..." 
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
            <button className="bg-primary hover:bg-orange-600 text-white rounded-xl p-3 transition-colors">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Categories */}
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">
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

        {/* Featured / Dark Kitchen Promo */}
        <div className="mt-8 bg-gradient-to-r from-secondary via-slate-800 to-gray-900 rounded-[40px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 w-full md:w-1/2">
            <span className="bg-primary text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-lg shadow-primary/20">Exclusivité Dakar</span>
            <h3 className="text-3xl md:text-5xl font-black mt-4 leading-tight">Dark Kitchens 👻</h3>
            <p className="text-lg text-gray-400 mt-2 mb-8 font-medium">Soutenez les restaurateurs locaux et profitez de saveurs authentiques faites maison.</p>
            <button className="text-base font-bold bg-white text-secondary px-8 py-4 rounded-2xl hover:bg-gray-100 transition-all hover:px-10 shadow-xl">
              Explorer les menus
            </button>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1565299507177-b0ac66763828?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" 
            alt="Promo" 
            className="hidden md:block absolute -right-20 -bottom-20 w-[500px] h-[500px] object-cover rounded-full opacity-60 border-8 border-white/5 transition-transform duration-700 group-hover:scale-110"
          />
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

      {/* PAGE PANIER */}
      {activePage === 'panier' && (
        <main className="max-w-2xl mx-auto px-6 py-8 pb-32">
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

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-medium">Sous-total</span>
                  <span className="font-bold">{totalPanier.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-medium">Livraison</span>
                  <span className="font-bold text-green-600">Gratuite</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 mb-6">
                  <span className="text-xl font-black text-gray-900">Total</span>
                  <span className="text-2xl font-black text-primary">{totalPanier.toLocaleString()} FCFA</span>
                </div>
                <button
                  onClick={handleWaveOrder}
                  disabled={orderStatus === 'loading'}
                  className="w-full bg-primary hover:bg-orange-600 disabled:opacity-70 text-white font-black py-5 rounded-2xl text-lg transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-3"
                >
                  {orderStatus === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <img src="/wave-logo.png" className="h-8 object-contain rounded" alt="Wave"/>
                  )}
                  {orderStatus === 'loading' ? 'Paiement en cours...' : 'Payer avec Wave'}
                </button>
              </div>
            </>
          )}
        </main>
      )}

      {/* PAGE COMMANDES */}
      {activePage === 'commandes' && (
        <main className="max-w-2xl mx-auto px-6 py-8 pb-32">
          <h2 className="text-3xl font-black text-gray-900 mb-8">Mes Commandes 📦</h2>
          <div className="space-y-4">
            {[
              { id:'#1045', name:'Tiep Bou Dien Rouge', status:'En livraison 🏍️', time:'Dans 15 min', amount:'3 000 FCFA', color:'blue' },
              { id:'#1044', name:'Double Cheese Burger', status:'En préparation 👨‍🍳', time:'Il y a 30 min', amount:'5 500 FCFA', color:'orange' },
              { id:'#1043', name:'Yassa Poulet', status:'Livré ✅', time:'Hier', amount:'3 500 FCFA', color:'green' },
            ].map(order => (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{order.id}</span>
                    <h4 className="font-bold text-gray-900 text-lg mt-0.5">{order.name}</h4>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${order.color === 'blue' ? 'bg-blue-50 text-blue-600' : order.color === 'orange' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{order.status}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-gray-400 text-sm">{order.time}</span>
                  <span className="font-black text-primary">{order.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* PAGE PROFIL */}
      {activePage === 'profil' && (
        <main className="max-w-2xl mx-auto px-6 py-8 pb-32">
          <div className="text-center mb-10">
            <img src="https://ui-avatars.com/api/?name=Oumy+Dia&background=f97316&color=fff&size=128" className="w-28 h-28 rounded-full mx-auto border-4 border-primary shadow-xl shadow-primary/20" alt="Profil" />
            <h2 className="text-2xl font-black text-gray-900 mt-4">Oumy Dia</h2>
            <p className="text-gray-400 font-medium">oumy.dia@gmail.com</p>
            <div className="flex justify-center gap-6 mt-4 text-center">
              <div><p className="text-2xl font-black text-primary">12</p><p className="text-xs text-gray-400">Commandes</p></div>
              <div><p className="text-2xl font-black text-green-500">4.9</p><p className="text-xs text-gray-400">Note</p></div>
              <div><p className="text-2xl font-black text-secondary">2</p><p className="text-xs text-gray-400">Favoris</p></div>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {[
              { icon:'📍', label:'Adresse de livraison', value:'Plateau, Dakar' },
              { icon:'📱', label:'Téléphone', value:'+221 77 123 45 67' },
              { icon:'💳', label:'Moyen de paiement', value:'Wave (Par défaut)' },
              { icon:'🛎️', label:'Notifications', value:'Activées' },
            ].map((item, i) => (
              <div key={i} className="flex items-center px-6 py-5 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                <span className="text-2xl mr-4">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                  <p className="font-bold text-gray-800">{item.value}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* BOTTOM NAV BAR */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.07)] z-50">
        <div className="flex justify-around items-center h-20 max-w-2xl mx-auto px-6">
          {[
            { id:'explorer', label:'Explorer', icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg> },
            { id:'panier', label:'Panier', badge: panier.length, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg> },
            { id:'commandes', label:'Commandes', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> },
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

// Composants Icones
const Store = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
);
const ChevronRight = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
);

export default App;
