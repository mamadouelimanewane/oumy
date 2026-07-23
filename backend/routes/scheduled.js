const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getSettings } = require('../lib/settings');
const { calculateDeliveryFee } = require('../lib/delivery');

const router = express.Router();

// Créer une commande programmée
router.post('/orders', authenticate, [
  body('restaurant_id').isInt().withMessage('ID restaurant requis'),
  body('items').isArray({ min: 1 }).withMessage('Au moins un article requis'),
  body('delivery_address').trim().notEmpty().withMessage('Adresse de livraison requise'),
  body('payment_method').isIn(['wave', 'orange_money', 'cash']).withMessage('Méthode de paiement invalide'),
  body('scheduled_for').isISO8601().withMessage('Date de livraison programmée requise (format ISO 8601)'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { restaurant_id, items, delivery_address, latitude, longitude, payment_method, promo_code, scheduled_for } = req.body;
    const client_id = req.user.id;

    // Vérifier que scheduled_for est au moins 1 heure dans le futur
    const scheduledDate = new Date(scheduled_for);
    const minDate = new Date(Date.now() + 60 * 60 * 1000);
    if (scheduledDate < minDate) {
      return res.status(400).json({ error: 'La commande programmée doit être au moins 1 heure dans le futur' });
    }

    // Vérifier que le restaurant existe
    const restaurantCheck = await pool.query(
      'SELECT id, latitude, longitude FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [restaurant_id, 'restaurant']
    );

    if (restaurantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }
    const restaurant = restaurantCheck.rows[0];

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

    // Appliquer code promo si fourni
    let discount_amount = 0;
    let applied_promo = null;
    if (promo_code) {
      const promoResult = await pool.query(
        `SELECT * FROM promotions
         WHERE code = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (max_uses = 0 OR current_uses < max_uses)`,
        [promo_code.toUpperCase()]
      );

      if (promoResult.rows.length > 0) {
        const promo = promoResult.rows[0];
        if ((!promo.restaurant_id || promo.restaurant_id === parseInt(restaurant_id)) &&
            total_amount >= parseFloat(promo.min_order_amount)) {
          if (promo.discount_type === 'percentage') {
            discount_amount = Math.round(total_amount * parseFloat(promo.discount_value) / 100);
          } else {
            discount_amount = parseFloat(promo.discount_value);
          }
          discount_amount = Math.min(discount_amount, total_amount);
          applied_promo = promo.code;
        }
      }
    }

    const final_amount = total_amount - discount_amount;
    const settings = await getSettings();
    const delivery_fee = calculateDeliveryFee(restaurant.latitude, restaurant.longitude, latitude, longitude, settings.delivery_fee_base, settings.delivery_fee_per_km);

    // Créer la commande programmée
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      // Créer la commande avec status 'nouvelle' et scheduled_for
      const orderResult = await dbClient.query(
        `INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address, latitude, longitude, discount_amount, promo_code, scheduled_for, delivery_fee, restaurant_commission_pct, courier_commission_pct)
         VALUES ($1, $2, 'nouvelle', $3, $4, 'en_attente', $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [client_id, restaurant_id, final_amount, payment_method, delivery_address, latitude, longitude, discount_amount, applied_promo, scheduledDate, delivery_fee, settings.commission_restaurant_pct, settings.commission_courier_pct]
      );

      // Incrémenter l'utilisation du code promo
      if (applied_promo) {
        await dbClient.query(
          'UPDATE promotions SET current_uses = current_uses + 1 WHERE code = $1',
          [applied_promo]
        );
      }

      const order = orderResult.rows[0];

      // Insérer les articles de la commande
      for (const item of orderItems) {
        await dbClient.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
          [order.id, item.menu_item_id, item.quantity, item.price_at_time]
        );
      }

      // Créer l'entrée dans scheduled_orders
      await dbClient.query(
        `INSERT INTO scheduled_orders (order_id, client_id, scheduled_for, status)
         VALUES ($1, $2, $3, 'programmee')`,
        [order.id, client_id, scheduledDate]
      );

      // Créer une notification pour le client
      await dbClient.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'scheduled_order', 'Commande programmée', $2, $3)`,
        [client_id, `Votre commande est programmée pour le ${scheduledDate.toLocaleString('fr-FR')}`, JSON.stringify({ order_id: order.id, scheduled_for: scheduled_for })]
      );

      await dbClient.query('COMMIT');

      res.status(201).json({
        message: 'Commande programmée créée avec succès',
        order: {
          ...order,
          items: orderItems,
          scheduled_for: scheduledDate,
        },
      });
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }
  } catch (err) {
    console.error('Create scheduled order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les commandes programmées du client connecté
router.get('/orders', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, so.scheduled_for as scheduled_time, so.status as scheduled_status,
              r.name as restaurant_name,
              json_agg(json_build_object(
                'id', oi.id,
                'name', m.name,
                'quantity', oi.quantity,
                'price', oi.price_at_time
              )) as items
       FROM orders o
       JOIN scheduled_orders so ON so.order_id = o.id
       JOIN users r ON o.restaurant_id = r.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE so.client_id = $1
       GROUP BY o.id, so.id, r.name
       ORDER BY so.scheduled_for DESC`,
      [req.user.id]
    );

    res.json({ scheduled_orders: result.rows });
  } catch (err) {
    console.error('Get scheduled orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Annuler une commande programmée (seulement si pas encore traitée)
router.put('/orders/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const orderCheck = await pool.query(
      `SELECT o.*, so.status as scheduled_status, so.id as scheduled_id
       FROM orders o
       JOIN scheduled_orders so ON so.order_id = o.id
       WHERE o.id = $1 AND o.client_id = $2`,
      [id, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Commande programmée non trouvée' });
    }

    const order = orderCheck.rows[0];

    if (order.scheduled_status !== 'programmee') {
      return res.status(400).json({ error: 'Seules les commandes programmées en attente peuvent être annulées' });
    }

    // Mettre à jour le statut de la commande et de la commande programmée
    await pool.query(
      `UPDATE orders SET status = 'annulee', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    await pool.query(
      `UPDATE scheduled_orders SET status = 'annulee', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [order.scheduled_id]
    );

    // Notifier le restaurant
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'order_cancelled', 'Commande programmée annulée', 'Le client a annulé sa commande programmée', $2)`,
      [order.restaurant_id, JSON.stringify({ order_id: id })]
    );

    // Émettre via Socket.IO
    if (req.io) {
      req.io.to(`user_${order.restaurant_id}`).emit('order_cancelled', {
        orderId: parseInt(id),
        message: 'Le client a annulé sa commande programmée',
      });
    }

    res.json({ message: 'Commande programmée annulée avec succès' });
  } catch (err) {
    console.error('Cancel scheduled order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les commandes programmées en attente de traitement (pour cron/admin)
router.get('/pending', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, so.scheduled_for as scheduled_time, so.status as scheduled_status,
              r.name as restaurant_name, c.name as client_name, c.phone as client_phone,
              json_agg(json_build_object(
                'id', oi.id,
                'name', m.name,
                'quantity', oi.quantity,
                'price', oi.price_at_time
              )) as items
       FROM orders o
       JOIN scheduled_orders so ON so.order_id = o.id
       JOIN users r ON o.restaurant_id = r.id
       JOIN users c ON o.client_id = c.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE so.scheduled_for <= CURRENT_TIMESTAMP
         AND so.status = 'programmee'
       GROUP BY o.id, so.id, r.name, c.name, c.phone
       ORDER BY so.scheduled_for ASC`
    );

    res.json({ pending_orders: result.rows });
  } catch (err) {
    console.error('Get pending scheduled orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
