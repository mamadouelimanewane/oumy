const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticate);

// GET /my-code - Get or generate user's referral code
router.get('/my-code', async (req, res) => {
  try {
    // Check if user already has a referral code
    const user = await pool.query(
      `SELECT referral_code FROM users WHERE id = $1`,
      [req.user.id]
    );

    let code = user.rows[0]?.referral_code;

    if (!code) {
      // Generate a unique referral code
      code = 'SF' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await pool.query(
        `UPDATE users SET referral_code = $1 WHERE id = $2`,
        [code, req.user.id]
      );
    }

    res.json({ referral_code: code });
  } catch (err) {
    console.error('Get referral code error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /apply - Apply a referral code
router.post('/apply', [
  body('code').trim().notEmpty().withMessage('Le code de parrainage est requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;

    // Check if user already used a referral code
    const existing = await pool.query(
      `SELECT id FROM referrals WHERE referred_id = $1`,
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà utilisé un code de parrainage' });
    }

    // Find the referrer
    const referrer = await pool.query(
      `SELECT id FROM users WHERE referral_code = $1 AND id != $2`,
      [code, req.user.id]
    );

    if (referrer.rows.length === 0) {
      return res.status(404).json({ error: 'Code de parrainage invalide' });
    }

    const referrerId = referrer.rows[0].id;
    const bonusAmount = 500; // 500 FCFA

    // Create referral record
    await pool.query(
      `INSERT INTO referrals (referrer_id, referred_id, code, bonus_amount, status)
       VALUES ($1, $2, $3, $4, 'completed')`,
      [referrerId, req.user.id, code, bonusAmount]
    );

    // Credit both users' loyalty balance
    await pool.query(
      `UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2`,
      [bonusAmount, referrerId]
    );
    await pool.query(
      `UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2`,
      [bonusAmount, req.user.id]
    );

    // Log loyalty points for both
    await pool.query(
      `INSERT INTO loyalty_points (user_id, points, type, description)
       VALUES ($1, $2, 'referral', 'Bonus parrainage - filleul inscrit')`,
      [referrerId, bonusAmount]
    );
    await pool.query(
      `INSERT INTO loyalty_points (user_id, points, type, description)
       VALUES ($1, $2, 'referral', 'Bonus parrainage - code appliqué')`,
      [req.user.id, bonusAmount]
    );

    res.json({
      message: `Code appliqué ! Vous et votre parrain recevez ${bonusAmount} FCFA`,
      bonus: bonusAmount
    });
  } catch (err) {
    console.error('Apply referral error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /stats - Get referral stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT COUNT(*) as total_referred,
              COALESCE(SUM(bonus_amount), 0) as total_earned
       FROM referrals
       WHERE referrer_id = $1 AND status = 'completed'`,
      [req.user.id]
    );

    const referred = await pool.query(
      `SELECT r.created_at, u.name as referred_name, r.bonus_amount
       FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    res.json({
      total_referred: parseInt(stats.rows[0].total_referred),
      total_earned: parseInt(stats.rows[0].total_earned),
      referrals: referred.rows
    });
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
