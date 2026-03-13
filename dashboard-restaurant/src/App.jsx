import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('commandes');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Mocked state for new connection simulating real-time arrival
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const [menuItems, setMenuItems] = useState([
    { id: 1, name: 'Burger Classique', price: '4 500 FCFA', category: 'Fast Food', available: true, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80' },
    { id: 2, name: 'Tiep Bou Dien (Poisson)', price: '3 500 FCFA', category: 'Plats Locaux', available: true, image: 'https://images.unsplash.com/photo-1544025162-831e5fcc0bb4?w=300&q=80' },
    { id: 3, name: 'Jus de Bissap (500ml)', price: '1 000 FCFA', category: 'Boissons', available: false, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&q=80' },
  ]);

  useEffect(() => {
    // Simuler l'arrivée d'une commande après 8 secondes pour l'effet Wow
    const timer = setTimeout(() => {
      setNewOrderAlert(true);
      // Jouer un son (idéalement)
      // new Audio('/bip-bip.mp3').play();
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const orders = [
    { id: '#1045', client: 'Oumy D.', time: '12:45', items: '2x Burger Classique, 1x Coca', total: '12 500 FCFA', status: 'nouvelle' },
    { id: '#1044', client: 'Moussa F.', time: '12:30', items: '1x Tiep Viande, 1x Bissap', total: '4 000 FCFA', status: 'preparation' },
    { id: '#1043', client: 'Aïcha S.', time: '12:15', items: '3x Pizza Margherita', total: '24 000 FCFA', status: 'prete' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`w-64 bg-secondary text-white hidden md:flex flex-col transition-all duration-300`}>
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
                {newOrderAlert && <span className="absolute right-4 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>}
                {newOrderAlert && <span className="absolute right-4 w-3 h-3 bg-red-500 rounded-full"></span>}
              </button>
              <button 
                onClick={() => setActiveTab('menu')}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors ${activeTab === 'menu' ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
              >
                <Package className="w-5 h-5 mr-3" />
                <span className="font-medium">Menu & Plats</span>
              </button>
              <button 
                onClick={() => setActiveTab('historique')}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors ${activeTab === 'historique' ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
              >
                <FileText className="w-5 h-5 mr-3" />
                <span className="font-medium">Historique & Gains</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center px-4 py-3">
            <img src="https://ui-avatars.com/api/?name=Dark+Kitchen&background=4F46E5&color=fff" alt="Avatar" className="w-10 h-10 rounded-full mr-3 border-2 border-slate-700" />
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">Ma Dark Kitchen</p>
              <p className="text-xs text-green-400 flex items-center group cursor-pointer"><span className="w-2 h-2 bg-green-500 rounded-full mr-1 group-hover:animate-pulse"></span> Ouvert</p>
            </div>
          </div>
          <button className="w-full flex items-center px-4 py-2 mt-2 text-sm text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center flex-1">
            <button className="md:hidden mr-4 text-slate-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Chercher une commande (ex: #1045)..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg focus-ring text-sm"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <p className="text-sm font-medium text-slate-600 hidden sm:block">Aujourd'hui : <span className="text-indigo-600 font-bold">140 000 FCFA</span></p>
            <button className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors">
              <BellRing className="w-5 h-5" />
              {newOrderAlert && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto p-6 scroll-smooth">
          
          {newOrderAlert && activeTab === 'commandes' && (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-[slideDown_0.3s_ease-out]">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center mr-4">
                  <BellRing className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-indigo-900 font-bold text-lg">Nouvelle commande entrante !</h4>
                  <p className="text-indigo-700 text-sm">Commande #1046 • Paiement Wave (Confirmé) • 18 500 FCFA</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-white text-indigo-600 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors" onClick={() => setNewOrderAlert(false)}>Plus tard</button>
                <button className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-105" onClick={() => setNewOrderAlert(false)}>Accepter & Préparer</button>
              </div>
            </div>
          )}

          {activeTab === 'commandes' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Commandes en cours</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button className="px-4 py-1.5 bg-white shadow-sm rounded-md text-sm font-semibold text-slate-700">Toutes (3)</button>
                  <button className="px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">À préparer (1)</button>
                  <button className="px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">En route (0)</button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Colonne 1: Nouvelles */}
                <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-bold text-slate-700 flex items-center"><BellRing className="w-4 h-4 mr-2" /> Nouvelles</h3>
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">1</span>
                  </div>
                  
                  {orders.filter(o => o.status === 'nouvelle').map(order => (
                    <div key={order.id} className="card p-4 mb-3 cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md border-l-4 border-l-red-500">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-slate-800">{order.id}</span>
                        <span className="text-xs font-medium text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> {order.time}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">{order.client}</p>
                      <p className="text-xs text-slate-500 mb-3">{order.items}</p>
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-sm font-bold text-indigo-600">{order.total}</span>
                        <button className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Accepter</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Colonne 2: En Préparation */}
                <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-bold text-slate-700 flex items-center"><Utensils className="w-4 h-4 mr-2" /> Cuisine</h3>
                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">1</span>
                  </div>

                  {orders.filter(o => o.status === 'preparation').map(order => (
                    <div key={order.id} className="card p-4 mb-3 cursor-pointer hover:border-orange-300 transition-all hover:shadow-md border-l-4 border-l-orange-500">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-slate-800">{order.id}</span>
                        <span className="text-xs font-medium text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> {order.time}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">{order.client}</p>
                      <p className="text-xs text-slate-500 mb-3">{order.items}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
                        <div className="bg-orange-500 h-1.5 rounded-full w-2/3"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">{order.total}</span>
                        <button className="bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Marquer Prête</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Colonne 3: Prêtes au livreur */}
                <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-bold text-slate-700 flex items-center"><Bike className="w-4 h-4 mr-2" /> Attente Livreur</h3>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">1</span>
                  </div>

                  {orders.filter(o => o.status === 'prete').map(order => (
                    <div key={order.id} className="card p-4 mb-3 cursor-pointer hover:border-green-300 transition-all hover:shadow-md border-l-4 border-l-green-500">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-slate-800">{order.id}</span>
                        <span className="text-xs font-medium text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> {order.time}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">{order.client}</p>
                      <p className="text-xs text-slate-500 mb-3">{order.items}</p>
                      
                      <div className="bg-green-50 text-green-700 p-2 rounded-lg flex items-center text-xs font-medium mb-3">
                        <Bike className="w-4 h-4 mr-2"/> Livreur (Ahmed) à 2 min
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">{order.total}</span>
                        <button className="flex items-center text-green-600 bg-green-50 px-3 py-1.5 rounded text-xs font-bold cursor-default">
                          <CheckCircle2 className="w-4 h-4 mr-1"/> Prête
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </>
          )}

          {activeTab === 'menu' && (
            <div className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Menu & Plats</h2>
                  <p className="text-sm text-slate-500">Gérez votre carte et la disponibilité de vos plats en temps réel.</p>
                </div>
                <button className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md">
                  <Plus className="w-5 h-5 mr-2" />
                  Nouveau Plat
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover mr-4 shadow-sm" />
                          <span className="font-bold text-slate-800">{item.name}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-500">{item.category}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-700">{item.price}</td>
                        <td className="px-6 py-4">
                          <button 
                             onClick={() => {
                               const nvMenu = [...menuItems];
                               const idx = nvMenu.findIndex(m => m.id === item.id);
                               nvMenu[idx].available = !nvMenu[idx].available;
                               setMenuItems(nvMenu);
                             }}
                             className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${item.available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                          >
                            {item.available ? 'En Stock' : 'Épuisé'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-slate-400 hover:text-indigo-600 p-2 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button className="text-slate-400 hover:text-red-600 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab !== 'commandes' && activeTab !== 'menu' && (
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

export default App;
