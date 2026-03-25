const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

// GET /social/feed - Public social feed
router.get('/feed', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const countResult = await pool.query('SELECT COUNT(*) as total FROM social_feed WHERE is_public = true');
    const result = await pool.query(
      `SELECT sf.*, u.name as user_name
       FROM social_feed sf JOIN users u ON sf.user_id = u.id
       WHERE sf.is_public = true ORDER BY sf.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get social feed error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /social/rankings - Weekly restaurant rankings
router.get('/rankings', async (req, res) => {
  try {
    const { category } = req.query;
    let categoryFilter = '';
    const params = [];
    if (category) {
      params.push(category);
      categoryFilter = `AND mi.category = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.address, 
       COALESCE(AVG(r.rating), 0) as avg_rating, COUNT(DISTINCT r.id) as review_count,
       COUNT(DISTINCT o.id) as order_count
       FROM users u
       LEFT JOIN ratings r ON r.restaurant_id = u.id
       LEFT JOIN orders o ON o.restaurant_id = u.id AND o.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
       LEFT JOIN menu_items mi ON mi.restaurant_id = u.id
       WHERE u.role = 'restaurant' AND u.is_active = true ${categoryFilter}
       GROUP BY u.id ORDER BY avg_rating DESC, order_count DESC LIMIT 10`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get rankings error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /social/ambassador - Ambassador program
router.get('/ambassador', authenticate, async (req, res) => {
  try {
    let profile = await pool.query('SELECT * FROM ambassador_profiles WHERE user_id = $1', [req.user.id]);
    if (profile.rows.length === 0) {
      profile = await pool.query(
        'INSERT INTO ambassador_profiles (user_id) VALUES ($1) RETURNING *', [req.user.id]
      );
    }
    res.json(profile.rows[0]);
  } catch (err) {
    console.error('Get ambassador profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /social/ambassador/leaderboard
router.get('/ambassador/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ap.*, u.name FROM ambassador_profiles ap JOIN users u ON ap.user_id = u.id
       WHERE ap.is_active = true ORDER BY ap.total_referrals DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get ambassador leaderboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
