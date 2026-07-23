const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { addOrderPoints } = require('./loyalty');

const router = express.Router();

// Middleware: uniquement pour les livreurs
router.use(authenticate);
router.use(authorize('livreur', 'admin'));

// Mettre à jour la position GPS du livreur
router.post('/location', [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { latitude, longitude } = req.body;
    const courierId = req.user.id;

    // Upsert de la position. $2/$3 repetes en $4/$5 (pas reutilises tels
    // quels) : le shim SQLite du dev local traduit chaque occurrence de $N en
    // un ? positionnel distinct et n'accepte pas la reutilisation Postgres
    // d'un meme parametre numerote.
    await pool.query(
      `INSERT INTO courier_locations (courier_id, latitude, longitude, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (courier_id)
       DO UPDATE SET latitude = $4, longitude = $5, updated_at = CURRENT_TIMESTAMP`,
      [courierId, latitude, longitude, latitude, longitude]
    );

    res.json({ message: 'Position mise à jour' });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Basculer disponibilité (en ligne / hors ligne). Utilise une colonne dediee
// is_online, distincte de is_active (qui gere l'activation du compte par
// l'admin) — les confondre bloquerait la reconnexion d'un livreur qui vient
// de passer hors ligne (auth.js refuse le login si is_active = false).
router.put('/status', [
  body('is_online').isBoolean().withMessage('is_online doit etre un booleen'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { is_online } = req.body;
    await pool.query('UPDATE users SET is_online = $1 WHERE id = $2', [is_online, req.user.id]);

    res.json({ message: is_online ? 'Livreur en ligne' : 'Livreur hors ligne', is_online });
  } catch (err) {
    console.error('Update courier online status error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les commandes disponibles pour livraison
router.get('/orders/available', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              r.latitude as restaurant_lat, r.longitude as restaurant_lng,
              c.name as client_name, c.phone as client_phone,
              o.delivery_address, o.latitude, o.longitude,
              json_agg(json_build_object(
                'name', m.name,
                'quantity', oi.quantity
              )) as items
       FROM orders o
       JOIN users r ON o.restaurant_id = r.id
       JOIN users c ON o.client_id = c.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.status = 'prete' AND o.courier_id IS NULL
       GROUP BY o.id, r.name, r.address, r.latitude, r.longitude,
                c.name, c.phone
       ORDER BY o.created_at ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get available orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Accepter une commande pour livraison
router.post('/orders/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const courierId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vérifier que la commande est disponible
      const orderCheck = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND status = $2 AND courier_id IS NULL FOR UPDATE',
        [id, 'prete']
      );

      if (orderCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Commande non disponible' });
      }

      const order = orderCheck.rows[0];

      // Assigner le livreur
      await client.query(
        `UPDATE orders SET courier_id = $1, status = 'en_route', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [courierId, id]
      );

      // Notifier le client et le restaurant
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'courier_assigned', 'Livreur assigné', 'Un livreur a été assigné à votre commande', $2)`,
        [order.client_id, JSON.stringify({ order_id: id, courier_id: courierId })]
      );

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'order_picked_up', 'Commande en livraison', 'Votre commande est en cours de livraison', $2)`,
        [order.restaurant_id, JSON.stringify({ order_id: id, courier_id: courierId })]
      );

      await client.query('COMMIT');

      // Émettre via Socket.IO
      if (req.io) {
        req.io.to(`user_${order.client_id}`).emit('order_status_changed', {
          orderId: parseInt(id),
          status: 'en_route',
          courierName: req.user.name,
          timestamp: new Date().toISOString(),
        });
        req.io.to(`user_${order.restaurant_id}`).emit('order_status_changed', {
          orderId: parseInt(id),
          status: 'en_route',
          timestamp: new Date().toISOString(),
        });
      }

      res.json({ message: 'Commande acceptée', order_id: id });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Accept order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les commandes en cours du livreur
router.get('/orders/current', async (req, res) => {
  try {
    const courierId = req.user.id;

    const result = await pool.query(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              r.phone as restaurant_phone, r.latitude as restaurant_lat, r.longitude as restaurant_lng,
              c.name as client_name, c.phone as client_phone, o.delivery_address
       FROM orders o
       JOIN users r ON o.restaurant_id = r.id
       JOIN users c ON o.client_id = c.id
       WHERE o.courier_id = $1 AND o.status IN ('en_route', 'livree')
       ORDER BY o.updated_at DESC`,
      [courierId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get current orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer une commande comme livrée
router.post('/orders/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const courierId = req.user.id;

    const orderCheck = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND courier_id = $2 AND status = $3',
      [id, courierId, 'en_route']
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = orderCheck.rows[0];

    await pool.query(
      `UPDATE orders SET status = 'livree', payment_status = 'paye', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Ajouter des points de fidélité au client
    try {
      await addOrderPoints(order.client_id, id, order.total_amount);
    } catch (loyaltyErr) {
      console.error('Loyalty points error (non-blocking):', loyaltyErr);
    }

    // Notifier le client et le restaurant
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'order_delivered', 'Commande livrée', 'Votre commande a été livrée avec succès', $2)`,
      [order.client_id, JSON.stringify({ order_id: id })]
    );

    // Émettre via Socket.IO
    if (req.io) {
      req.io.to(`user_${order.client_id}`).emit('order_status_changed', {
        orderId: parseInt(id),
        status: 'livree',
        timestamp: new Date().toISOString(),
      });
      req.io.to(`user_${order.restaurant_id}`).emit('order_status_changed', {
        orderId: parseInt(id),
        status: 'livree',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ message: 'Commande marquée comme livrée' });
  } catch (err) {
    console.error('Complete order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Statistiques du livreur
router.get('/stats', async (req, res) => {
  try {
    const courierId = req.user.id;

    // Livraisons aujourd'hui (gains = delivery_fee net de la commission
    // plateforme figee sur chaque commande, ce que le livreur touche
    // reellement — meme convention que routes/payouts.js pour le calcul du
    // solde retirable)
    const todayResult = await pool.query(
      `SELECT COUNT(*) as deliveries,
              COALESCE(SUM(delivery_fee * (1 - COALESCE(courier_commission_pct, 0) / 100)), 0) as total_amount
       FROM orders
       WHERE courier_id = $1
       AND status = 'livree'
       AND DATE(updated_at) = CURRENT_DATE`,
      [courierId]
    );

    // Livraisons cette semaine
    const weekResult = await pool.query(
      `SELECT COUNT(*) as deliveries,
              COALESCE(SUM(delivery_fee * (1 - COALESCE(courier_commission_pct, 0) / 100)), 0) as total_amount
       FROM orders
       WHERE courier_id = $1
       AND status = 'livree'
       AND updated_at >= CURRENT_DATE - INTERVAL '7 days'`,
      [courierId]
    );

    // Total
    const totalResult = await pool.query(
      `SELECT COUNT(*) as deliveries,
              COALESCE(SUM(delivery_fee * (1 - COALESCE(courier_commission_pct, 0) / 100)), 0) as total_amount
       FROM orders
       WHERE courier_id = $1 AND status = 'livree'`,
      [courierId]
    );

    res.json({
      today: todayResult.rows[0],
      week: weekResult.rows[0],
      total: totalResult.rows[0],
    });
  } catch (err) {
    console.error('Get courier stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
