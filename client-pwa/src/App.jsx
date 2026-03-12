import React, { useState, useEffect } from 'react';

function App() {
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [plats, setPlats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState(null); // loading | success | error

  const handleOrder = (restaurantId) => {
    setOrderStatus('loading');
    fetch('https://sen-food-api-2026.loca.lt/api/client/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true'
      },
      body: JSON.stringify({
        client_id: 5, // ID d'Oumy D. défini dans miniseed.js
        restaurant_id: restaurantId,
        total_amount: Math.floor(Math.random() * 5000) + 3000, // prix aléatoire
        payment_method: 'wave',
        delivery_address: 'Almadies, Dakar'
      })
    })
    .then(res => res.json())
    .then(data => {
      setOrderStatus('success');
      // Redescends au bout de 4 sec
      setTimeout(() => setOrderStatus(null), 4000);
    })
    .catch(err => {
      console.error(err);
      setOrderStatus('error');
      setTimeout(() => setOrderStatus(null), 4000);
    });
  };

  // FETCH BDD
  useEffect(() => {
    fetch('https://sen-food-api-2026.loca.lt/api/client/plats', {
      headers: { 'bypass-tunnel-reminder': 'true' }
    })
      .then(res => res.json())
      .then(data => {
        // Formatter un peu les données pour coller au design actuel
        const formatted = data.map(p => ({
          ...p,
          rating: (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1),
          deliveryTime: '20-30 min',
          featured: p.id % 5 === 0 // Un plat sur 5 est mis en avant
        }));
        setPlats(formatted);
        setLoading(false);
      })
      .catch(err => {
         console.error("Erreur Fetch Plats: ", err);
         setLoading(false);
      });
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

  const filteredPlats = activeCategory === 'Tous' 
    ? plats 
    : plats.filter(p => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20 relative">
      
      {/* TOAST / ALERTE COMMANDE */}
      {orderStatus && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-sm flex items-center justify-center animate-bounce">
          {orderStatus === 'loading' && (
            <div className="bg-white px-6 py-4 rounded-full shadow-2xl flex items-center border border-wave/20">
               <div className="w-5 h-5 rounded-full border-4 border-t-wave border-l-wave border-b-gray-200 border-r-gray-200 animate-spin mr-3"></div>
               <span className="font-bold text-gray-800">Passerelle Wave en cours...</span>
            </div>
          )}
          {orderStatus === 'success' && (
            <div className="bg-green-500 px-6 py-4 rounded-full shadow-2xl flex items-center">
               <span className="text-white text-xl mr-2">✅</span>
               <span className="font-bold text-white">Payé et validé !</span>
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
        
        <div className="relative z-10 px-6 pt-12 pb-16 max-w-md mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <p className="text-gray-400 text-sm font-medium">Livrer à</p>
              <div className="flex items-center gap-2 cursor-pointer">
                <span className="font-bold text-lg">Plateau, Dakar 🇸🇳</span>
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold mb-1">Que voulez-vous</h1>
          <h1 className="text-3xl font-extrabold text-primary mb-6">manger aujourd'hui ?</h1>

          {/* Search Bar */}
          <div className="relative glass rounded-2xl flex items-center p-2">
            <svg className="w-6 h-6 text-gray-500 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Rechercher un plat, un restaurant..." 
              className="w-full bg-transparent border-none focus:outline-none text-gray-800 px-3 placeholder-gray-500 font-medium"
            />
            <button className="bg-primary hover:bg-orange-600 text-white rounded-xl p-3 transition-colors">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6">
        {/* Categories */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
          {categories.map((cat, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex flex-col items-center min-w-[80px] p-3 rounded-2xl transition-all ${
                activeCategory === cat.name 
                  ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                  : 'bg-white text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <span className="text-xs font-semibold whitespace-nowrap">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Featured / Dark Kitchen Promo */}
        <div className="mt-6 bg-gradient-to-r from-secondary to-gray-800 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 w-2/3">
            <span className="bg-primary text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">Nouveau</span>
            <h3 className="text-xl font-bold mt-2 leading-tight">Soutenez nos Dark Kitchens 👻</h3>
            <p className="text-sm text-gray-300 mt-1 mb-3">La meilleure cuisine faite maison !</p>
            <button className="text-xs font-bold bg-white text-secondary px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
              Commander
            </button>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1565299507177-b0ac66763828?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" 
            alt="Promo" 
            className="absolute -right-10 -bottom-10 w-48 h-48 object-cover rounded-full opacity-80 border-4 border-white/10"
          />
        </div>

        {/* Restaurants List */}
        <div className="mt-8">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {activeCategory === 'Tous' ? 'Autour de vous' : `Top en ${activeCategory}`}
            </h2>
            <button className="text-primary text-sm font-semibold hover:underline">Voir tout</button>
          </div>

          <div className="flex flex-col gap-5">
            {loading ? (
              <div className="text-center py-10 text-gray-400 font-medium">Chargement des plats...</div>
            ) : filteredPlats.map(plat => (
              <div key={plat.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                <div className="h-40 relative">
                  <img src={plat.image_url} alt={plat.name} className="w-full h-full object-cover" />
                  {plat.featured && (
                    <div className="absolute top-3 left-3 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                      Recommandé
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 bg-white px-2 py-1 rounded-lg text-xs font-bold text-gray-800 shadow-sm">
                    {plat.deliveryTime}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-900 text-lg">{plat.name}</h3>
                    <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-bold">
                      <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                      {plat.rating}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-gray-500">{plat.restaurant_name}</span>
                    <span className="text-primary font-bold text-lg">{plat.price} FCFA</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOrder(plat.restaurant_id); }}
                    disabled={orderStatus === 'loading'}
                    className="mt-4 w-full bg-primary hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-md shadow-primary/30 flex justify-center items-center"
                  >
                     {orderStatus === 'loading' ? 'En cours...' : 'Commander (Wave 🌊)'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* BOTTOM NAV BAR */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <button className="flex flex-col items-center gap-1 text-primary">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
            <span className="text-[10px] font-bold">Explorer</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            <span className="text-[10px] font-bold">Panier</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span className="text-[10px] font-bold">Commandes</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            <span className="text-[10px] font-bold">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
