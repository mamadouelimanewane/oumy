const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.use(authenticate);

// GET / - Get user's price alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await pool.query(
      `SELECT pa.*, mi.name as item_name, mi.price as current_price,
              mi.image_url, u.name as restaurant_name
       FROM price_alerts pa
       JOIN menu_items mi ON mi.id = pa.menu_item_id
       JOIN users u ON u.id = mi.restaurant_id
       WHERE pa.user_id = $1
       ORDER BY pa.created_at DESC`,
      [req.user.id]
    );

    res.json({ alerts: alerts.rows });
  } catch (err) {
    console.error('Get price alerts error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST / - Create alert
router.post('/', [
  body('menu_item_id').isInt().withMessage('ID article requis'),
  body('target_price').isFloat({ min: 0 }).withMessage('Prix cible invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { menu_item_id, target_price } = req.body;

    // Verify menu item exists
    const item = await pool.query(
      `SELECT id, name, price FROM menu_items WHERE id = $1`,
      [menu_item_id]
    );

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Article non trouve' });
    }

    // Check if alert already exists for this item
    const existing = await pool.query(
      `SELECT id FROM price_alerts WHERE user_id = $1 AND menu_item_id = $2 AND is_active = true`,
      [req.user.id, menu_item_id]
    );

    if (existing.rows.length > 0) {
      // Update existing alert
      const updated = await pool.query(
        `UPDATE price_alerts SET target_price = $1 WHERE id = $2 RETURNING *`,
        [target_price, existing.rows[0].id]
      );
      return res.json({ alert: updated.rows[0], message: 'Alerte mise a jour' });
    }

    const alert = await pool.query(
      `INSERT INTO price_alerts (user_id, menu_item_id, target_price)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, menu_item_id, target_price]
    );

    res.status(201).json({
      alert: alert.rows[0],
      message: 'Alerte creee ! Vous serez notifie quand ' + item.rows[0].name + ' descend sous ' + target_price + ' FCFA'
    });
  } catch (err) {
    console.error('Create price alert error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:id - Remove alert
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM price_alerts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Alerte non trouvee' });
    }

    res.json({ message: 'Alerte supprimee' });
  } catch (err) {
    console.error('Delete price alert error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
