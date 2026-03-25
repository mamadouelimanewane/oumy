const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticate);

// POST /giftcards - Create a gift card
router.post('/', [
  body('amount').isFloat({ min: 500 }).withMessage('Montant minimum 500 FCFA'),
  body('recipient_phone').trim().notEmpty().withMessage('Téléphone du destinataire requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, recipient_phone, message } = req.body;
    const code = 'GC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    const result = await pool.query(
      `INSERT INTO gift_cards (code, sender_id, recipient_phone, amount, balance, message, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [code, req.user.id, recipient_phone, amount, amount, message, expiresAt]
    );

    res.status(201).json({ message: 'Carte cadeau créée', gift_card: result.rows[0] });
  } catch (err) {
    console.error('Create gift card error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /giftcards/redeem - Redeem a gift card
router.post('/redeem', [
  body('code').trim().notEmpty().withMessage('Code requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { code } = req.body;
    const card = await pool.query(
      "SELECT * FROM gift_cards WHERE code = $1 AND is_redeemed = false AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
      [code.toUpperCase()]
    );

    if (card.rows.length === 0) return res.status(404).json({ error: 'Carte cadeau invalide ou expirée' });

    const gc = card.rows[0];

    // Add balance to user wallet
    let wallet = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [req.user.id]);
    if (wallet.rows.length === 0) {
      wallet = await pool.query('INSERT INTO wallets (user_id, balance) VALUES ($1, 0) RETURNING *', [req.user.id]);
    }
    const w = wallet.rows[0];

    await pool.query('UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [gc.balance, w.id]);
    await pool.query(
      "INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id) VALUES ($1, 'deposit', $2, $3, $4)",
      [w.id, gc.balance, `Carte cadeau ${gc.code}`, gc.code]
    );

    await pool.query('UPDATE gift_cards SET is_redeemed = true, redeemed_by = $1, balance = 0 WHERE id = $2', [req.user.id, gc.id]);

    res.json({ message: `${gc.balance} FCFA ajoutés à votre portefeuille`, amount: gc.balance });
  } catch (err) {
    console.error('Redeem gift card error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /giftcards/sent - My sent gift cards
router.get('/sent', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM gift_cards WHERE sender_id = $1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get sent gift cards error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /giftcards/check/:code - Check gift card status
router.get('/check/:code', async (req, res) => {
  try {
    const result = await pool.query('SELECT amount, balance, is_redeemed, expires_at FROM gift_cards WHERE code = $1', [req.params.code.toUpperCase()]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Carte non trouvée' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Check gift card error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
