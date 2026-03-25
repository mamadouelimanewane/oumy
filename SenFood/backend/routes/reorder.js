const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET / - Get user's past orders for quick reorder
router.get('/', async (req, res) => {
  try {
    const orders = await pool.query(
      `SELECT o.id, o.restaurant_id, o.total_amount, o.delivery_address,
              o.latitude, o.longitude, o.payment_method, o.created_at,
              u.name as restaurant_name
       FROM orders o
       JOIN users u ON u.id = o.restaurant_id
       WHERE o.client_id = $1 AND o.status = 'livree'
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      orders.rows.map(async (order) => {
        const items = await pool.query(
          `SELECT oi.menu_item_id, oi.quantity, oi.price_at_time,
                  mi.name, mi.image_url, mi.is_available
           FROM order_items oi
           JOIN menu_items mi ON mi.id = oi.menu_item_id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        return { ...order, items: items.rows };
      })
    );

    res.json({ orders: ordersWithItems });
  } catch (err) {
    console.error('Reorder list error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:orderId - Clone an old order into a new one
router.post('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get original order
    const original = await pool.query(
      `SELECT * FROM orders WHERE id = $1 AND client_id = $2`,
      [orderId, req.user.id]
    );

    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Commande originale non trouvée' });
    }

    const orig = original.rows[0];

    // Get original items
    const origItems = await pool.query(
      `SELECT oi.menu_item_id, oi.quantity, mi.price, mi.is_available
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    // Check all items are still available
    const unavailable = origItems.rows.filter(item => !item.is_available);
    if (unavailable.length > 0) {
      return res.status(400).json({
        error: 'Certains articles ne sont plus disponibles',
        unavailable_items: unavailable.map(i => i.menu_item_id)
      });
    }

    // Calculate new total with current prices
    const totalAmount = origItems.rows.reduce(
      (sum, item) => sum + (parseFloat(item.price) * item.quantity), 0
    );

    // Create new order
    const newOrder = await pool.query(
      `INSERT INTO orders (client_id, restaurant_id, status, total_amount,
        delivery_fee, delivery_address, latitude, longitude, payment_method, payment_status)
       VALUES ($1, $2, 'nouvelle', $3, $4, $5, $6, $7, $8, 'en_attente')
       RETURNING *`,
      [
        req.user.id, orig.restaurant_id, totalAmount, orig.delivery_fee || 0,
        orig.delivery_address, orig.latitude, orig.longitude,
        orig.payment_method || 'cash'
      ]
    );

    // Clone items with current prices
    for (const item of origItems.rows) {
      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
         VALUES ($1, $2, $3, $4)`,
        [newOrder.rows[0].id, item.menu_item_id, item.quantity, item.price]
      );
    }

    res.status(201).json({
      message: 'Commande recréée avec succès',
      order: newOrder.rows[0]
    });
  } catch (err) {
    console.error('Reorder clone error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
