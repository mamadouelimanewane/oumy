const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Récupérer tous les restaurants actifs
router.get('/restaurants', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.address, u.created_at,
              COUNT(m.id) as menu_count
       FROM users u
       LEFT JOIN menu_items m ON m.restaurant_id = u.id AND m.is_available = true
       WHERE u.role = 'restaurant' AND u.is_active = true
       GROUP BY u.id
       ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get restaurants error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer un restaurant avec son menu
router.get('/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const restaurantResult = await pool.query(
      'SELECT id, name, address, phone, created_at FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [id, 'restaurant']
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const menuResult = await pool.query(
      `SELECT id, name, description, price, image_url, category, is_available
       FROM menu_items 
       WHERE restaurant_id = $1 AND is_available = true
       ORDER BY category, name`,
      [id]
    );

    res.json({
      ...restaurantResult.rows[0],
      menu: menuResult.rows,
    });
  } catch (err) {
    console.error('Get restaurant error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer tous les plats (avec filtres optionnels)
router.get('/plats', async (req, res) => {
  try {
    const { category, restaurant_id, search } = req.query;
    
    let query = `
      SELECT m.id, m.restaurant_id, m.name, m.description, m.price, 
             m.image_url, m.category, r.name as restaurant_name
      FROM menu_items m
      JOIN users r ON m.restaurant_id = r.id
      WHERE m.is_available = true AND r.is_active = true
    `;
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND m.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (restaurant_id) {
      query += ` AND m.restaurant_id = $${paramIndex}`;
      params.push(restaurant_id);
      paramIndex++;
    }

    if (search) {
      query += ` AND (m.name ILIKE $${paramIndex} OR m.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY m.category, m.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get plats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une commande (nécessite authentification)
router.post('/orders', authenticate, [
  body('restaurant_id').isInt().withMessage('ID restaurant requis'),
  body('items').isArray({ min: 1 }).withMessage('Au moins un article requis'),
  body('delivery_address').trim().notEmpty().withMessage('Adresse de livraison requise'),
  body('payment_method').isIn(['wave', 'orange_money', 'cash']).withMessage('Méthode de paiement invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { restaurant_id, items, delivery_address, latitude, longitude, payment_method } = req.body;
    const client_id = req.user.id;

    // Vérifier que le restaurant existe
    const restaurantCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [restaurant_id, 'restaurant']
    );

    if (restaurantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    // Calculer le total et vérifier les articles
    let total_amount = 0;
    const orderItems = [];

    for (const item of items) {
      const menuResult = await pool.query(
        'SELECT price, is_available, restaurant_id FROM menu_items WHERE id = $1',
        [item.menu_item_id]
      );

      if (menuResult.rows.length === 0) {
        return res.status(404).json({ error: `Article ${item.menu_item_id} non trouvé` });
      }

      const menuItem = menuResult.rows[0];
      
      if (!menuItem.is_available) {
        return res.status(400).json({ error: `Article ${item.menu_item_id} non disponible` });
      }

      if (menuItem.restaurant_id !== parseInt(restaurant_id)) {
        return res.status(400).json({ error: 'Tous les articles doivent être du même restaurant' });
      }

      const itemTotal = menuItem.price * item.quantity;
      total_amount += itemTotal;
      orderItems.push({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price_at_time: menuItem.price,
      });
    }

    // Créer la commande
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address, latitude, longitude)
         VALUES ($1, $2, 'nouvelle', $3, $4, 'en_attente', $5, $6, $7)
         RETURNING *`,
        [client_id, restaurant_id, total_amount, payment_method, delivery_address, latitude, longitude]
      );

      const order = orderResult.rows[0];

      // Insérer les articles de la commande
      for (const item of orderItems) {
        await client.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
          [order.id, item.menu_item_id, item.quantity, item.price_at_time]
        );
      }

      // Créer une notification pour le restaurant
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'new_order', 'Nouvelle commande', 'Vous avez reçu une nouvelle commande', $2)`,
        [restaurant_id, JSON.stringify({ order_id: order.id })]
      );

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Commande créée avec succès',
        order: {
          ...order,
          items: orderItems,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les commandes du client connecté
router.get('/orders', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, r.name as restaurant_name,
              json_agg(json_build_object(
                'id', oi.id,
                'name', m.name,
                'quantity', oi.quantity,
                'price', oi.price_at_time
              )) as items
       FROM orders o
       JOIN users r ON o.restaurant_id = r.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.client_id = $1
       GROUP BY o.id, r.name
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get client orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Suivi d'une commande
router.get('/orders/:id/track', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              c.name as courier_name, c.phone as courier_phone,
              cl.latitude as courier_lat, cl.longitude as courier_lng
       FROM orders o
       JOIN users r ON o.restaurant_id = r.id
       LEFT JOIN users c ON o.courier_id = c.id
       LEFT JOIN courier_locations cl ON cl.courier_id = o.courier_id
       WHERE o.id = $1 AND (o.client_id = $2 OR o.restaurant_id = $2 OR o.courier_id = $2)`,
      [id, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json(orderResult.rows[0]);
  } catch (err) {
    console.error('Track order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
