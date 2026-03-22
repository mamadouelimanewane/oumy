const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

// Vue d'ensemble du dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Commandes aujourd'hui
    const todayOrders = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
       FROM orders 
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Commandes en cours
    const activeOrders = await pool.query(
      `SELECT COUNT(*) as count FROM orders WHERE status IN ('nouvelle', 'preparation', 'prete', 'en_route')`
    );

    // Nombre d'utilisateurs par rôle
    const usersCount = await pool.query(
      `SELECT role, COUNT(*) as count FROM users WHERE is_active = true GROUP BY role`
    );

    // Répartition des paiements
    const paymentStats = await pool.query(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
       FROM orders 
       WHERE payment_status = 'paye'
       GROUP BY payment_method`
    );

    // Commandes récentes
    const recentOrders = await pool.query(
      `SELECT o.*, c.name as client_name, r.name as restaurant_name, 
              COALESCE(l.name, 'Non assigné') as courier_name
       FROM orders o
       JOIN users c ON o.client_id = c.id
       JOIN users r ON o.restaurant_id = r.id
       LEFT JOIN users l ON o.courier_id = l.id
       ORDER BY o.created_at DESC
       LIMIT 10`
    );

    res.json({
      today: todayOrders.rows[0],
      active: activeOrders.rows[0],
      users: usersCount.rows,
      payments: paymentStats.rows,
      recentOrders: recentOrders.rows,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des restaurants (paginé)
router.get('/restaurants', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE role = 'restaurant'`
    );

    const result = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.address, u.is_active, u.created_at,
              u.latitude, u.longitude,
              COUNT(DISTINCT m.id) as menu_count,
              COUNT(DISTINCT o.id) as total_orders,
              COALESCE(SUM(o.total_amount), 0) as total_revenue,
              COALESCE(ROUND(AVG(rt.rating), 1), 0) as avg_rating
       FROM users u
       LEFT JOIN menu_items m ON m.restaurant_id = u.id
       LEFT JOIN orders o ON o.restaurant_id = u.id AND o.status = 'livree'
       LEFT JOIN ratings rt ON rt.restaurant_id = u.id
       WHERE u.role = 'restaurant'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get admin restaurants error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des livreurs (paginé)
router.get('/couriers', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE role = 'livreur'`
    );

    const result = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.address, u.is_active, u.created_at,
              COUNT(DISTINCT o.id) as total_deliveries,
              COALESCE(SUM(o.total_amount), 0) as total_amount,
              cl.latitude, cl.longitude, cl.updated_at as last_location
       FROM users u
       LEFT JOIN orders o ON o.courier_id = u.id AND o.status = 'livree'
       LEFT JOIN courier_locations cl ON cl.courier_id = u.id
       WHERE u.role = 'livreur'
       GROUP BY u.id, cl.latitude, cl.longitude, cl.updated_at
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get admin couriers error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des clients (paginé)
router.get('/clients', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE role = 'client'`
    );

    const result = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.address, u.is_active, u.created_at,
              COUNT(DISTINCT o.id) as total_orders,
              COALESCE(SUM(o.total_amount), 0) as total_spent
       FROM users u
       LEFT JOIN orders o ON o.client_id = u.id
       WHERE u.role = 'client'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get admin clients error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Toutes les commandes avec filtres
router.get('/orders', async (req, res) => {
  try {
    const { status, start_date, end_date, restaurant_id } = req.query;
    
    let query = `
      SELECT o.*, c.name as client_name, r.name as restaurant_name,
             COALESCE(l.name, 'Non assigné') as courier_name
      FROM orders o
      JOIN users c ON o.client_id = c.id
      JOIN users r ON o.restaurant_id = r.id
      LEFT JOIN users l ON o.courier_id = l.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (restaurant_id) {
      query += ` AND o.restaurant_id = $${paramIndex}`;
      params.push(restaurant_id);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND DATE(o.created_at) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND DATE(o.created_at) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Count query utilise les mêmes paramètres
    let countQuery = `SELECT COUNT(*) as total FROM orders o WHERE 1=1`;
    const countParams = [];
    let countIdx = 1;

    if (status) {
      countQuery += ` AND o.status = $${countIdx}`;
      countParams.push(status);
      countIdx++;
    }
    if (restaurant_id) {
      countQuery += ` AND o.restaurant_id = $${countIdx}`;
      countParams.push(restaurant_id);
      countIdx++;
    }
    if (start_date) {
      countQuery += ` AND DATE(o.created_at) >= $${countIdx}`;
      countParams.push(start_date);
      countIdx++;
    }
    if (end_date) {
      countQuery += ` AND DATE(o.created_at) <= $${countIdx}`;
      countParams.push(end_date);
      countIdx++;
    }

    const countResult = await pool.query(countQuery, countParams);

    const { page, limit, offset } = paginate(req.query);

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get admin orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Activer/Désactiver un utilisateur
router.put('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await pool.query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      message: `Utilisateur ${is_active ? 'activé' : 'désactivé'}`,
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Update user status error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
