const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Middleware: uniquement pour les restaurants
router.use(authenticate);
router.use(authorize('restaurant', 'admin'));

// Récupérer les commandes actives du restaurant
router.get('/orders/active', async (req, res) => {
  try {
    const restaurantId = req.user.role === 'admin' ? req.query.restaurant_id : req.user.id;
    
    if (!restaurantId) {
      return res.status(400).json({ error: 'ID restaurant requis' });
    }

    const result = await pool.query(
      `SELECT o.*, c.name as client_name, c.phone as client_phone,
              json_agg(json_build_object(
                'id', oi.id,
                'name', m.name,
                'quantity', oi.quantity,
                'price', oi.price_at_time
              )) as items
       FROM orders o
       JOIN users c ON o.client_id = c.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.restaurant_id = $1 AND o.status IN ('nouvelle', 'preparation', 'prete')
       GROUP BY o.id, c.name, c.phone
       ORDER BY 
         CASE o.status 
           WHEN 'nouvelle' THEN 1 
           WHEN 'preparation' THEN 2 
           WHEN 'prete' THEN 3 
         END,
         o.created_at DESC`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get active orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour le statut d'une commande
router.put('/orders/:id/status', [
  body('status').isIn(['preparation', 'prete', 'annulee']).withMessage('Statut invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;
    const restaurantId = req.user.role === 'admin' ? null : req.user.id;

    // Vérifier que la commande appartient au restaurant
    let query = 'SELECT * FROM orders WHERE id = $1';
    const params = [id];

    if (restaurantId) {
      query += ' AND restaurant_id = $2';
      params.push(restaurantId);
    }

    const orderCheck = await pool.query(query, params);

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = orderCheck.rows[0];

    // Vérifier les transitions de statut valides
    const validTransitions = {
      'nouvelle': ['preparation', 'annulee'],
      'preparation': ['prete', 'annulee'],
      'prete': [],
      'annulee': [],
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({ error: 'Transition de statut non autorisée' });
    }

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    // Créer notification pour le client
    const statusMessages = {
      'preparation': 'Votre commande est en préparation',
      'prete': 'Votre commande est prête',
      'annulee': 'Votre commande a été annulée',
    };

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'order_update', 'Mise à jour commande', $2, $3)`,
      [order.client_id, statusMessages[status], JSON.stringify({ order_id: id, status })]
    );

    // Émettre via Socket.IO vers le client
    if (req.io) {
      req.io.to(`user_${order.client_id}`).emit('order_status_changed', {
        orderId: parseInt(id),
        status,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      message: 'Statut mis à jour',
      order: result.rows[0],
    });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer le menu du restaurant
router.get('/menu', async (req, res) => {
  try {
    const restaurantId = req.user.role === 'admin' ? req.query.restaurant_id : req.user.id;

    const result = await pool.query(
      `SELECT id, name, description, price, image_url, category, is_available, created_at
       FROM menu_items 
       WHERE restaurant_id = $1
       ORDER BY category, name`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get menu error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un plat au menu
router.post('/menu', [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('price').isFloat({ min: 0 }).withMessage('Prix invalide'),
  body('category').trim().notEmpty().withMessage('Catégorie requise'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, image_url, category } = req.body;
    const restaurantId = req.user.role === 'admin' ? req.body.restaurant_id : req.user.id;

    const result = await pool.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, image_url, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [restaurantId, name, description, price, image_url, category]
    );

    res.status(201).json({
      message: 'Plat ajouté avec succès',
      item: result.rows[0],
    });
  } catch (err) {
    console.error('Add menu item error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un plat
router.put('/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, image_url, category, is_available } = req.body;
    const restaurantId = req.user.role === 'admin' ? null : req.user.id;

    let query = 'SELECT * FROM menu_items WHERE id = $1';
    const params = [id];

    if (restaurantId) {
      query += ' AND restaurant_id = $2';
      params.push(restaurantId);
    }

    const checkResult = await pool.query(query, params);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plat non trouvé' });
    }

    const result = await pool.query(
      `UPDATE menu_items 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           image_url = COALESCE($4, image_url),
           category = COALESCE($5, category),
           is_available = COALESCE($6, is_available)
       WHERE id = $7
       RETURNING *`,
      [name, description, price, image_url, category, is_available, id]
    );

    res.json({
      message: 'Plat mis à jour',
      item: result.rows[0],
    });
  } catch (err) {
    console.error('Update menu item error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un plat
router.delete('/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user.role === 'admin' ? null : req.user.id;

    let query = 'SELECT * FROM menu_items WHERE id = $1';
    const params = [id];

    if (restaurantId) {
      query += ' AND restaurant_id = $2';
      params.push(restaurantId);
    }

    const checkResult = await pool.query(query, params);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plat non trouvé' });
    }

    await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);

    res.json({ message: 'Plat supprimé avec succès' });
  } catch (err) {
    console.error('Delete menu item error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Statistiques du restaurant
router.get('/stats', async (req, res) => {
  try {
    const restaurantId = req.user.role === 'admin' ? req.query.restaurant_id : req.user.id;

    // Revenus totaux
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue,
              COUNT(*) as total_orders
       FROM orders 
       WHERE restaurant_id = $1 AND status = 'livree'`,
      [restaurantId]
    );

    // Commandes aujourd'hui
    const todayResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as today_revenue,
              COUNT(*) as today_orders
       FROM orders 
       WHERE restaurant_id = $1 
       AND status = 'livree'
       AND DATE(created_at) = CURRENT_DATE`,
      [restaurantId]
    );

    // Commandes en cours
    const activeResult = await pool.query(
      `SELECT COUNT(*) as active_orders
       FROM orders 
       WHERE restaurant_id = $1 AND status IN ('nouvelle', 'preparation', 'prete')`,
      [restaurantId]
    );

    res.json({
      total: revenueResult.rows[0],
      today: todayResult.rows[0],
      active: activeResult.rows[0],
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les horaires du restaurant
router.get('/hours', async (req, res) => {
  try {
    const restaurantId = req.user.role === 'admin' ? req.query.restaurant_id : req.user.id;

    const result = await pool.query(
      `SELECT id, day_of_week, open_time, close_time
       FROM restaurant_hours
       WHERE restaurant_id = $1
       ORDER BY day_of_week`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get hours error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour les horaires (tableau de jours)
router.put('/hours', [
  body('hours').isArray().withMessage('Tableau d\'horaires requis'),
  body('hours.*.day_of_week').isInt({ min: 0, max: 6 }).withMessage('Jour invalide (0-6)'),
  body('hours.*.open_time').matches(/^\d{2}:\d{2}$/).withMessage('Format heure invalide (HH:MM)'),
  body('hours.*.close_time').matches(/^\d{2}:\d{2}$/).withMessage('Format heure invalide (HH:MM)'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const restaurantId = req.user.role === 'admin' ? req.body.restaurant_id : req.user.id;
    const { hours } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Supprimer les horaires existants
      await client.query(
        'DELETE FROM restaurant_hours WHERE restaurant_id = $1',
        [restaurantId]
      );

      // Insérer les nouveaux horaires
      for (const h of hours) {
        await client.query(
          `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, $3, $4)`,
          [restaurantId, h.day_of_week, h.open_time, h.close_time]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Horaires mis à jour avec succès' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update hours error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Analytique détaillée (graphiques Chart.js)
router.get('/analytics', async (req, res) => {
  try {
    const restaurantId = req.user.role === 'admin' ? req.query.restaurant_id : req.user.id;
    const { period } = req.query; // '7d', '30d', '90d'

    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;

    // Revenus par jour
    const revenueByDay = await pool.query(
      `SELECT DATE(created_at) as date,
              COUNT(*) as orders,
              COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE restaurant_id = $1 AND status = 'livree'
       AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [restaurantId, days]
    );

    // Top plats vendus
    const topDishes = await pool.query(
      `SELECT m.name, SUM(oi.quantity) as total_sold,
              SUM(oi.quantity * oi.price_at_time) as total_revenue
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 AND o.status = 'livree'
       AND o.created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
       GROUP BY m.id, m.name
       ORDER BY total_sold DESC
       LIMIT 10`,
      [restaurantId, days]
    );

    // Heures de pointe
    const peakHours = await pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour,
              COUNT(*) as order_count
       FROM orders
       WHERE restaurant_id = $1 AND status = 'livree'
       AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [restaurantId, days]
    );

    // Répartition par moyen de paiement
    const paymentMethods = await pool.query(
      `SELECT payment_method, COUNT(*) as count,
              COALESCE(SUM(total_amount), 0) as total
       FROM orders
       WHERE restaurant_id = $1 AND status = 'livree'
       AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
       GROUP BY payment_method`,
      [restaurantId, days]
    );

    res.json({
      period: `${days}d`,
      revenue_by_day: revenueByDay.rows,
      top_dishes: topDishes.rows,
      peak_hours: peakHours.rows,
      payment_methods: paymentMethods.rows,
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Gérer le menu du jour (plats temporaires)
router.post('/menu/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { available_from, available_until } = req.body;
    const restaurantId = req.user.role === 'admin' ? null : req.user.id;

    let query = 'SELECT id FROM menu_items WHERE id = $1';
    const params = [id];
    if (restaurantId) {
      query += ' AND restaurant_id = $2';
      params.push(restaurantId);
    }

    const check = await pool.query(query, params);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Plat non trouvé' });
    }

    const result = await pool.query(
      `UPDATE menu_items SET available_from = $1, available_until = $2 WHERE id = $3 RETURNING *`,
      [available_from || null, available_until || null, id]
    );

    res.json({ message: 'Disponibilité programmée', item: result.rows[0] });
  } catch (err) {
    console.error('Schedule menu item error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
