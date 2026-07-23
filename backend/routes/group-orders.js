const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const { getSettings } = require('../lib/settings');
const { calculateDeliveryFee } = require('../lib/delivery');

const router = express.Router();

router.use(authenticate);

// POST / - Create a group order
router.post('/', [
  body('restaurant_id').isInt().withMessage('Restaurant ID requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { restaurant_id } = req.body;

    // Verify restaurant exists
    const restaurant = await pool.query(
      `SELECT id, name FROM users WHERE id = $1 AND role = 'restaurant' AND is_active = true`,
      [restaurant_id]
    );

    if (restaurant.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouve' });
    }

    const shareCode = 'GRP' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const groupOrder = await pool.query(
      `INSERT INTO group_orders (creator_id, share_code, restaurant_id, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING *`,
      [req.user.id, shareCode, restaurant_id]
    );

    res.status(201).json({
      group_order: groupOrder.rows[0],
      share_link: `/group-order/${shareCode}`,
      message: 'Commande groupee creee ! Partagez le lien avec vos amis.'
    });
  } catch (err) {
    console.error('Create group order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /:id - Get group order details with all participants' items
router.get('/:id', async (req, res) => {
  try {
    const groupOrder = await pool.query(
      `SELECT go.*, u.name as creator_name, ur.name as restaurant_name
       FROM group_orders go
       JOIN users u ON u.id = go.creator_id
       JOIN users ur ON ur.id = go.restaurant_id
       WHERE go.id = $1`,
      [req.params.id]
    );

    if (groupOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Commande groupee non trouvee' });
    }

    // Get all items grouped by participant
    const items = await pool.query(
      `SELECT goi.*, mi.name as item_name, mi.price, mi.image_url,
              u.name as user_name
       FROM group_order_items goi
       JOIN menu_items mi ON mi.id = goi.menu_item_id
       JOIN users u ON u.id = goi.user_id
       WHERE goi.group_order_id = $1
       ORDER BY goi.user_id, goi.created_at`,
      [req.params.id]
    );

    // Group items by participant
    const participants = {};
    items.rows.forEach(item => {
      if (!participants[item.user_id]) {
        participants[item.user_id] = {
          user_id: item.user_id,
          user_name: item.user_name,
          items: [],
          subtotal: 0
        };
      }
      const itemTotal = parseFloat(item.price) * item.quantity;
      participants[item.user_id].items.push(item);
      participants[item.user_id].subtotal += itemTotal;
    });

    const totalAmount = Object.values(participants).reduce((sum, p) => sum + p.subtotal, 0);

    res.json({
      group_order: groupOrder.rows[0],
      participants: Object.values(participants),
      total_amount: totalAmount
    });
  } catch (err) {
    console.error('Get group order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:id/join - Join a group order and add items
router.post('/:id/join', [
  body('items').isArray({ min: 1 }).withMessage('Au moins un article requis'),
  body('items.*.menu_item_id').isInt().withMessage('ID article invalide'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantite invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const groupOrder = await pool.query(
      `SELECT * FROM group_orders WHERE id = $1 AND status = 'open'`,
      [req.params.id]
    );

    if (groupOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Commande groupee non trouvee ou deja finalisee' });
    }

    const { items } = req.body;

    // Remove existing items from this user (allow re-joining with new items)
    await pool.query(
      `DELETE FROM group_order_items WHERE group_order_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    // Add new items
    for (const item of items) {
      // Verify item belongs to the group order's restaurant
      const menuItem = await pool.query(
        `SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2 AND is_available = true`,
        [item.menu_item_id, groupOrder.rows[0].restaurant_id]
      );

      if (menuItem.rows.length === 0) {
        return res.status(400).json({ error: `Article ${item.menu_item_id} non disponible` });
      }

      await pool.query(
        `INSERT INTO group_order_items (group_order_id, user_id, menu_item_id, quantity)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, req.user.id, item.menu_item_id, item.quantity]
      );
    }

    res.json({ message: 'Vous avez rejoint la commande groupee' });
  } catch (err) {
    console.error('Join group order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:id/finalize - Finalize and place the group order
router.post('/:id/finalize', [
  body('delivery_address').trim().notEmpty().withMessage('Adresse de livraison requise'),
  body('payment_method').isIn(['wave', 'orange_money', 'cash']).withMessage('Methode de paiement invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const groupOrder = await pool.query(
      `SELECT * FROM group_orders WHERE id = $1 AND creator_id = $2 AND status = 'open'`,
      [req.params.id, req.user.id]
    );

    if (groupOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Commande groupee non trouvee ou vous n etes pas le createur' });
    }

    // Get all items with prices
    const items = await pool.query(
      `SELECT goi.*, mi.price
       FROM group_order_items goi
       JOIN menu_items mi ON mi.id = goi.menu_item_id
       WHERE goi.group_order_id = $1`,
      [req.params.id]
    );

    if (items.rows.length === 0) {
      return res.status(400).json({ error: 'Aucun article dans la commande groupee' });
    }

    const totalAmount = items.rows.reduce(
      (sum, item) => sum + (parseFloat(item.price) * item.quantity), 0
    );

    const { delivery_address, payment_method, latitude, longitude } = req.body;

    const restaurantResult = await pool.query(
      'SELECT latitude, longitude FROM users WHERE id = $1',
      [groupOrder.rows[0].restaurant_id]
    );
    const settings = await getSettings();
    const deliveryFee = calculateDeliveryFee(
      restaurantResult.rows[0]?.latitude, restaurantResult.rows[0]?.longitude, latitude, longitude,
      settings.delivery_fee_base, settings.delivery_fee_per_km
    );

    // Create actual order
    const newOrder = await pool.query(
      `INSERT INTO orders (client_id, restaurant_id, status, total_amount, delivery_fee,
        delivery_address, latitude, longitude, payment_method, payment_status,
        restaurant_commission_pct, courier_commission_pct)
       VALUES ($1, $2, 'nouvelle', $3, $4, $5, $6, $7, $8, 'en_attente', $9, $10)
       RETURNING *`,
      [
        req.user.id, groupOrder.rows[0].restaurant_id, totalAmount, deliveryFee,
        delivery_address, latitude || null, longitude || null, payment_method,
        settings.commission_restaurant_pct, settings.commission_courier_pct
      ]
    );

    // Copy items to order_items
    for (const item of items.rows) {
      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
         VALUES ($1, $2, $3, $4)`,
        [newOrder.rows[0].id, item.menu_item_id, item.quantity, item.price]
      );
    }

    // Mark group order as finalized
    await pool.query(
      `UPDATE group_orders SET status = 'finalized' WHERE id = $1`,
      [req.params.id]
    );

    res.json({
      message: 'Commande groupee finalisee !',
      order: newOrder.rows[0]
    });
  } catch (err) {
    console.error('Finalize group order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
