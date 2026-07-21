/**
 * 🗄️ NOOR EAT Database Adapter
 * Auto-detecte PostgreSQL (DB_HOST set) ou bascule sur SQLite (better-sqlite3)
 * Interface unifiee: pool.query(sql, params) - $1,$2 auto-converti pour SQLite
 */

require('dotenv').config();

// DATABASE_URL/POSTGRES_URL (integration Neon actuelle) passent en premier :
// les variables DATABASE_POSTGRES_*/DATABASE_SUPABASE_* restent presentes sur
// Vercel mais pointent vers un projet Supabase supprime (integration
// "Uninstalled", DNS ne resout plus) - ne pas les prioriser.
const CONNECTION_STRING = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_POSTGRES_URL || process.env.DATABASE_SUPABASE_URL;
const USE_POSTGRES = process.env.DB_TYPE === 'postgres' || process.env.DB_HOST || CONNECTION_STRING;

let pool;
let initDatabase;

if (USE_POSTGRES) {
  // ===== MODE POSTGRESQL (Production/Supabase/Vercel) =====
  const { Pool } = require('pg');
  
  if (CONNECTION_STRING) {
    // pg recent versions treat sslmode=require/prefer/verify-ca in the connection
    // string as verify-full, which overrides an explicit ssl.rejectUnauthorized:false
    // option below. Strip it so the object-level ssl option (scoped to this pool
    // only, not process-wide) is what actually governs the connection.
    const sanitizedConnectionString = CONNECTION_STRING.replace(/([?&])sslmode=[^&]*&?/i, '$1').replace(/[?&]$/, '');
    pool = new Pool({
      connectionString: sanitizedConnectionString,
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
      database: process.env.DB_NAME || 'nooreat',
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
  const dbPath = path.resolve(__dirname, '..', 'nooreat.db');
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
    s = s.replace(/EXTRACT\(DOW FROM CURRENT_TIMESTAMP\)/gi, "CAST(strftime('%w','now') AS INTEGER)");
    s = s.replace(/\bCURRENT_TIME\b/g, "strftime('%H:%M','now')");
    s = s.replace(/ON DELETE CASCADE/gi, '');
    s = s.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
    // SQLite (better-sqlite3) has no row locking - safe to drop, single writer connection
    s = s.replace(/\s+FOR UPDATE\b/gi, '');
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
        is_pro INTEGER DEFAULT 0, pro_expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        amount REAL NOT NULL, method TEXT CHECK(method IN ('wave','orange_money')),
        status TEXT DEFAULT 'en_attente' CHECK(status IN ('en_attente','paye','rejete')),
        reference_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
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
      `CREATE TABLE IF NOT EXISTS push_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL, body TEXT, icon TEXT DEFAULT '🔔', type TEXT DEFAULT 'general',
        read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS loyalty_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        points INTEGER NOT NULL, type TEXT NOT NULL CHECK(type IN ('earned','redeemed','bonus','referral')),
        description TEXT, order_id INTEGER REFERENCES orders(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_id INTEGER NOT NULL REFERENCES users(id), referral_code TEXT NOT NULL,
        bonus_given INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(referred_id))`,
      `CREATE TABLE IF NOT EXISTS courier_location_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, courier_id INTEGER NOT NULL REFERENCES users(id),
        latitude REAL NOT NULL, longitude REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        balance REAL DEFAULT 0, currency TEXT DEFAULT 'XOF',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT CHECK(type IN ('deposit','withdrawal','payment','cashback','refund')),
        amount REAL NOT NULL, payment_method TEXT, transaction_ref TEXT UNIQUE,
        phone_number TEXT, order_id INTEGER REFERENCES orders(id),
        description TEXT, status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS menu_item_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT, menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
        name TEXT NOT NULL, type TEXT CHECK(type IN ('single','multiple')) DEFAULT 'single',
        is_required INTEGER DEFAULT 0, max_selections INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS menu_item_option_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT, option_id INTEGER NOT NULL REFERENCES menu_item_options(id),
        name TEXT NOT NULL, price_extra REAL DEFAULT 0, is_default INTEGER DEFAULT 0, is_available INTEGER DEFAULT 1)`,
      `CREATE TABLE IF NOT EXISTS order_item_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_item_id INTEGER NOT NULL REFERENCES order_items(id),
        option_name TEXT, value_name TEXT, price_extra REAL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS scheduled_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
        scheduled_for DATETIME NOT NULL, reminder_sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS subscription_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
        meals_per_week INTEGER NOT NULL, price_per_week REAL NOT NULL,
        discount_percent REAL DEFAULT 0, is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS user_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
        status TEXT CHECK(status IN ('active','paused','cancelled')) DEFAULT 'active',
        starts_at DATETIME, expires_at DATETIME, meals_remaining INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, icon TEXT,
        condition_type TEXT NOT NULL, condition_value INTEGER NOT NULL, reward_points INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS user_badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        badge_id INTEGER NOT NULL REFERENCES badges(id),
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
        type TEXT CHECK(type IN ('daily','weekly','monthly')),
        target_value INTEGER NOT NULL,
        reward_type TEXT CHECK(reward_type IN ('points','discount','free_item')),
        reward_value TEXT, starts_at DATETIME, ends_at DATETIME, is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS user_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        challenge_id INTEGER NOT NULL REFERENCES challenges(id),
        current_value INTEGER DEFAULT 0, is_completed INTEGER DEFAULT 0,
        completed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS gift_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL,
        sender_id INTEGER REFERENCES users(id), recipient_phone TEXT,
        amount REAL NOT NULL, balance REAL NOT NULL, message TEXT,
        is_redeemed INTEGER DEFAULT 0, redeemed_by INTEGER REFERENCES users(id),
        expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS tips (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
        user_id INTEGER NOT NULL REFERENCES users(id), courier_id INTEGER NOT NULL REFERENCES users(id),
        amount REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id), subject TEXT NOT NULL,
        category TEXT CHECK(category IN ('order_issue','payment','delivery','general','refund')),
        status TEXT CHECK(status IN ('open','in_progress','resolved','closed')) DEFAULT 'open',
        priority TEXT CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),
        sender_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS delivery_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
        base_fee REAL NOT NULL, price_per_km REAL NOT NULL, max_distance_km REAL,
        min_order_amount REAL DEFAULT 0, is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS relay_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT NOT NULL,
        latitude REAL, longitude REAL, opening_hours TEXT, is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS restaurant_stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER NOT NULL REFERENCES users(id),
        image_url TEXT NOT NULL, caption TEXT, expires_at DATETIME NOT NULL,
        views_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS social_feed (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT CHECK(type IN ('order','review','badge','referral','challenge')),
        content TEXT, data TEXT, is_public INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS ambassador_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
        tier TEXT CHECK(tier IN ('bronze','silver','gold','platinum')) DEFAULT 'bronze',
        total_referrals INTEGER DEFAULT 0, total_earnings REAL DEFAULT 0,
        commission_rate REAL DEFAULT 5, is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS menu_item_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT, menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) UNIQUE,
        quantity INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER DEFAULT 5,
        auto_disable INTEGER DEFAULT 1, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS catering_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES users(id),
        restaurant_id INTEGER NOT NULL REFERENCES users(id), event_date DATETIME NOT NULL,
        guest_count INTEGER NOT NULL, budget REAL, notes TEXT,
        status TEXT CHECK(status IN ('pending','accepted','rejected','completed')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS qr_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER NOT NULL REFERENCES users(id),
        table_number TEXT NOT NULL, qr_data TEXT NOT NULL, is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(restaurant_id, table_number))`,
      `CREATE TABLE IF NOT EXISTS demand_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER NOT NULL REFERENCES users(id),
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
        predicted_date TEXT NOT NULL, predicted_quantity INTEGER NOT NULL, confidence REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS fraud_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id), alert_type TEXT NOT NULL,
        severity TEXT CHECK(severity IN ('low','medium','high','critical')),
        description TEXT, is_resolved INTEGER DEFAULT 0, resolved_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const t of tables) {
      db.exec(t);
    }

    // Add new columns to existing tables
    const alterStatements = [
      'ALTER TABLE orders ADD COLUMN scheduled_for DATETIME',
      'ALTER TABLE orders ADD COLUMN is_express INTEGER DEFAULT 0',
      'ALTER TABLE orders ADD COLUMN tip_amount REAL DEFAULT 0',
      'ALTER TABLE orders ADD COLUMN relay_point_id INTEGER REFERENCES relay_points(id)',
      'ALTER TABLE users ADD COLUMN birthday TEXT',
      'ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT \'fr\'',
      'ALTER TABLE users ADD COLUMN push_token TEXT',
      'ALTER TABLE order_items ADD COLUMN special_instructions TEXT',
      'ALTER TABLE menu_items ADD COLUMN calories INTEGER',
      'ALTER TABLE menu_items ADD COLUMN allergens TEXT',
      'ALTER TABLE menu_items ADD COLUMN stock_quantity INTEGER DEFAULT -1',
      'ALTER TABLE chat_messages ADD COLUMN sender_role TEXT',
      'ALTER TABLE referrals ADD COLUMN bonus_amount INTEGER DEFAULT 500',
      'ALTER TABLE referrals ADD COLUMN status TEXT DEFAULT \'pending\'',
      'ALTER TABLE users ADD COLUMN push_subscription TEXT',
      'ALTER TABLE users ADD COLUMN otp_code TEXT',
      'ALTER TABLE users ADD COLUMN otp_expires DATETIME',
      'ALTER TABLE users ADD COLUMN two_fa_verified INTEGER DEFAULT 0',
    ];
    for (const stmt of alterStatements) {
      try { db.exec(stmt); } catch(e) { /* column may already exist */ }
    }
  }
}

// ===== PostgreSQL tables (production) =====
async function _createPostgresTables(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, role VARCHAR(20) NOT NULL CHECK(role IN ('client','restaurant','livreur','admin')), name VARCHAR(100) NOT NULL, phone VARCHAR(20) UNIQUE NOT NULL, email VARCHAR(100) UNIQUE, password VARCHAR(255) NOT NULL, address TEXT, is_active BOOLEAN DEFAULT true, latitude DECIMAL(10,8), longitude DECIMAL(11,8), referral_code VARCHAR(20), loyalty_balance INTEGER DEFAULT 0, is_pro BOOLEAN DEFAULT false, pro_expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS payouts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), amount DECIMAL(10,2) NOT NULL, method VARCHAR(20) CHECK(method IN ('wave','orange_money')), status VARCHAR(20) DEFAULT 'en_attente' CHECK(status IN ('en_attente','paye','rejete')), reference_id VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS menu_items (id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(200) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL, image_url TEXT, category VARCHAR(50), is_available BOOLEAN DEFAULT true, prep_time_minutes INTEGER DEFAULT 15, available_from TIMESTAMP, available_until TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES users(id), restaurant_id INTEGER NOT NULL REFERENCES users(id), courier_id INTEGER REFERENCES users(id), status VARCHAR(20) NOT NULL CHECK(status IN ('nouvelle','preparation','prete','en_route','livree','annulee')), total_amount DECIMAL(10,2) NOT NULL, delivery_fee DECIMAL(10,2) DEFAULT 0, discount_amount DECIMAL(10,2) DEFAULT 0, promo_code VARCHAR(50), estimated_delivery_time INTEGER, payment_method VARCHAR(20) CHECK(payment_method IN ('wave','orange_money','cash')), payment_status VARCHAR(20) CHECK(payment_status IN ('en_attente','paye','echoue')), delivery_address TEXT NOT NULL, latitude DECIMAL(10,8), longitude DECIMAL(11,8), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, menu_item_id INTEGER NOT NULL REFERENCES menu_items(id), quantity INTEGER NOT NULL, price_at_time DECIMAL(10,2) NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, type VARCHAR(50) NOT NULL, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, is_read BOOLEAN DEFAULT false, data JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS courier_locations (id SERIAL PRIMARY KEY, courier_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, latitude DECIMAL(10,8) NOT NULL, longitude DECIMAL(11,8) NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS ratings (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), restaurant_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER NOT NULL REFERENCES orders(id), rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5), comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, order_id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS favorites (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), restaurant_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, restaurant_id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS restaurant_hours (id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6), open_time TIME NOT NULL, close_time TIME NOT NULL, UNIQUE(restaurant_id, day_of_week))`);
  await client.query(`CREATE TABLE IF NOT EXISTS promotions (id SERIAL PRIMARY KEY, code VARCHAR(50) UNIQUE NOT NULL, description TEXT, discount_type VARCHAR(20) NOT NULL CHECK(discount_type IN ('percentage','fixed')), discount_value DECIMAL(10,2) NOT NULL, min_order_amount DECIMAL(10,2) DEFAULT 0, max_uses INTEGER DEFAULT 0, current_uses INTEGER DEFAULT 0, restaurant_id INTEGER REFERENCES users(id), starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS user_addresses (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, label VARCHAR(50) NOT NULL, address TEXT NOT NULL, latitude DECIMAL(10,8), longitude DECIMAL(11,8), is_default BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS chat_messages (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, sender_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS loyalty_points (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, points INTEGER NOT NULL, type VARCHAR(20) NOT NULL CHECK(type IN ('earned','redeemed','bonus','referral')), description TEXT, order_id INTEGER REFERENCES orders(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_id INTEGER NOT NULL REFERENCES users(id), referred_id INTEGER NOT NULL REFERENCES users(id), referral_code VARCHAR(20) NOT NULL, bonus_given BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(referred_id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS courier_location_history (id SERIAL PRIMARY KEY, courier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, latitude DECIMAL(10,8) NOT NULL, longitude DECIMAL(11,8) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  // ===== NEW FEATURE TABLES =====
  await client.query(`CREATE TABLE IF NOT EXISTS wallets (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE, balance DECIMAL(10,2) DEFAULT 0, currency VARCHAR(10) DEFAULT 'XOF', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS wallet_transactions (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), type VARCHAR(20) NOT NULL CHECK(type IN ('deposit','withdrawal','payment','cashback','refund')), amount DECIMAL(10,2) NOT NULL, payment_method VARCHAR(20), transaction_ref VARCHAR(100) UNIQUE, phone_number VARCHAR(20), order_id INTEGER REFERENCES orders(id), description TEXT, status VARCHAR(20) DEFAULT 'completed', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS menu_item_options (id SERIAL PRIMARY KEY, menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, type VARCHAR(20) DEFAULT 'single' CHECK(type IN ('single','multiple')), is_required BOOLEAN DEFAULT false, max_selections INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS menu_item_option_values (id SERIAL PRIMARY KEY, option_id INTEGER NOT NULL REFERENCES menu_item_options(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, price_extra DECIMAL(10,2) DEFAULT 0, is_default BOOLEAN DEFAULT false, is_available BOOLEAN DEFAULT true)`);
  await client.query(`CREATE TABLE IF NOT EXISTS order_item_options (id SERIAL PRIMARY KEY, order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE, option_name VARCHAR(100), value_name VARCHAR(100), price_extra DECIMAL(10,2) DEFAULT 0)`);
  await client.query(`CREATE TABLE IF NOT EXISTS scheduled_orders (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), scheduled_for TIMESTAMP NOT NULL, reminder_sent BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS subscription_plans (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, meals_per_week INTEGER NOT NULL, price_per_week DECIMAL(10,2) NOT NULL, discount_percent DECIMAL(5,2) DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS user_subscriptions (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), plan_id INTEGER NOT NULL REFERENCES subscription_plans(id), status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active','paused','cancelled')), starts_at TIMESTAMP, expires_at TIMESTAMP, meals_remaining INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS badges (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, icon VARCHAR(50), condition_type VARCHAR(50) NOT NULL, condition_value INTEGER NOT NULL, reward_points INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS user_badges (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), badge_id INTEGER NOT NULL REFERENCES badges(id), earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, badge_id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS challenges (id SERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL, description TEXT, type VARCHAR(20) CHECK(type IN ('daily','weekly','monthly')), target_value INTEGER NOT NULL, reward_type VARCHAR(20) CHECK(reward_type IN ('points','discount','free_item')), reward_value VARCHAR(100), starts_at TIMESTAMP, ends_at TIMESTAMP, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS user_challenges (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), challenge_id INTEGER NOT NULL REFERENCES challenges(id), current_value INTEGER DEFAULT 0, is_completed BOOLEAN DEFAULT false, completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, challenge_id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS gift_cards (id SERIAL PRIMARY KEY, code VARCHAR(50) UNIQUE NOT NULL, sender_id INTEGER REFERENCES users(id), recipient_phone VARCHAR(20), amount DECIMAL(10,2) NOT NULL, balance DECIMAL(10,2) NOT NULL, message TEXT, is_redeemed BOOLEAN DEFAULT false, redeemed_by INTEGER REFERENCES users(id), expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS tips (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), user_id INTEGER NOT NULL REFERENCES users(id), courier_id INTEGER NOT NULL REFERENCES users(id), amount DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS support_tickets (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER REFERENCES orders(id), subject VARCHAR(200) NOT NULL, category VARCHAR(50) CHECK(category IN ('order_issue','payment','delivery','general','refund')), status VARCHAR(20) DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed')), priority VARCHAR(10) DEFAULT 'medium' CHECK(priority IN ('low','medium','high')), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS ticket_messages (id SERIAL PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, sender_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL, is_admin BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS delivery_zones (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, base_fee DECIMAL(10,2) NOT NULL, price_per_km DECIMAL(10,2) NOT NULL, max_distance_km DECIMAL(5,2), min_order_amount DECIMAL(10,2) DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS relay_points (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, address TEXT NOT NULL, latitude DECIMAL(10,8), longitude DECIMAL(11,8), opening_hours TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS restaurant_stories (id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES users(id), image_url TEXT NOT NULL, caption TEXT, expires_at TIMESTAMP NOT NULL, views_count INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS social_feed (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), type VARCHAR(30) CHECK(type IN ('order','review','badge','referral','challenge')), content TEXT, data JSONB, is_public BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS ambassador_profiles (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE, tier VARCHAR(20) DEFAULT 'bronze' CHECK(tier IN ('bronze','silver','gold','platinum')), total_referrals INTEGER DEFAULT 0, total_earnings DECIMAL(10,2) DEFAULT 0, commission_rate DECIMAL(5,2) DEFAULT 5, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS menu_item_stock (id SERIAL PRIMARY KEY, menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) UNIQUE, quantity INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER DEFAULT 5, auto_disable BOOLEAN DEFAULT true, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS catering_requests (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES users(id), restaurant_id INTEGER NOT NULL REFERENCES users(id), event_date TIMESTAMP NOT NULL, guest_count INTEGER NOT NULL, budget DECIMAL(10,2), notes TEXT, status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','completed')), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS qr_codes (id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES users(id), table_number VARCHAR(20) NOT NULL, qr_data TEXT NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(restaurant_id, table_number))`);
  await client.query(`CREATE TABLE IF NOT EXISTS demand_predictions (id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES users(id), menu_item_id INTEGER NOT NULL REFERENCES menu_items(id), predicted_date DATE NOT NULL, predicted_quantity INTEGER NOT NULL, confidence DECIMAL(5,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS fraud_alerts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER REFERENCES orders(id), alert_type VARCHAR(50) NOT NULL, severity VARCHAR(20) CHECK(severity IN ('low','medium','high','critical')), description TEXT, is_resolved BOOLEAN DEFAULT false, resolved_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  // ===== WAVE 2 FEATURE TABLES =====
  await client.query(`CREATE TABLE IF NOT EXISTS user_preferences (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE, dark_mode BOOLEAN DEFAULT false, language VARCHAR(10) DEFAULT 'fr', notifications_enabled BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS saved_addresses (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), label VARCHAR(50) NOT NULL, address TEXT NOT NULL, latitude DECIMAL(10,8), longitude DECIMAL(11,8), is_default BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS group_orders (id SERIAL PRIMARY KEY, creator_id INTEGER NOT NULL REFERENCES users(id), share_code VARCHAR(20) UNIQUE, restaurant_id INTEGER NOT NULL REFERENCES users(id), status VARCHAR(20) DEFAULT 'open', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS group_order_items (id SERIAL PRIMARY KEY, group_order_id INTEGER NOT NULL REFERENCES group_orders(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), menu_item_id INTEGER NOT NULL REFERENCES menu_items(id), quantity INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS meal_plans (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name VARCHAR(100) NOT NULL, plan_data JSONB, is_active BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS mini_game_prizes (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), game_type VARCHAR(30) NOT NULL, prize_type VARCHAR(30) NOT NULL, prize_value INTEGER NOT NULL, is_claimed BOOLEAN DEFAULT false, expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS price_alerts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), menu_item_id INTEGER NOT NULL REFERENCES menu_items(id), target_price DECIMAL(10,2) NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS split_payments (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), created_by INTEGER NOT NULL REFERENCES users(id), total_amount DECIMAL(10,2) NOT NULL, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS split_payment_shares (id SERIAL PRIMARY KEY, split_payment_id INTEGER NOT NULL REFERENCES split_payments(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), amount DECIMAL(10,2) NOT NULL, status VARCHAR(20) DEFAULT 'pending', paid_at TIMESTAMP)`);

  // Wave 3 tables
  await client.query(`CREATE TABLE IF NOT EXISTS photo_reviews (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER REFERENCES orders(id), restaurant_id INTEGER REFERENCES users(id), rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), comment TEXT, photo_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS push_notifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title VARCHAR(200) NOT NULL, body TEXT, icon VARCHAR(10) DEFAULT '🔔', type VARCHAR(30) DEFAULT 'general', read BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

  // Add new columns to existing tables
  const alterCols = [
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_express BOOLEAN DEFAULT false',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS relay_point_id INTEGER',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT \'fr\'',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT',
    'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS special_instructions TEXT',
    'ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS calories INTEGER',
    'ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens TEXT',
    'ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT -1',
    'ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_role VARCHAR(20)',
    'ALTER TABLE referrals ADD COLUMN IF NOT EXISTS bonus_amount INTEGER DEFAULT 500',
    'ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'pending\'',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMP',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_verified BOOLEAN DEFAULT false',
  ];
  for (const stmt of alterCols) {
    try { await client.query(stmt); } catch(e) { /* column may already exist */ }
  }

  // courier_locations.courier_id n'avait aucune contrainte UNIQUE alors que
  // routes/livreur.js et server.js font tous les deux un upsert
  // "ON CONFLICT (courier_id)" -> echouait avec 500 a chaque mise a jour de
  // position en prod. Deduplique d'abord (garde la ligne la plus recente par
  // courier) avant d'ajouter la contrainte, au cas ou des doublons existent.
  try {
    await client.query(`DELETE FROM courier_locations a USING courier_locations b
      WHERE a.id < b.id AND a.courier_id = b.courier_id`);
    await client.query(`ALTER TABLE courier_locations ADD CONSTRAINT courier_locations_courier_id_key UNIQUE (courier_id)`);
  } catch (e) { /* contrainte deja presente */ }
}

module.exports = { pool, initDatabase };
