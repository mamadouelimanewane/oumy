const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendPushToUser, ensureConfigured } = require('../lib/webpush');

// Clef publique VAPID (route publique, pas de secret ici - c'est le but d'une cle publique)
router.get('/vapid-public-key', (req, res) => {
  if (!ensureConfigured()) return res.status(503).json({ error: 'Push notifications non configurees' });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    await pool.query(
      `UPDATE users SET push_subscription = $1 WHERE id = $2`,
      [JSON.stringify(subscription), req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM push_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark notification read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE push_notifications SET read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE push_notifications SET read = true WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create notification (internal/admin use)
router.post('/create', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { user_id, title, body, icon, type } = req.body;
    const targetUserId = user_id || req.user.id;
    const result = await pool.query(
      `INSERT INTO push_notifications (user_id, title, body, icon, type, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [targetUserId, title, body, icon || '🔔', type || 'general']
    );
    sendPushToUser(targetUserId, { title, body }); // fire-and-forget, ne bloque pas la reponse
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
