const { pool } = require('../config/database');

const DEFAULTS = {
  commission_restaurant_pct: 15,
  commission_courier_pct: 10,
  delivery_fee_base: 500,
  delivery_fee_per_km: 200,
  maintenance_mode: 0,
  weekly_report_enabled: 0,
};

// Cles booleennes (0/1) plutot que numeriques libres — validees a part dans
// PUT /admin/settings.
const BOOLEAN_KEYS = ['maintenance_mode', 'weekly_report_enabled'];

// Lit tous les parametres plateforme (commissions + bareme de livraison),
// avec repli sur DEFAULTS si la ligne n'existe pas encore en base (ex. si la
// migration platform_settings n'a pas encore tourne — voir la mesaventure
// is_online : les migrations ALTER TABLE/seed ne sont pas garanties de
// s'executer avant la premiere requete sur une instance serverless Vercel).
async function getSettings() {
  const result = await pool.query('SELECT key, value FROM platform_settings');
  const settings = { ...DEFAULTS };
  for (const row of result.rows) {
    if (row.key in DEFAULTS) settings[row.key] = parseFloat(row.value);
  }
  return settings;
}

module.exports = { getSettings, DEFAULTS, BOOLEAN_KEYS };
