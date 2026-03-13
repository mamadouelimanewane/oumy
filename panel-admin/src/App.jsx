import React, { useState } from 'react';
import { 
  Users, 
  Store, 
  MapPin, 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  Bell, 
  Search, 
  MoreVertical,
  ChevronRight,
  PieChart,
  Wallet,
  Bike
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex h-screen bg-brand text-slate-300 font-sans overflow-hidden">
      
      {/* SIDEBAR ADMIN */}
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
          
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            <Activity className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Vue Globale</span>
            {activeTab === 'overview' && <div className="ml-auto w-1 h-5 bg-indigo-500 rounded-full"></div>}
          </button>
          
          <button className="w-full flex items-center px-4 py-3 rounded-xl transition-all hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <Store className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Restaurants (24)</span>
          </button>

          <button className="w-full flex items-center px-4 py-3 rounded-xl transition-all hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <Bike className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Livreurs (85)</span>
          </button>
          
          <button className="w-full flex items-center px-4 py-3 rounded-xl transition-all hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <Users className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Clients (1.2k)</span>
          </button>

          <div className="pt-6 pb-2">
            <p className="px-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Finance & Operations</p>
          </div>

          <button className="w-full flex items-center px-4 py-3 rounded-xl transition-all hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <Wallet className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Paiements Live</span>
            <div className="ml-auto bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/20">Up</div>
          </button>
          
          <button className="w-full flex items-center px-4 py-3 rounded-xl transition-all hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <MapPin className="w-5 h-5 mr-3" />
            <span className="font-semibold text-sm">Heatmap Dakar</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700/50">
           <div className="flex items-center px-2 py-2">
              <img src="https://ui-avatars.com/api/?name=Oumy+Dia&background=1e1b4b&color=818cf8" alt="Oumy" className="w-10 h-10 rounded-full border-2 border-indigo-500/50 mr-3" />
              <div>
                <p className="text-sm font-bold text-white">Super Admin</p>
                <p className="text-xs text-green-400 flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span> Sécurisé</p>
              </div>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT ZONE */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="h-20 glass-panel border-b border-slate-700/50 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="relative w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Rechercher une transaction, un livreur, un client..." 
              className="w-full pl-12 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm text-slate-200 placeholder-slate-500 transition-all font-medium"
            />
          </div>

          <div className="flex items-center space-x-6">
             <div className="flex items-center text-xs font-bold text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
               <span className="w-2 h-2 rounded-full bg-wave mr-2"></span> Wave API : <span className="text-white ml-1">Connecté</span>
             </div>
             <div className="flex items-center text-xs font-bold text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
               <span className="w-2 h-2 rounded-full bg-om mr-2"></span> Orange Money : <span className="text-white ml-1">Connecté</span>
             </div>

             <button className="relative p-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 rounded-full border border-slate-700/50 hover:bg-slate-700/50">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-brand"></span>
             </button>
          </div>
        </header>

        {/* CONTENT SCROLL */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          
          {/* Background Ambient Glow */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute top-40 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Tableau de Bord Global</h2>
              <p className="text-slate-400 mt-1 font-medium">Suivi en temps réel de l'activité sur Dakar.</p>
            </div>
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 backdrop-blur-md">
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20">Aujourd'hui</button>
              <button className="px-4 py-2 text-slate-400 hover:text-white text-sm font-bold transition-colors">Cette Semaine</button>
            </div>
          </div>

          {/* METRICS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative z-10">
            <div className="metric-card">
              <div className="flex justify-between items-start w-full mb-4">
                <div>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Chiffre d'Affaires</p>
                  <h3 className="text-2xl font-black text-white">4.2M FCFA</h3>
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <TrendingUp className="text-indigo-400 w-6 h-6" />
                </div>
              </div>
              <div className="w-full flex items-center text-sm font-medium">
                <span className="text-green-400 flex items-center bg-green-400/10 px-2 py-0.5 rounded mr-2">+12.5%</span>
                <span className="text-slate-500">vs hier</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="flex justify-between items-start w-full mb-4">
                <div>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Commandes (Jour)</p>
                  <h3 className="text-2xl font-black text-white">842</h3>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl border border-accent/20">
                  <Activity className="text-accent w-6 h-6" />
                </div>
              </div>
              <div className="w-full flex items-center text-sm font-medium">
                <span className="text-green-400 flex items-center bg-green-400/10 px-2 py-0.5 rounded mr-2">+5.2%</span>
                <span className="text-slate-500">vs hier</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="flex justify-between items-start w-full mb-4">
                <div>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Actifs Live</p>
                  <h3 className="text-2xl font-black text-white">24 / 45</h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <Bike className="text-blue-400 w-6 h-6" />
                </div>
              </div>
              <div className="w-full flex items-center text-sm font-medium">
                <span className="text-slate-400">Restos : 24, Livreurs : 45</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="flex justify-between items-start w-full py-1">
                <div className="w-full">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Répartition Paiements</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center"><span className="w-3 h-3 rounded bg-wave mr-2"></span><span className="font-semibold text-slate-300">Wave</span></div>
                      <span className="font-bold text-white">65%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center"><span className="w-3 h-3 rounded bg-om mr-2"></span><span className="font-semibold text-slate-300">OM</span></div>
                      <span className="font-bold text-white">25%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center"><span className="w-3 h-3 rounded bg-emerald-500 mr-2"></span><span className="font-semibold text-slate-300">Cash</span></div>
                      <span className="font-bold text-white">10%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
            {/* ALERTES ET LOGS */}
            <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-indigo-400" /> Flux des Commandes en Direct
                </h3>
                <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300">Filtrer</button>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                      <th className="px-6 py-4 font-bold">ID / Heure</th>
                      <th className="px-6 py-4 font-bold">Restaurant</th>
                      <th className="px-6 py-4 font-bold">Livreur</th>
                      <th className="px-6 py-4 font-bold">Statut</th>
                      <th className="px-6 py-4 font-bold text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: '#1045', time: 'A l\'instant', resto: 'Chef Ousmane (Dark Kitchen)', livreur: 'En attente...', status: 'Nouvelle', amount: '12 500 FCFA', pay: 'Wave' },
                      { id: '#1044', time: 'Il y a 2 min', resto: 'Sen Burger Dakar', livreur: 'Assigné (Moustapha)', status: 'En préparation', amount: '8 000 FCFA', pay: 'OM' },
                      { id: '#1043', time: 'Il y a 10 min', resto: 'Dibiterie Almadies', livreur: 'En route (Cheikh)', status: 'Livraison', amount: '24 000 FCFA', pay: 'Cash' },
                      { id: '#1042', time: 'Il y a 15 min', resto: 'Chef Ousmane (Dark Kitchen)', livreur: 'Livré (Ahmed)', status: 'Terminée', amount: '15 000 FCFA', pay: 'Wave' },
                      { id: '#1041', time: 'Il y a 22 min', resto: 'Dakar Tacos', livreur: 'Livré (Modou)', status: 'Terminée', amount: '6 500 FCFA', pay: 'Wave' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-white text-sm">{row.id}</p>
                          <p className="text-xs text-slate-500">{row.time}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-300">{row.resto}</p>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-400">{row.livreur}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                            row.status === 'Nouvelle' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            row.status === 'En préparation' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            row.status === 'Livraison' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-green-500/10 text-green-400 border-green-500/20'
                          }`}>
                            {row.status}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-white text-sm">{row.amount}</p>
                          <p className={`text-[10px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded ${row.pay === 'Wave' ? 'bg-wave/10 text-wave' : row.pay === 'OM' ? 'bg-om/10 text-om' : 'bg-slate-700 text-slate-400'}`}>{row.pay}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* QUICK ACTIONS / ALERTS */}
            <div className="glass-panel rounded-2xl p-6">
               <h3 className="text-lg font-bold text-white flex items-center mb-6">
                  <ShieldCheck className="w-5 h-5 mr-2 text-green-400" /> Alertes Système
               </h3>

               <div className="space-y-4">
                 <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-start">
                    <div className="w-8 h-8 rounded-full bg-red-400/10 flex items-center justify-center mr-3 mt-0.5 border border-red-400/20 flex-shrink-0">
                      <span className="w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse"></span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Zone en tension (Ouakam)</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">Trop de commandes pour le nombre de livreurs actifs. Activer le bonus livreur sur cette zone ?</p>
                      <button className="text-xs font-bold text-indigo-400 mt-2 hover:text-indigo-300">Activer Bonus (+15%)</button>
                    </div>
                 </div>

                 <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-start">
                    <div className="w-8 h-8 rounded-full bg-green-400/10 flex items-center justify-center mr-3 mt-0.5 border border-green-400/20 flex-shrink-0">
                       <ShieldCheck className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Synchronisation Wave DB</h4>
                      <p className="text-xs text-slate-400 mt-1">Tous les paiements Wave de la journée ont été réconciliés avec succès.</p>
                    </div>
                 </div>
               </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}

export default App;