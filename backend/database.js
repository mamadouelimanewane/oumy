const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin de la base de données (fichier local SQLite)
const dbPath = path.resolve(__dirname, 'senfood.db');

// Connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données SQLite:', err.message);
  } else {
    console.log('✅ Connecté avec succès à la base de données SQLite (MVP).');
    initDatabase();
  }
});

// Création des tables nécessaires pour le MVP
function initDatabase() {
  db.serialize(() => {
    // 1. Table Utilisateurs (Clients, Restaurants, Livreurs, Admin)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL CHECK(role IN ('client', 'restaurant', 'livreur', 'admin')),
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        address TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Table Menus / Plats (Pour les restaurants et Dark Kitchens)
    db.run(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_url TEXT,
        category TEXT,
        is_available INTEGER DEFAULT 1,
        FOREIGN KEY (restaurant_id) REFERENCES users (id)
      )
    `);

    // 3. Table des Commandes
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        restaurant_id INTEGER NOT NULL,
        courier_id INTEGER,
        status TEXT NOT NULL CHECK(status IN ('nouvelle', 'preparation', 'prete', 'en_route', 'livree', 'annulee')),
        total_amount REAL NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('wave', 'orange_money', 'cash')),
        payment_status TEXT CHECK(payment_status IN ('en_attente', 'paye', 'echoue')),
        delivery_address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users (id),
        FOREIGN KEY (restaurant_id) REFERENCES users (id),
        FOREIGN KEY (courier_id) REFERENCES users (id)
      )
    `);

    console.log('✅ Tables SQLite initialisées avec succès.');
  });
}

module.exports = db;
