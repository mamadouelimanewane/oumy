const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

router.use(authenticate);

// Récupérer les notifications de l'utilisateur (paginées)
router.get('/', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = $1',
      [req.user.id]
    );

    const result = await pool.query(
      `SELECT id, type, title, message, is_read, data, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Compteur de notifications non lues
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer une notification comme lue
router.put('/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    res.json({ message: 'Notification marquée comme lue', notification: result.rows[0] });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer toutes les notifications comme lues
router.put('/read-all', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ message: 'Toutes les notifications marquées comme lues', count: result.rowCount });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
