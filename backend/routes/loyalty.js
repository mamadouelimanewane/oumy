const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticate);

// Paliers de fidélité
const LOYALTY_TIERS = [
  { name: 'Bronze', min_points: 0, discount_percent: 0 },
  { name: 'Argent', min_points: 500, discount_percent: 3 },
  { name: 'Or', min_points: 1500, discount_percent: 5 },
  { name: 'Diamant', min_points: 5000, discount_percent: 10 },
];

// Taux de points : 1 point par 100 FCFA dépensés
const POINTS_PER_FCFA = 100;
// Points bonus pour parrainage
const REFERRAL_BONUS = 200;

// Voir son solde et son palier
router.get('/balance', async (req, res) => {
  try {
    // Solde actuel
    const balanceResult = await pool.query(
      'SELECT COALESCE(loyalty_balance, 0) as balance FROM users WHERE id = $1',
      [req.user.id]
    );

    const balance = parseInt(balanceResult.rows[0].balance);

    // Total des points gagnés (lifetime)
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as total_earned
       FROM loyalty_points WHERE user_id = $1 AND type = 'earned'`,
      [req.user.id]
    );

    const totalEarned = parseInt(totalResult.rows[0].total_earned);

    // Déterminer le palier
    const tier = [...LOYALTY_TIERS].reverse().find(t => totalEarned >= t.min_points) || LOYALTY_TIERS[0];
    const nextTier = LOYALTY_TIERS[LOYALTY_TIERS.indexOf(tier) + 1] || null;

    res.json({
      balance,
      total_earned: totalEarned,
      tier: tier.name,
      discount_percent: tier.discount_percent,
      next_tier: nextTier ? {
        name: nextTier.name,
        points_needed: nextTier.min_points - totalEarned,
        discount_percent: nextTier.discount_percent,
      } : null,
      tiers: LOYALTY_TIERS,
    });
  } catch (err) {
    console.error('Get loyalty balance error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Historique des points
router.get('/history', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM loyalty_points WHERE user_id = $1',
      [req.user.id]
    );

    const result = await pool.query(
      `SELECT lp.*, o.total_amount as order_amount
       FROM loyalty_points lp
       LEFT JOIN orders o ON lp.order_id = o.id
       WHERE lp.user_id = $1
       ORDER BY lp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get loyalty history error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Utiliser des points (réduction sur commande)
router.post('/redeem', [
  body('points').isInt({ min: 100 }).withMessage('Minimum 100 points'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { points } = req.body;

    const userResult = await pool.query(
      'SELECT loyalty_balance FROM users WHERE id = $1',
      [req.user.id]
    );

    const balance = parseInt(userResult.rows[0].loyalty_balance);

    if (points > balance) {
      return res.status(400).json({ error: 'Solde de points insuffisant' });
    }

    // 1 point = 10 FCFA de réduction
    const discount = points * 10;

    // Déduire les points
    await pool.query(
      'UPDATE users SET loyalty_balance = loyalty_balance - $1 WHERE id = $2',
      [points, req.user.id]
    );

    await pool.query(
      `INSERT INTO loyalty_points (user_id, points, type, description)
       VALUES ($1, $2, 'redeemed', $3)`,
      [req.user.id, -points, `Échange de ${points} points contre ${discount} FCFA de réduction`]
    );

    res.json({
      message: `${points} points échangés`,
      discount_amount: discount,
      new_balance: balance - points,
    });
  } catch (err) {
    console.error('Redeem points error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === Parrainage ===

// Obtenir son code de parrainage
router.get('/referral-code', async (req, res) => {
  try {
    let user = await pool.query(
      'SELECT referral_code FROM users WHERE id = $1',
      [req.user.id]
    );

    let code = user.rows[0].referral_code;

    if (!code) {
      // Générer un code unique
      code = 'SF' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await pool.query(
        'UPDATE users SET referral_code = $1 WHERE id = $2',
        [code, req.user.id]
      );
    }

    // Nombre de parrainages
    const refCount = await pool.query(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1',
      [req.user.id]
    );

    res.json({
      referral_code: code,
      total_referrals: parseInt(refCount.rows[0].count),
      bonus_per_referral: REFERRAL_BONUS,
    });
  } catch (err) {
    console.error('Get referral code error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Appliquer un code de parrainage (à l'inscription ou après)
router.post('/apply-referral', [
  body('code').trim().notEmpty().withMessage('Code de parrainage requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { code } = req.body;

    // Vérifier que le code existe
    const referrer = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1 AND id != $2',
      [code.toUpperCase(), req.user.id]
    );

    if (referrer.rows.length === 0) {
      return res.status(404).json({ error: 'Code de parrainage invalide' });
    }

    // Vérifier que l'utilisateur n'a pas déjà été parrainé
    const existing = await pool.query(
      'SELECT id FROM referrals WHERE referred_id = $1',
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà utilisé un code de parrainage' });
    }

    const referrerId = referrer.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Créer le parrainage
      await client.query(
        'INSERT INTO referrals (referrer_id, referred_id, referral_code) VALUES ($1, $2, $3)',
        [referrerId, req.user.id, code.toUpperCase()]
      );

      // Bonus pour le parrain
      await client.query(
        'UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2',
        [REFERRAL_BONUS, referrerId]
      );
      await client.query(
        `INSERT INTO loyalty_points (user_id, points, type, description)
         VALUES ($1, $2, 'referral', 'Bonus de parrainage')`,
        [referrerId, REFERRAL_BONUS]
      );

      // Bonus pour le filleul
      await client.query(
        'UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2',
        [REFERRAL_BONUS, req.user.id]
      );
      await client.query(
        `INSERT INTO loyalty_points (user_id, points, type, description)
         VALUES ($1, $2, 'referral', 'Bonus de bienvenue (parrainage)')`,
        [req.user.id, REFERRAL_BONUS]
      );

      await client.query('COMMIT');

      res.json({
        message: `Code appliqué ! Vous recevez ${REFERRAL_BONUS} points de bienvenue`,
        bonus: REFERRAL_BONUS,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code déjà utilisé' });
    console.error('Apply referral error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fonction utilitaire pour ajouter des points après commande livrée (appelée depuis livreur.js)
const addOrderPoints = async (userId, orderId, orderAmount) => {
  const points = Math.floor(parseFloat(orderAmount) / POINTS_PER_FCFA);
  if (points <= 0) return;

  await pool.query(
    'UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2',
    [points, userId]
  );

  await pool.query(
    `INSERT INTO loyalty_points (user_id, points, type, description, order_id)
     VALUES ($1, $2, 'earned', $3, $4)`,
    [userId, points, `${points} points gagnés sur commande #${orderId}`, orderId]
  );
};

module.exports = router;
module.exports.addOrderPoints = addOrderPoints;
