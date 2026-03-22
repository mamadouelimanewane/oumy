const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'senfood',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Connecté à PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL:', err);
});

const initDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Table Utilisateurs
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        role VARCHAR(20) NOT NULL CHECK(role IN ('client', 'restaurant', 'livreur', 'admin')),
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password VARCHAR(255) NOT NULL,
        address TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Menus / Plats
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT,
        category VARCHAR(50),
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Commandes
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES users(id),
        restaurant_id INTEGER NOT NULL REFERENCES users(id),
        courier_id INTEGER REFERENCES users(id),
        status VARCHAR(20) NOT NULL CHECK(status IN ('nouvelle', 'preparation', 'prete', 'en_route', 'livree', 'annulee')),
        total_amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) CHECK(payment_method IN ('wave', 'orange_money', 'cash')),
        payment_status VARCHAR(20) CHECK(payment_status IN ('en_attente', 'paye', 'echoue')),
        delivery_address TEXT NOT NULL,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Items de commande
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
        quantity INTEGER NOT NULL,
        price_at_time DECIMAL(10,2) NOT NULL
      )
    `);

    // Table Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Positions des livreurs (pour suivi GPS)
    await client.query(`
      CREATE TABLE IF NOT EXISTS courier_locations (
        id SERIAL PRIMARY KEY,
        courier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Notations / Avis
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        restaurant_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER NOT NULL REFERENCES orders(id),
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, order_id)
      )
    `);

    // Table Favoris
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        restaurant_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, restaurant_id)
      )
    `);

    // Table Horaires restaurant
    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_hours (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
        open_time TIME NOT NULL,
        close_time TIME NOT NULL,
        UNIQUE(restaurant_id, day_of_week)
      )
    `);

    // Table Promotions / Codes promo
    await client.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
        discount_value DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2) DEFAULT 0,
        max_uses INTEGER DEFAULT 0,
        current_uses INTEGER DEFAULT 0,
        restaurant_id INTEGER REFERENCES users(id),
        starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Adresses utilisateur
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Messages chat
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Points fidélité
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        points INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL CHECK(type IN ('earned', 'redeemed', 'bonus', 'referral')),
        description TEXT,
        order_id INTEGER REFERENCES orders(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table Parrainages
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_id INTEGER NOT NULL REFERENCES users(id),
        referral_code VARCHAR(20) NOT NULL,
        bonus_given BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(referred_id)
      )
    `);

    // Colonnes additionnelles (migrations sûres avec IF NOT EXISTS)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_balance INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50)`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available_from TIMESTAMP`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available_until TIMESTAMP`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER DEFAULT 15`);

    // Index pour performances
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_locations_courier ON courier_locations(courier_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ratings_restaurant ON ratings(restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_restaurant_hours ON restaurant_hours(restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_addresses ON user_addresses(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages ON chat_messages(order_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loyalty_points ON loyalty_points(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)');

    await client.query('COMMIT');
    console.log('✅ Tables PostgreSQL initialisées avec succès');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur initialisation DB:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDatabase };
