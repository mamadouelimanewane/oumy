const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /stories - Public: get active stories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as restaurant_name
       FROM restaurant_stories s JOIN users u ON s.restaurant_id = u.id
       WHERE s.is_active = true AND s.expires_at > CURRENT_TIMESTAMP
       ORDER BY s.created_at DESC LIMIT 50`
    );

    // Group by restaurant
    const grouped = {};
    for (const story of result.rows) {
      if (!grouped[story.restaurant_id]) {
        grouped[story.restaurant_id] = { restaurant_id: story.restaurant_id, restaurant_name: story.restaurant_name, stories: [] };
      }
      grouped[story.restaurant_id].stories.push(story);
    }
    res.json(Object.values(grouped));
  } catch (err) {
    console.error('Get stories error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stories - Restaurant: create story
router.post('/', authenticate, authorize('restaurant'), [
  body('image_url').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { image_url, caption } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    const result = await pool.query(
      'INSERT INTO restaurant_stories (restaurant_id, image_url, caption, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, image_url, caption, expiresAt]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create story error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stories/:id/view - Increment view count
router.post('/:id/view', async (req, res) => {
  try {
    await pool.query('UPDATE restaurant_stories SET views_count = views_count + 1 WHERE id = $1', [req.params.id]);
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /stories/:id - Restaurant: delete own story
router.delete('/:id', authenticate, authorize('restaurant'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM restaurant_stories WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Story non trouvée' });
    res.json({ message: 'Story supprimée' });
  } catch (err) {
    console.error('Delete story error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
