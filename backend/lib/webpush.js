const webpush = require('web-push');
const { pool } = require('../config/database');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:contact@nooreat.example', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

// Envoie une notification push navigateur reelle a un utilisateur, si celui-ci
// s'est abonne (push_subscription non NULL) et que les cles VAPID sont configurees.
// N'echoue jamais bruyamment : une notification push est un a-cote, pas une
// operation critique - on log et on continue.
async function sendPushToUser(userId, { title, body, url }) {
  if (!ensureConfigured()) return;
  try {
    const result = await pool.query('SELECT push_subscription FROM users WHERE id = $1', [userId]);
    const raw = result.rows[0]?.push_subscription;
    if (!raw) return;

    const subscription = typeof raw === 'string' ? JSON.parse(raw) : raw;
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }));
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Abonnement expire/revoque cote navigateur - on l'oublie
      await pool.query('UPDATE users SET push_subscription = NULL WHERE id = $1', [userId]).catch(() => {});
    } else {
      console.error('Push notification error:', err.message);
    }
  }
}

module.exports = { sendPushToUser, ensureConfigured };
