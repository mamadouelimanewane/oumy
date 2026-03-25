const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.use(authenticate);

// POST / - Create split payment
router.post('/', [
  body('order_id').isInt().withMessage('ID commande requis'),
  body('splits').isArray({ min: 2 }).withMessage('Au moins 2 participants requis'),
  body('splits.*.user_id').isInt().withMessage('ID utilisateur invalide'),
  body('splits.*.amount').isFloat({ min: 0 }).withMessage('Montant invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { order_id, splits } = req.body;

    // Verify order exists and belongs to user
    const order = await pool.query(
      `SELECT id, total_amount, client_id FROM orders WHERE id = $1`,
      [order_id]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvee' });
    }

    // Verify total of splits matches order total
    const splitTotal = splits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const orderTotal = parseFloat(order.rows[0].total_amount);

    if (Math.abs(splitTotal - orderTotal) > 0.01) {
      return res.status(400).json({
        error: 'Le total des parts ne correspond pas au total de la commande',
        order_total: orderTotal,
        split_total: splitTotal
      });
    }

    // Check if split already exists
    const existing = await pool.query(
      `SELECT id FROM split_payments WHERE order_id = $1`,
      [order_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Un partage de paiement existe deja pour cette commande' });
    }

    // Create split payment
    const splitPayment = await pool.query(
      `INSERT INTO split_payments (order_id, created_by, total_amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [order_id, req.user.id, orderTotal]
    );

    // Create individual shares
    for (const split of splits) {
      await pool.query(
        `INSERT INTO split_payment_shares (split_payment_id, user_id, amount, status)
         VALUES ($1, $2, $3, 'pending')`,
        [splitPayment.rows[0].id, split.user_id, split.amount]
      );

      // Notify each participant
      if (req.io && split.user_id !== req.user.id) {
        req.io.to(`user_${split.user_id}`).emit('split_payment_request', {
          split_payment_id: splitPayment.rows[0].id,
          order_id,
          amount: split.amount,
          requested_by: req.user.name || req.user.id
        });
      }
    }

    res.status(201).json({
      message: 'Partage de paiement cree',
      split_payment: splitPayment.rows[0]
    });
  } catch (err) {
    console.error('Create split payment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /:orderId - Get split payment status
router.get('/:orderId', async (req, res) => {
  try {
    const splitPayment = await pool.query(
      `SELECT * FROM split_payments WHERE order_id = $1`,
      [req.params.orderId]
    );

    if (splitPayment.rows.length === 0) {
      return res.status(404).json({ error: 'Partage de paiement non trouve' });
    }

    const shares = await pool.query(
      `SELECT sps.*, u.name as user_name, u.phone
       FROM split_payment_shares sps
       JOIN users u ON u.id = sps.user_id
       WHERE sps.split_payment_id = $1
       ORDER BY sps.id`,
      [splitPayment.rows[0].id]
    );

    const paidCount = shares.rows.filter(s => s.status === 'paid').length;
    const totalShares = shares.rows.length;

    res.json({
      split_payment: splitPayment.rows[0],
      shares: shares.rows,
      progress: {
        paid: paidCount,
        total: totalShares,
        is_complete: paidCount === totalShares
      }
    });
  } catch (err) {
    console.error('Get split payment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:orderId/pay-share - Pay your share
router.post('/:orderId/pay-share', async (req, res) => {
  try {
    const splitPayment = await pool.query(
      `SELECT * FROM split_payments WHERE order_id = $1`,
      [req.params.orderId]
    );

    if (splitPayment.rows.length === 0) {
      return res.status(404).json({ error: 'Partage de paiement non trouve' });
    }

    // Find user's share
    const share = await pool.query(
      `SELECT * FROM split_payment_shares
       WHERE split_payment_id = $1 AND user_id = $2`,
      [splitPayment.rows[0].id, req.user.id]
    );

    if (share.rows.length === 0) {
      return res.status(404).json({ error: 'Vous ne faites pas partie de ce partage' });
    }

    if (share.rows[0].status === 'paid') {
      return res.status(400).json({ error: 'Votre part a deja ete payee' });
    }

    // Mark share as paid
    await pool.query(
      `UPDATE split_payment_shares SET status = 'paid', paid_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [share.rows[0].id]
    );

    // Check if all shares are paid
    const remaining = await pool.query(
      `SELECT COUNT(*) as unpaid FROM split_payment_shares
       WHERE split_payment_id = $1 AND status = 'pending'`,
      [splitPayment.rows[0].id]
    );

    if (parseInt(remaining.rows[0].unpaid) === 0) {
      // All paid - update split payment and order payment status
      await pool.query(
        `UPDATE split_payments SET status = 'completed' WHERE id = $1`,
        [splitPayment.rows[0].id]
      );
      await pool.query(
        `UPDATE orders SET payment_status = 'paye' WHERE id = $1`,
        [req.params.orderId]
      );
    }

    // Notify the creator
    if (req.io) {
      req.io.to(`user_${splitPayment.rows[0].created_by}`).emit('split_share_paid', {
        order_id: parseInt(req.params.orderId),
        user_id: req.user.id,
        amount: share.rows[0].amount
      });
    }

    res.json({
      message: 'Votre part a ete payee',
      amount_paid: share.rows[0].amount,
      all_paid: parseInt(remaining.rows[0].unpaid) === 0
    });
  } catch (err) {
    console.error('Pay share error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
