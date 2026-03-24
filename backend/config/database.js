/**
 * 🗄️ SenFood Database Adapter
 * Auto-detecte PostgreSQL (DB_HOST set) ou bascule sur SQLite (better-sqlite3)
 * Interface unifiee: pool.query(sql, params) - $1,$2 auto-converti pour SQLite
 */

require('dotenv').config();

const CONNECTION_STRING = process.env.DATABASE_POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_SUPABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
const USE_POSTGRES = process.env.DB_TYPE === 'postgres' || process.env.DB_HOST || CONNECTION_STRING;

let pool;
let initDatabase;

if (USE_POSTGRES) {
  // Désactive la vérification stricte du certificat SSL pour Supabase/Vercel
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // ===== MODE POSTGRESQL (Production/Supabase/Vercel) =====
  const { Pool } = require('pg');
  
  if (CONNECTION_STRING) {
    // Connexion via URI complète (Auto-détecté par pg Pool)
    pool = new Pool({
      connectionString: CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  } else {
    // Connexion via paramètres séparés
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'senfood',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
    });
  }
  pool.on('connect', () => console.log('✅ Connecte a PostgreSQL'));
  pool.on('error', (err) => console.error('❌ Erreur PostgreSQL:', err));

  initDatabase = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await _createPostgresTables(client);
      await client.query('COMMIT');
      console.log('✅ Tables PostgreSQL initialisees');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };
} else {
  // ===== MODE SQLITE (better-sqlite3 - synchrone, fiable) =====
  const Database = require('better-sqlite3');
  const path = require('path');
  const dbPath = path.resolve(__dirname, '..', 'senfood.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  console.log('✅ Connecte a SQLite (mode dev) -', dbPath);

  function convertSql(sql) {
    let s = sql.replace(/\$(\d+)/g, '?');
    s = s.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    s = s.replace(/VARCHAR\(\d+\)/gi, 'TEXT');
    s = s.replace(/DECIMAL\(\d+,?\d*\)/gi, 'REAL');
    s = s.replace(/\bBOOLEAN\b/gi, 'INTEGER');
    s = s.replace(/\bTIMESTAMP\b/gi, 'DATETIME');
    s = s.replace(/\bJSONB\b/gi, 'TEXT');
    s = s.replace(/\bTIME\b(?!\s*\()/gi, 'TEXT');
    s = s.replace(/\bDEFAULT true\b/gi, 'DEFAULT 1');
    s = s.replace(/\bDEFAULT false\b/gi, 'DEFAULT 0');
    s = s.replace(/CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s*'[^']+'/gi, "datetime('now', '+90 days')");
    s = s.replace(/ON DELETE CASCADE/gi, '');
    // Remove RETURNING clause - we handle it separately
    s = s.replace(/\s+RETURNING\s+.*/gi, '');
    return s;
  }

  pool = {
    query: async (sql, params = []) => {
      const trimmed = sql.trim().toUpperCase();
      const sqliteSQL = convertSql(sql);

      // Convert JS booleans to 0/1
      const safeParams = (params || []).map(p => p === true ? 1 : p === false ? 0 : p);

      // Ignore ALTER SEQUENCE
      if (trimmed.startsWith('ALTER SEQUENCE')) return { rows: [], rowCount: 0 };

      // Handle BEGIN/COMMIT/ROLLBACK
      if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
        try { db.exec(sqliteSQL); } catch(e) {}
        return { rows: [], rowCount: 0 };
      }

      // Handle ALTER TABLE
      if (trimmed.startsWith('ALTER TABLE')) {
        try { db.exec(sqliteSQL); } catch(e) { /* ignore duplicate column errors */ }
        return { rows: [], rowCount: 0 };
      }

      // Handle CREATE INDEX
      if (trimmed.startsWith('CREATE') && trimmed.includes('INDEX')) {
        try { db.exec(sqliteSQL); } catch(e) {}
        return { rows: [], rowCount: 0 };
      }

      // Handle CREATE TABLE
      if (trimmed.startsWith('CREATE TABLE')) {
        try { db.exec(sqliteSQL); } catch(e) { console.error('CREATE TABLE error:', e.message); }
        return { rows: [], rowCount: 0 };
      }

      // SELECT / WITH
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
        try {
          const rows = db.prepare(sqliteSQL).all(...safeParams);
          return { rows, rowCount: rows.length };
        } catch(e) {
          console.error('SELECT error:', e.message, '\nSQL:', sqliteSQL.substring(0, 200));
          return { rows: [], rowCount: 0 };
        }
      }

      // INSERT
      if (trimmed.startsWith('INSERT')) {
        try {
          const info = db.prepare(sqliteSQL).run(...safeParams);
          const hadReturning = sql.toUpperCase().includes('RETURNING');
          if (hadReturning) {
            const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
            if (tableMatch) {
              const row = db.prepare(`SELECT * FROM ${tableMatch[1]} WHERE id = ?`).get(info.lastInsertRowid);
              return { rows: row ? [row] : [{ id: info.lastInsertRowid }], rowCount: 1 };
            }
            return { rows: [{ id: info.lastInsertRowid }], rowCount: 1 };
          }
          return { rows: [], rowCount: info.changes, lastID: info.lastInsertRowid };
        } catch(e) {
          console.error('INSERT error:', e.message, '\nSQL:', sqliteSQL.substring(0, 200));
          throw e;
        }
      }

      // UPDATE / DELETE
      try {
        const info = db.prepare(sqliteSQL).run(...safeParams);
        const hadReturning = sql.toUpperCase().includes('RETURNING');
        if (hadReturning) {
          // Can't easily get RETURNING for UPDATE in SQLite, return empty
          return { rows: [], rowCount: info.changes };
        }
        return { rows: [], rowCount: info.changes };
      } catch(e) {
        console.error('SQL error:', e.message, '\nSQL:', sqliteSQL.substring(0, 200));
        throw e;
      }
    },

    connect: async () => ({
      query: (sql, params) => pool.query(sql, params),
      release: () => {},
    }),

    end: async () => {
      try { db.close(); } catch(e) {}
    },

    _db: db,
  };

  initDatabase = async () => {
    try {
      await _createSQLiteTables();
      console.log('✅ Tables SQLite initialisees (15 tables)');
    } catch (err) {
      console.error('❌ Erreur init DB:', err);
      throw err;
    }
  };

  async function _createSQLiteTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL CHECK(role IN ('client','restaurant','livreur','admin')),
        name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, email TEXT, password TEXT NOT NULL, address TEXT,
        is_active INTEGER DEFAULT 1, latitude REAL, longitude REAL, referral_code TEXT, loyalty_balance INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL, description TEXT, price REAL NOT NULL, image_url TEXT, category TEXT,
        is_available INTEGER DEFAULT 1, prep_time_minutes INTEGER DEFAULT 15,
        available_from DATETIME, available_until DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES users(id),
        restaurant_id INTEGER NOT NULL REFERENCES users(id), courier_id INTEGER REFERENCES users(id),
        status TEXT NOT NULL CHECK(status IN ('nouvelle','preparation','prete','en_route','livree','annulee')),
        total_amount REAL NOT NULL, delivery_fee REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
        promo_code TEXT, estimated_delivery_time INTEGER,
        payment_method TEXT CHECK(payment_method IN ('wave','orange_money','cash')),
        payment_status TEXT CHECK(payment_status IN ('en_attente','paye','echoue')),
        delivery_address TEXT NOT NULL, latitude REAL, longitude REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id), quantity INTEGER NOT NULL, price_at_time REAL NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER DEFAULT 0,
        data TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS courier_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, courier_id INTEGER NOT NULL REFERENCES users(id),
        latitude REAL NOT NULL, longitude REAL NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        restaurant_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER NOT NULL REFERENCES orders(id),
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5), comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, order_id))`,
      `CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        restaurant_id INTEGER NOT NULL REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, restaurant_id))`,
      `CREATE TABLE IF NOT EXISTS restaurant_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER NOT NULL REFERENCES users(id),
        day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
        open_time TEXT NOT NULL, close_time TEXT NOT NULL, UNIQUE(restaurant_id, day_of_week))`,
      `CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, description TEXT,
        discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage','fixed')),
        discount_value REAL NOT NULL, min_order_amount REAL DEFAULT 0,
        max_uses INTEGER DEFAULT 0, current_uses INTEGER DEFAULT 0,
        restaurant_id INTEGER REFERENCES users(id), starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS user_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        label TEXT NOT NULL, address TEXT NOT NULL, latitude REAL, longitude REAL,
        is_default INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
        sender_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS loyalty_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        points INTEGER NOT NULL, type TEXT NOT NULL CHECK(type IN ('earned','redeemed','bonus','referral')),
        description TEXT, order_id INTEGER REFERENCES orders(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_id INTEGER NOT NULL REFERENCES users(id), referral_code TEXT NOT NULL,
        bonus_given INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(referred_id))`,
    ];
    for (const t of tables) {
      db.exec(t);
    }
  }
}

// ===== PostgreSQL tables (production) =====
async function _createPostgresTables(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, role VARCHAR(20) NOT NULL CHECK(role IN ('client','restaurant','livreur','admin')), name VARCHAR(100) NOT NULL, phone VARCHAR(20) UNIQUE NOT NULL, email VARCHAR(100) UNIQUE, password VARCHAR(255) NOT NULL, address TEXT, is_active BOOLEAN DEFAULT true, latitude DECIMAL(10,8), longitude DECIMAL(11,8), referral_code VARCHAR(20), loyalty_balance INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS menu_items (id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(200) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL, image_url TEXT, category VARCHAR(50), is_available BOOLEAN DEFAULT true, prep_time_minutes INTEGER DEFAULT 15, available_from TIMESTAMP, available_until TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES users(id), restaurant_id INTEGER NOT NULL REFERENCES users(id), courier_id INTEGER REFERENCES users(id), status VARCHAR(20) NOT NULL CHECK(status IN ('nouvelle','preparation','prete','en_route','livree','annulee')), total_amount DECIMAL(10,2) NOT NULL, delivery_fee DECIMAL(10,2) DEFAULT 0, discount_amount DECIMAL(10,2) DEFAULT 0, promo_code VARCHAR(50), estimated_delivery_time INTEGER, payment_method VARCHAR(20) CHECK(payment_method IN ('wave','orange_money','cash')), payment_status VARCHAR(20) CHECK(payment_status IN ('en_attente','paye','echoue')), delivery_address TEXT NOT NULL, latitude DECIMAL(10,8), longitude DECIMAL(11,8), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, menu_item_id INTEGER NOT NULL REFERENCES menu_items(id), quantity INTEGER NOT NULL, price_at_time DECIMAL(10,2) NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, type VARCHAR(50) NOT NULL, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, is_read BOOLEAN DEFAULT false, data JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS courier_locations (id SERIAL PRIMARY KEY, courier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, latitude DECIMAL(10,8) NOT NULL, longitude DECIMAL(11,8) NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS ratings (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), restaurant_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER NOT NULL REFERENCES orders(id), rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5), comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, order_id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS favorites (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), restaurant_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, restaurant_id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS restaurant_hours (id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6), open_time TIME NOT NULL, close_time TIME NOT NULL, UNIQUE(restaurant_id, day_of_week))`);
  await client.query(`CREATE TABLE IF NOT EXISTS promotions (id SERIAL PRIMARY KEY, code VARCHAR(50) UNIQUE NOT NULL, description TEXT, discount_type VARCHAR(20) NOT NULL CHECK(discount_type IN ('percentage','fixed')), discount_value DECIMAL(10,2) NOT NULL, min_order_amount DECIMAL(10,2) DEFAULT 0, max_uses INTEGER DEFAULT 0, current_uses INTEGER DEFAULT 0, restaurant_id INTEGER REFERENCES users(id), starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS user_addresses (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, label VARCHAR(50) NOT NULL, address TEXT NOT NULL, latitude DECIMAL(10,8), longitude DECIMAL(11,8), is_default BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS chat_messages (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, sender_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS loyalty_points (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, points INTEGER NOT NULL, type VARCHAR(20) NOT NULL CHECK(type IN ('earned','redeemed','bonus','referral')), description TEXT, order_id INTEGER REFERENCES orders(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id INTEGER NOT NULL REFERENCES users(id), referred_id INTEGER NOT NULL REFERENCES users(id), referral_code VARCHAR(20) NOT NULL, bonus_given BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(referred_id))`);
}

module.exports = { pool, initDatabase };
