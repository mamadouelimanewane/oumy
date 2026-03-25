const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /recommendations - Personalized recommendations based on order history
router.get('/', authenticate, async (req, res) => {
  try {
    // Get user's order history
    const history = await pool.query(
      `SELECT oi.menu_item_id, mi.category, mi.restaurant_id, COUNT(*) as order_count
       FROM orders o JOIN order_items oi ON o.id = oi.order_id
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE o.client_id = $1 AND o.status = 'livree'
       GROUP BY oi.menu_item_id, mi.category, mi.restaurant_id
       ORDER BY order_count DESC LIMIT 20`,
      [req.user.id]
    );

    if (history.rows.length === 0) {
      // New user: show popular items
      const popular = await pool.query(
        `SELECT mi.*, u.name as restaurant_name, COUNT(oi.id) as popularity
         FROM menu_items mi JOIN order_items oi ON mi.id = oi.menu_item_id
         JOIN users u ON mi.restaurant_id = u.id
         WHERE mi.is_available = true
         GROUP BY mi.id, u.name ORDER BY popularity DESC LIMIT 10`
      );
      return res.json({ type: 'popular', items: popular.rows });
    }

    // Get favorite categories and restaurants
    const favCategories = [...new Set(history.rows.map(h => h.category).filter(Boolean))];
    const favRestaurants = [...new Set(history.rows.map(h => h.restaurant_id))];
    const orderedItemIds = history.rows.map(h => h.menu_item_id);

    // Recommend: same categories, not yet ordered
    const recommended = await pool.query(
      `SELECT mi.*, u.name as restaurant_name,
       COALESCE(AVG(r.rating), 0) as avg_rating
       FROM menu_items mi JOIN users u ON mi.restaurant_id = u.id
       LEFT JOIN ratings r ON r.restaurant_id = mi.restaurant_id
       WHERE mi.is_available = true AND mi.id != ALL($1)
       AND (mi.category = ANY($2) OR mi.restaurant_id = ANY($3))
       GROUP BY mi.id, u.name ORDER BY avg_rating DESC LIMIT 10`,
      [orderedItemIds, favCategories, favRestaurants]
    );

    // "Order again" - most ordered items
    const reorder = await pool.query(
      `SELECT mi.*, u.name as restaurant_name FROM menu_items mi
       JOIN users u ON mi.restaurant_id = u.id
       WHERE mi.id = ANY($1) AND mi.is_available = true LIMIT 5`,
      [orderedItemIds.slice(0, 5)]
    );

    // Surprise me - random item from a new restaurant
    const surprise = await pool.query(
      `SELECT mi.*, u.name as restaurant_name FROM menu_items mi
       JOIN users u ON mi.restaurant_id = u.id
       WHERE mi.is_available = true AND mi.restaurant_id != ALL($1)
       ORDER BY RANDOM() LIMIT 3`,
      [favRestaurants]
    );

    res.json({
      type: 'personalized',
      recommended: recommended.rows,
      reorder: reorder.rows,
      surprise: surprise.rows,
    });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /recommendations/surprise - Random dish suggestion
router.get('/surprise', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mi.*, u.name as restaurant_name FROM menu_items mi
       JOIN users u ON mi.restaurant_id = u.id
       WHERE mi.is_available = true ORDER BY RANDOM() LIMIT 1`
    );
    if (result.rows.length === 0) return res.json({ dish: null });
    res.json({ dish: result.rows[0] });
  } catch (err) {
    console.error('Surprise recommendation error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /recommendations/menu-du-jour - Daily menu items
router.get('/menu-du-jour', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mi.*, u.name as restaurant_name FROM menu_items mi
       JOIN users u ON mi.restaurant_id = u.id
       WHERE mi.is_available = true
       AND mi.available_from IS NOT NULL AND mi.available_until IS NOT NULL
       AND CURRENT_TIMESTAMP BETWEEN mi.available_from AND mi.available_until
       ORDER BY mi.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Menu du jour error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
