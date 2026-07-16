const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// POST /tips - Give a tip to courier
router.post('/', [
  body('order_id').isInt(),
  body('amount').isFloat({ min: 100 }).withMessage('Pourboire minimum 100 FCFA'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { order_id, amount } = req.body;

    const order = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND client_id = $2 AND status = 'livree'",
      [order_id, req.user.id]
    );
    if (order.rows.length === 0) return res.status(404).json({ error: 'Commande non trouvée' });
    if (!order.rows[0].courier_id) return res.status(400).json({ error: 'Pas de livreur assigné' });

    // Check if already tipped
    const existing = await pool.query('SELECT id FROM tips WHERE order_id = $1 AND user_id = $2', [order_id, req.user.id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Pourboire déjà donné pour cette commande' });

    const result = await pool.query(
      'INSERT INTO tips (order_id, user_id, courier_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [order_id, req.user.id, order.rows[0].courier_id, amount]
    );

    await pool.query('UPDATE orders SET tip_amount = $1 WHERE id = $2', [amount, order_id]);

    res.status(201).json({ message: 'Pourboire envoyé', tip: result.rows[0] });
  } catch (err) {
    console.error('Create tip error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /tips/courier - Courier: get my tips
router.get('/courier', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, o.restaurant_id, u.name as client_name
       FROM tips t JOIN orders o ON t.order_id = o.id JOIN users u ON t.user_id = u.id
       WHERE t.courier_id = $1 ORDER BY t.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const total = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM tips WHERE courier_id = $1', [req.user.id]);
    res.json({ tips: result.rows, total: parseFloat(total.rows[0].total) });
  } catch (err) {
    console.error('Get courier tips error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
