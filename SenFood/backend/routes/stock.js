const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('restaurant'));

// GET /stock - Get stock for all my menu items
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mi.id, mi.name, mi.category, mi.is_available,
       COALESCE(ms.quantity, -1) as stock_quantity,
       COALESCE(ms.low_stock_threshold, 5) as low_stock_threshold,
       COALESCE(ms.auto_disable, true) as auto_disable,
       CASE WHEN ms.quantity IS NOT NULL AND ms.quantity <= ms.low_stock_threshold THEN true ELSE false END as is_low_stock
       FROM menu_items mi LEFT JOIN menu_item_stock ms ON mi.id = ms.menu_item_id
       WHERE mi.restaurant_id = $1 ORDER BY mi.category, mi.name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get stock error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /stock/:menuItemId - Update stock for an item
router.put('/:menuItemId', [
  body('quantity').isInt({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { menuItemId } = req.params;
    const { quantity, low_stock_threshold, auto_disable } = req.body;

    // Verify ownership
    const item = await pool.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [menuItemId, req.user.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Plat non trouvé' });

    // Upsert stock
    const existing = await pool.query('SELECT id FROM menu_item_stock WHERE menu_item_id = $1', [menuItemId]);
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE menu_item_stock SET quantity = $1, low_stock_threshold = COALESCE($2, low_stock_threshold),
         auto_disable = COALESCE($3, auto_disable), updated_at = CURRENT_TIMESTAMP WHERE menu_item_id = $4`,
        [quantity, low_stock_threshold, auto_disable, menuItemId]
      );
    } else {
      await pool.query(
        'INSERT INTO menu_item_stock (menu_item_id, quantity, low_stock_threshold, auto_disable) VALUES ($1, $2, $3, $4)',
        [menuItemId, quantity, low_stock_threshold || 5, auto_disable !== undefined ? auto_disable : true]
      );
    }

    // Auto-disable if stock is 0
    if (quantity === 0 && (auto_disable === undefined || auto_disable)) {
      await pool.query('UPDATE menu_items SET is_available = false WHERE id = $1', [menuItemId]);
    } else if (quantity > 0) {
      await pool.query('UPDATE menu_items SET is_available = true WHERE id = $1', [menuItemId]);
    }

    res.json({ message: 'Stock mis à jour', quantity });
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stock/bulk-update - Bulk stock update
router.post('/bulk-update', [
  body('items').isArray({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { items } = req.body;
    let updated = 0;

    for (const item of items) {
      const menuItem = await pool.query('SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2', [item.menu_item_id, req.user.id]);
      if (menuItem.rows.length === 0) continue;

      const existing = await pool.query('SELECT id FROM menu_item_stock WHERE menu_item_id = $1', [item.menu_item_id]);
      if (existing.rows.length > 0) {
        await pool.query('UPDATE menu_item_stock SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE menu_item_id = $2', [item.quantity, item.menu_item_id]);
      } else {
        await pool.query('INSERT INTO menu_item_stock (menu_item_id, quantity) VALUES ($1, $2)', [item.menu_item_id, item.quantity]);
      }

      if (item.quantity === 0) {
        await pool.query('UPDATE menu_items SET is_available = false WHERE id = $1', [item.menu_item_id]);
      }
      updated++;
    }

    res.json({ message: `${updated} stocks mis à jour` });
  } catch (err) {
    console.error('Bulk stock update error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /stock/alerts - Get low stock alerts
router.get('/alerts', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mi.id, mi.name, mi.category, ms.quantity, ms.low_stock_threshold
       FROM menu_item_stock ms JOIN menu_items mi ON ms.menu_item_id = mi.id
       WHERE mi.restaurant_id = $1 AND ms.quantity <= ms.low_stock_threshold
       ORDER BY ms.quantity ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get stock alerts error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
