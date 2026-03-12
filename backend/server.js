/**
 * 🇸🇳 SenFood Backend API (MVP - SQLite Version)
 * Core router pour les 4 modules: Client PWA, Dashboard Resto, Panel Admin, App Livreur
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importation de la connexion SQLite
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// 🛣️ ROUTES GLOBALES (Healthcheck)
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'SenFood API is running', version: '1.0.0 (SQLite MVP)' });
});

// ==========================================
// 📱 1. APPLICATION CLIENT (PWA)
// ==========================================
// Récupérer les restaurants (avec filtres Dark Kitchen etc.)
app.get('/api/client/restaurants', (req, res) => {
  db.all("SELECT id, name, address, is_active FROM users WHERE role = 'restaurant' AND is_active = 1", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Créer une commande (avec initialisation Wave/Orange Money simulée)
app.post('/api/client/orders', (req, res) => {
  const { client_id, restaurant_id, total_amount, payment_method, delivery_address } = req.body;
  
  const stmt = db.prepare(`
    INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address)
    VALUES (?, ?, 'nouvelle', ?, ?, 'en_attente', ?)
  `);

  stmt.run([client_id, restaurant_id, total_amount, payment_method, delivery_address], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: 'pending', message: `Commande créée. Paiement initié via ${payment_method}`, order_id: this.lastID });
  });
});

// Suivi temps réel d'une commande (GPS Livreur simulé)
app.get('/api/client/orders/:id/track', (req, res) => {
  res.json({ status: 'en_route', livreurCoords: { lat: 14.6928, lng: -17.4467 } });
});

// ==========================================
// 🏪 2. DASHBOARD RESTAURANT
// ==========================================
// Réception des nouvelles commandes (Temps réel)
app.get('/api/restaurant/:id/orders/active', (req, res) => {
  const restaurantId = req.params.id;
  db.all("SELECT * FROM orders WHERE restaurant_id = ? AND status IN ('nouvelle', 'preparation', 'prete')", [restaurantId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Ajout d'un plat au menu
app.post('/api/restaurant/menu', (req, res) => {
  const { restaurant_id, name, description, price, category } = req.body;
  const stmt = db.prepare("INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES (?, ?, ?, ?, ?)");
  stmt.run([restaurant_id, name, description, price, category], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: 'success', message: 'Plat ajouté', menu_id: this.lastID });
  });
});

// Statistiques du restaurant
app.get('/api/restaurant/:id/stats', (req, res) => {
  const restaurantId = req.params.id;
  db.get("SELECT SUM(total_amount) as revenue, COUNT(id) as totalOrders FROM orders WHERE restaurant_id = ? AND status = 'livree'", [restaurantId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ revenue: row.revenue || 0, totalOrders: row.totalOrders || 0 });
  });
});

// ==========================================
// 🔧 UTILS
// ==========================================
// Startup du serveur
app.listen(PORT, () => {
  console.log(`🚀 API SenFood lancée sur http://localhost:${PORT}`);
  console.log('📦 La base de données SQLite est connectée.');
});
