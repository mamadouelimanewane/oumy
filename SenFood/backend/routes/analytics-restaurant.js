const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('restaurant'));

// GET /overview - Revenue, orders count, avg rating
router.get('/overview', async (req, res) => {
  try {
    const restaurantId = req.user.id;

    // Revenue and order count
    const orderStats = await pool.query(
      `SELECT
         COUNT(*) as total_orders,
         COALESCE(SUM(total_amount), 0) as total_revenue,
         COALESCE(AVG(total_amount), 0) as avg_order_value,
         COUNT(CASE WHEN status = 'livree' THEN 1 END) as completed_orders,
         COUNT(CASE WHEN status = 'annulee' THEN 1 END) as cancelled_orders
       FROM orders
       WHERE restaurant_id = $1`,
      [restaurantId]
    );

    // Average rating
    const ratingStats = await pool.query(
      `SELECT
         COALESCE(AVG(rating), 0) as avg_rating,
         COUNT(*) as total_ratings
       FROM ratings
       WHERE restaurant_id = $1`,
      [restaurantId]
    );

    // Today's stats
    const todayStats = await pool.query(
      `SELECT
         COUNT(*) as today_orders,
         COALESCE(SUM(total_amount), 0) as today_revenue
       FROM orders
       WHERE restaurant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
      [restaurantId]
    );

    res.json({
      overview: {
        ...orderStats.rows[0],
        avg_rating: parseFloat(ratingStats.rows[0].avg_rating).toFixed(1),
        total_ratings: parseInt(ratingStats.rows[0].total_ratings),
        today_orders: parseInt(todayStats.rows[0].today_orders),
        today_revenue: parseFloat(todayStats.rows[0].today_revenue)
      }
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /popular-items - Top 10 items by orders
router.get('/popular-items', async (req, res) => {
  try {
    const items = await pool.query(
      `SELECT mi.id, mi.name, mi.price, mi.image_url,
              COUNT(oi.id) as order_count,
              SUM(oi.quantity) as total_quantity,
              SUM(oi.quantity * oi.price_at_time) as total_revenue
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       JOIN orders o ON o.id = oi.order_id
       WHERE mi.restaurant_id = $1 AND o.status = 'livree'
       GROUP BY mi.id, mi.name, mi.price, mi.image_url
       ORDER BY total_quantity DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({ popular_items: items.rows });
  } catch (err) {
    console.error('Popular items error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /peak-hours - Orders by hour of day
router.get('/peak-hours', async (req, res) => {
  try {
    const hours = await pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour,
              COUNT(*) as order_count
       FROM orders
       WHERE restaurant_id = $1 AND status = 'livree'
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [req.user.id]
    );

    // Fill in missing hours with 0
    const hourMap = {};
    hours.rows.forEach(h => { hourMap[parseInt(h.hour)] = parseInt(h.order_count); });

    const fullHours = [];
    for (let i = 0; i < 24; i++) {
      fullHours.push({ hour: i, order_count: hourMap[i] || 0 });
    }

    res.json({ peak_hours: fullHours });
  } catch (err) {
    console.error('Peak hours error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /revenue-chart - Daily revenue last 30 days
router.get('/revenue-chart', async (req, res) => {
  try {
    const revenue = await pool.query(
      `SELECT DATE(created_at) as date,
              COUNT(*) as order_count,
              COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE restaurant_id = $1
         AND status = 'livree'
         AND created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [req.user.id]
    );

    res.json({ revenue_chart: revenue.rows });
  } catch (err) {
    console.error('Revenue chart error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
