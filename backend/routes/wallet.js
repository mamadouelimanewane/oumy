const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

router.use(authenticate);

// Taux de cashback sur paiements wallet
const CASHBACK_RATE = 0.02; // 2%

// Obtenir le solde du wallet (creer si inexistant)
router.get('/balance', async (req, res) => {
  try {
    // Creer le wallet s'il n'existe pas
    await pool.query(
      `INSERT INTO wallets (user_id, balance)
       VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [req.user.id]
    );

    const result = await pool.query(
      'SELECT balance, updated_at FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      balance: parseFloat(result.rows[0].balance),
      updated_at: result.rows[0].updated_at,
    });
  } catch (err) {
    console.error('Get wallet balance error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Deposer de l'argent (Wave / Orange Money)
router.post('/deposit', [
  body('amount').isFloat({ min: 100 }).withMessage('Montant minimum 100 FCFA'),
  body('payment_method').isIn(['wave', 'orange_money']).withMessage('Methode de paiement invalide'),
  body('transaction_ref').trim().notEmpty().withMessage('Reference de transaction requise'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, payment_method, transaction_ref } = req.body;

    // Verifier que la reference n'a pas deja ete utilisee
    const existingRef = await pool.query(
      'SELECT id FROM wallet_transactions WHERE transaction_ref = $1',
      [transaction_ref]
    );

    if (existingRef.rows.length > 0) {
      return res.status(400).json({ error: 'Cette reference de transaction a deja ete utilisee' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Creer le wallet s'il n'existe pas
      await client.query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id]
      );

      // Crediter le wallet
      await client.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
        [amount, req.user.id]
      );

      // Enregistrer la transaction
      const txResult = await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, payment_method, transaction_ref, description, status)
         VALUES ($1, 'deposit', $2, $3, $4, $5, 'completed')
         RETURNING *`,
        [req.user.id, amount, payment_method, transaction_ref, `Depot via ${payment_method}`]
      );

      // Recuperer le nouveau solde
      const walletResult = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [req.user.id]
      );

      await client.query('COMMIT');

      res.json({
        message: `Depot de ${amount} FCFA effectue avec succes`,
        transaction: txResult.rows[0],
        new_balance: parseFloat(walletResult.rows[0].balance),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Reference de transaction dupliquee' });
    console.error('Wallet deposit error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retrait vers mobile money
router.post('/withdraw', [
  body('amount').isFloat({ min: 500 }).withMessage('Montant minimum de retrait 500 FCFA'),
  body('payment_method').isIn(['wave', 'orange_money']).withMessage('Methode de paiement invalide'),
  body('phone_number').matches(/^(\+221)?(7[0678]\d{7})$/).withMessage('Numero de telephone invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, payment_method, phone_number } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verifier le solde
      const walletResult = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [req.user.id]
      );

      if (walletResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Wallet introuvable' });
      }

      const balance = parseFloat(walletResult.rows[0].balance);

      if (amount > balance) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Solde insuffisant' });
      }

      // Debiter le wallet
      await client.query(
        'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
        [amount, req.user.id]
      );

      // Enregistrer la transaction (en attente de traitement)
      const txResult = await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, payment_method, phone_number, description, status)
         VALUES ($1, 'withdrawal', $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [req.user.id, amount, payment_method, phone_number, `Retrait vers ${payment_method} (${phone_number})`]
      );

      await client.query('COMMIT');

      res.json({
        message: `Demande de retrait de ${amount} FCFA en cours de traitement`,
        transaction: txResult.rows[0],
        new_balance: balance - amount,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Wallet withdraw error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Historique des transactions (pagine)
router.get('/transactions', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { type } = req.query;

    let whereClause = 'WHERE wt.user_id = $1';
    const params = [req.user.id];

    if (type && ['deposit', 'withdrawal', 'payment', 'cashback'].includes(type)) {
      params.push(type);
      whereClause += ` AND wt.type = $${params.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM wallet_transactions wt ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT wt.*, o.id as order_number
       FROM wallet_transactions wt
       LEFT JOIN orders o ON wt.order_id = o.id
       ${whereClause}
       ORDER BY wt.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get wallet transactions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Payer une commande avec le wallet
router.post('/pay', [
  body('order_id').isInt({ min: 1 }).withMessage('ID de commande invalide'),
  body('amount').isFloat({ min: 1 }).withMessage('Montant invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { order_id, amount } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verifier que la commande appartient a l'utilisateur et est en attente de paiement
      const orderResult = await client.query(
        `SELECT id, total_amount, payment_status FROM orders
         WHERE id = $1 AND user_id = $2`,
        [order_id, req.user.id]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      const order = orderResult.rows[0];

      if (order.payment_status === 'paid') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cette commande a deja ete payee' });
      }

      // Verifier le solde
      const walletResult = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [req.user.id]
      );

      if (walletResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Wallet introuvable' });
      }

      const balance = parseFloat(walletResult.rows[0].balance);

      if (amount > balance) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Solde insuffisant' });
      }

      // Debiter le wallet
      await client.query(
        'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
        [amount, req.user.id]
      );

      // Enregistrer la transaction de paiement
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, order_id, description, status)
         VALUES ($1, 'payment', $2, $3, $4, 'completed')`,
        [req.user.id, amount, order_id, `Paiement commande #${order_id}`]
      );

      // Mettre a jour le statut de paiement de la commande
      await client.query(
        `UPDATE orders SET payment_status = 'paid', payment_method = 'wallet' WHERE id = $1`,
        [order_id]
      );

      const newBalance = balance - amount;

      await client.query('COMMIT');

      res.json({
        message: `Paiement de ${amount} FCFA effectue pour la commande #${order_id}`,
        new_balance: newBalance,
        order_id,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Wallet pay error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter du cashback apres une commande (usage interne)
router.post('/cashback', [
  body('order_id').isInt({ min: 1 }).withMessage('ID de commande invalide'),
  body('order_amount').isFloat({ min: 1 }).withMessage('Montant de commande invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { order_id, order_amount } = req.body;

    const cashbackAmount = Math.floor(order_amount * CASHBACK_RATE);
    if (cashbackAmount <= 0) {
      return res.json({ message: 'Montant de cashback trop faible', cashback: 0 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verifier que le cashback n'a pas deja ete accorde pour cette commande
      const existingCashback = await client.query(
        `SELECT id FROM wallet_transactions
         WHERE order_id = $1 AND type = 'cashback' AND user_id = $2`,
        [order_id, req.user.id]
      );

      if (existingCashback.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cashback deja accorde pour cette commande' });
      }

      // Creer le wallet s'il n'existe pas
      await client.query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id]
      );

      // Crediter le cashback
      await client.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
        [cashbackAmount, req.user.id]
      );

      // Enregistrer la transaction
      const txResult = await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, order_id, description, status)
         VALUES ($1, 'cashback', $2, $3, $4, 'completed')
         RETURNING *`,
        [req.user.id, cashbackAmount, order_id, `Cashback ${CASHBACK_RATE * 100}% sur commande #${order_id}`]
      );

      // Recuperer le nouveau solde
      const walletResult = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [req.user.id]
      );

      await client.query('COMMIT');

      res.json({
        message: `Cashback de ${cashbackAmount} FCFA credite`,
        cashback: cashbackAmount,
        transaction: txResult.rows[0],
        new_balance: parseFloat(walletResult.rows[0].balance),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Wallet cashback error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
