const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Create review with photo
router.post('/', authenticate, async (req, res) => {
  try {
    const { order_id, restaurant_id, rating, comment, photo_url } = req.body;
    if (!order_id || !rating) return res.status(400).json({ error: 'order_id et rating requis' });

    const result = await pool.query(
      `INSERT INTO photo_reviews (user_id, order_id, restaurant_id, rating, comment, photo_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [req.user.id, order_id, restaurant_id, rating, comment || '', photo_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reviews for restaurant
router.get('/restaurant/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, u.name as user_name FROM photo_reviews pr
       LEFT JOIN users u ON pr.user_id = u.id
       WHERE pr.restaurant_id = $1 ORDER BY pr.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reviews for order
router.get('/order/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM photo_reviews WHERE order_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
