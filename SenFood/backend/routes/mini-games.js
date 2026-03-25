const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const WHEEL_PRIZES = [
  { type: 'discount', value: 5, label: '5% de reduction', weight: 30 },
  { type: 'discount', value: 10, label: '10% de reduction', weight: 20 },
  { type: 'discount', value: 15, label: '15% de reduction', weight: 10 },
  { type: 'points', value: 50, label: '50 points bonus', weight: 25 },
  { type: 'points', value: 100, label: '100 points bonus', weight: 10 },
  { type: 'free_delivery', value: 1, label: 'Livraison gratuite', weight: 5 },
];

const SCRATCH_PRIZES = [
  { type: 'discount', value: 5, label: '5% de reduction', weight: 35 },
  { type: 'discount', value: 10, label: '10% de reduction', weight: 25 },
  { type: 'points', value: 25, label: '25 points bonus', weight: 20 },
  { type: 'points', value: 75, label: '75 points bonus', weight: 10 },
  { type: 'free_delivery', value: 1, label: 'Livraison gratuite', weight: 10 },
];

function pickPrize(prizes) {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;
  for (const prize of prizes) {
    random -= prize.weight;
    if (random <= 0) return prize;
  }
  return prizes[0];
}

// POST /spin-wheel - Spin the fortune wheel (costs 100 loyalty points)
router.post('/spin-wheel', async (req, res) => {
  try {
    // Check user's loyalty balance
    const user = await pool.query(
      `SELECT loyalty_balance FROM users WHERE id = $1`,
      [req.user.id]
    );

    const balance = user.rows[0]?.loyalty_balance || 0;
    if (balance < 100) {
      return res.status(400).json({
        error: 'Pas assez de points de fidelite (100 requis)',
        current_balance: balance
      });
    }

    // Deduct points
    await pool.query(
      `UPDATE users SET loyalty_balance = loyalty_balance - 100 WHERE id = $1`,
      [req.user.id]
    );

    await pool.query(
      `INSERT INTO loyalty_points (user_id, points, type, description)
       VALUES ($1, -100, 'redeemed', 'Roue de la fortune')`,
      [req.user.id]
    );

    // Pick a prize
    const prize = pickPrize(WHEEL_PRIZES);

    // Store prize
    const stored = await pool.query(
      `INSERT INTO mini_game_prizes (user_id, game_type, prize_type, prize_value, is_claimed, expires_at)
       VALUES ($1, 'spin_wheel', $2, $3, false, CURRENT_TIMESTAMP + INTERVAL '7 days')
       RETURNING *`,
      [req.user.id, prize.type, prize.value]
    );

    res.json({
      message: 'Felicitations ! Vous avez gagne : ' + prize.label,
      prize: stored.rows[0],
      new_balance: balance - 100
    });
  } catch (err) {
    console.error('Spin wheel error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /scratch-card - Scratch a card (1 free per day)
router.post('/scratch-card', async (req, res) => {
  try {
    // Check if user already scratched today
    const today = await pool.query(
      `SELECT id FROM mini_game_prizes
       WHERE user_id = $1 AND game_type = 'scratch_card'
       AND DATE(created_at) = CURRENT_DATE`,
      [req.user.id]
    );

    if (today.rows.length > 0) {
      return res.status(400).json({ error: 'Vous avez deja gratte votre carte aujourd hui. Revenez demain !' });
    }

    // Pick a prize
    const prize = pickPrize(SCRATCH_PRIZES);

    // Store prize
    const stored = await pool.query(
      `INSERT INTO mini_game_prizes (user_id, game_type, prize_type, prize_value, is_claimed, expires_at)
       VALUES ($1, 'scratch_card', $2, $3, false, CURRENT_TIMESTAMP + INTERVAL '7 days')
       RETURNING *`,
      [req.user.id, prize.type, prize.value]
    );

    res.json({
      message: 'Vous avez gratte et gagne : ' + prize.label,
      prize: stored.rows[0]
    });
  } catch (err) {
    console.error('Scratch card error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /prizes - Get user's won prizes
router.get('/prizes', async (req, res) => {
  try {
    const prizes = await pool.query(
      `SELECT * FROM mini_game_prizes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ prizes: prizes.rows });
  } catch (err) {
    console.error('Get prizes error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /prizes/:id/claim - Claim a won prize
router.post('/prizes/:id/claim', async (req, res) => {
  try {
    const prize = await pool.query(
      `SELECT * FROM mini_game_prizes
       WHERE id = $1 AND user_id = $2 AND is_claimed = false`,
      [req.params.id, req.user.id]
    );

    if (prize.rows.length === 0) {
      return res.status(404).json({ error: 'Prix non trouve ou deja reclame' });
    }

    const p = prize.rows[0];

    // Check expiration
    if (p.expires_at && new Date(p.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Ce prix a expire' });
    }

    // Apply the prize based on type
    if (p.prize_type === 'points') {
      await pool.query(
        `UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2`,
        [p.prize_value, req.user.id]
      );
      await pool.query(
        `INSERT INTO loyalty_points (user_id, points, type, description)
         VALUES ($1, $2, 'bonus', 'Prix mini-jeu reclame')`,
        [req.user.id, p.prize_value]
      );
    }

    // Mark as claimed
    await pool.query(
      `UPDATE mini_game_prizes SET is_claimed = true WHERE id = $1`,
      [req.params.id]
    );

    let message = 'Prix reclame !';
    if (p.prize_type === 'discount') {
      message = 'Reduction de ' + p.prize_value + '% appliquee a votre prochaine commande';
    } else if (p.prize_type === 'points') {
      message = p.prize_value + ' points ajoutes a votre solde';
    } else if (p.prize_type === 'free_delivery') {
      message = 'Livraison gratuite sur votre prochaine commande';
    }

    res.json({ message, prize: { ...p, is_claimed: true } });
  } catch (err) {
    console.error('Claim prize error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
