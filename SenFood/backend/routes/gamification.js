const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

// Types de conditions valides pour les badges
const VALID_CONDITION_TYPES = [
  'orders_count',
  'total_spent',
  'referrals_count',
  'reviews_count',
  'streak_days',
];

// ===== BADGES =====

// Liste de tous les badges disponibles (public)
router.get('/badges', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, icon, condition_type, condition_value, reward_points
       FROM badges
       ORDER BY condition_value ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get badges error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Badges gagnés par l'utilisateur connecté
router.get('/badges/mine', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.name, b.description, b.icon, b.condition_type,
              b.condition_value, b.reward_points, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get user badges error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un badge (admin uniquement)
router.post('/badges', authenticate, authorize('admin'), [
  body('name').trim().notEmpty().withMessage('Nom du badge requis'),
  body('description').trim().notEmpty().withMessage('Description requise'),
  body('icon').trim().notEmpty().withMessage('Icône requise'),
  body('condition_type').isIn(VALID_CONDITION_TYPES).withMessage('Type de condition invalide'),
  body('condition_value').isInt({ min: 1 }).withMessage('Valeur de condition requise (min 1)'),
  body('reward_points').isInt({ min: 0 }).withMessage('Points de récompense requis (min 0)'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, icon, condition_type, condition_value, reward_points } = req.body;

    const result = await pool.query(
      `INSERT INTO badges (name, description, icon, condition_type, condition_value, reward_points)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, icon, condition_type, condition_value, reward_points]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Un badge avec ce nom existe déjà' });
    console.error('Create badge error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== CHALLENGES =====

// Liste des challenges actifs
router.get('/challenges', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM challenges
       WHERE starts_at <= NOW() AND ends_at >= NOW()`
    );

    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM user_challenges uc WHERE uc.challenge_id = c.id) as participants_count
       FROM challenges c
       WHERE c.starts_at <= NOW() AND c.ends_at >= NOW()
       ORDER BY c.ends_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get challenges error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Progression des challenges de l'utilisateur
router.get('/challenges/mine', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.type, c.target_value,
              c.reward_type, c.reward_value, c.starts_at, c.ends_at,
              uc.current_value, uc.completed, uc.completed_at, uc.joined_at
       FROM user_challenges uc
       JOIN challenges c ON uc.challenge_id = c.id
       WHERE uc.user_id = $1
       ORDER BY uc.completed ASC, c.ends_at ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get user challenges error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un challenge (admin uniquement)
router.post('/challenges', authenticate, authorize('admin'), [
  body('title').trim().notEmpty().withMessage('Titre requis'),
  body('description').trim().notEmpty().withMessage('Description requise'),
  body('type').isIn(['daily', 'weekly', 'monthly']).withMessage('Type invalide (daily, weekly, monthly)'),
  body('target_value').isInt({ min: 1 }).withMessage('Valeur cible requise (min 1)'),
  body('reward_type').trim().notEmpty().withMessage('Type de récompense requis'),
  body('reward_value').isInt({ min: 1 }).withMessage('Valeur de récompense requise (min 1)'),
  body('starts_at').isISO8601().withMessage('Date de début invalide'),
  body('ends_at').isISO8601().withMessage('Date de fin invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, type, target_value, reward_type, reward_value, starts_at, ends_at } = req.body;

    if (new Date(ends_at) <= new Date(starts_at)) {
      return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
    }

    const result = await pool.query(
      `INSERT INTO challenges (title, description, type, target_value, reward_type, reward_value, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, type, target_value, reward_type, reward_value, starts_at, ends_at]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejoindre un challenge
router.post('/challenges/:id/join', authenticate, [
  param('id').isInt().withMessage('ID de challenge invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const challengeId = parseInt(req.params.id);

    // Vérifier que le challenge existe et est actif
    const challenge = await pool.query(
      `SELECT id, title FROM challenges
       WHERE id = $1 AND starts_at <= NOW() AND ends_at >= NOW()`,
      [challengeId]
    );

    if (challenge.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge introuvable ou expiré' });
    }

    // Vérifier que l'utilisateur n'a pas déjà rejoint
    const existing = await pool.query(
      'SELECT id FROM user_challenges WHERE user_id = $1 AND challenge_id = $2',
      [req.user.id, challengeId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà rejoint ce challenge' });
    }

    const result = await pool.query(
      `INSERT INTO user_challenges (user_id, challenge_id, current_value, completed)
       VALUES ($1, $2, 0, false)
       RETURNING *`,
      [req.user.id, challengeId]
    );

    res.status(201).json({
      message: `Vous avez rejoint le challenge "${challenge.rows[0].title}"`,
      progress: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Déjà inscrit à ce challenge' });
    console.error('Join challenge error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour la progression d'un challenge (interne, après commande)
router.put('/challenges/:id/progress', authenticate, [
  param('id').isInt().withMessage('ID de challenge invalide'),
  body('increment').isInt({ min: 1 }).withMessage('Incrément requis (min 1)'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const challengeId = parseInt(req.params.id);
    const { increment } = req.body;

    // Vérifier que le challenge est actif
    const challenge = await pool.query(
      `SELECT id, target_value, reward_type, reward_value FROM challenges
       WHERE id = $1 AND starts_at <= NOW() AND ends_at >= NOW()`,
      [challengeId]
    );

    if (challenge.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge introuvable ou expiré' });
    }

    // Vérifier la participation et que le challenge n'est pas déjà complété
    const participation = await pool.query(
      'SELECT id, current_value, completed FROM user_challenges WHERE user_id = $1 AND challenge_id = $2',
      [req.user.id, challengeId]
    );

    if (participation.rows.length === 0) {
      return res.status(400).json({ error: 'Vous n\'avez pas rejoint ce challenge' });
    }

    if (participation.rows[0].completed) {
      return res.status(400).json({ error: 'Challenge déjà complété' });
    }

    const newValue = parseInt(participation.rows[0].current_value) + parseInt(increment);
    const targetValue = parseInt(challenge.rows[0].target_value);
    const isCompleted = newValue >= targetValue;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Mettre à jour la progression
      await client.query(
        `UPDATE user_challenges
         SET current_value = $1, completed = $2, completed_at = $3
         WHERE user_id = $4 AND challenge_id = $5`,
        [newValue, isCompleted, isCompleted ? new Date() : null, req.user.id, challengeId]
      );

      let rewardMessage = null;

      // Attribuer la récompense si complété
      if (isCompleted && challenge.rows[0].reward_type === 'points') {
        const rewardValue = parseInt(challenge.rows[0].reward_value);
        await client.query(
          'UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2',
          [rewardValue, req.user.id]
        );
        await client.query(
          `INSERT INTO loyalty_points (user_id, points, type, description)
           VALUES ($1, $2, 'earned', $3)`,
          [req.user.id, rewardValue, `Récompense challenge complété`]
        );
        rewardMessage = `Challenge complété ! ${rewardValue} points gagnés`;
      }

      await client.query('COMMIT');

      res.json({
        current_value: newValue,
        target_value: targetValue,
        completed: isCompleted,
        reward_message: rewardMessage,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update challenge progress error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== CHECK & AWARD BADGES =====

// Vérifier et attribuer les badges gagnés
router.post('/check-badges', authenticate, async (req, res) => {
  try {
    // Récupérer les stats de l'utilisateur
    const statsResult = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'delivered') as orders_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = $1 AND status = 'delivered') as total_spent,
        (SELECT COUNT(*) FROM referrals WHERE referrer_id = $1) as referrals_count,
        (SELECT COUNT(*) FROM ratings WHERE user_id = $1) as reviews_count`,
      [req.user.id]
    );

    const stats = statsResult.rows[0];

    // Calculer le streak (jours consécutifs avec commande)
    const streakResult = await pool.query(
      `WITH order_dates AS (
        SELECT DISTINCT DATE(created_at) as order_date
        FROM orders
        WHERE user_id = $1 AND status = 'delivered'
        ORDER BY order_date DESC
      ),
      streaks AS (
        SELECT order_date,
               order_date - (ROW_NUMBER() OVER (ORDER BY order_date DESC))::int AS streak_group
        FROM order_dates
      )
      SELECT COUNT(*) as streak_days
      FROM streaks
      WHERE streak_group = (
        SELECT streak_group FROM streaks LIMIT 1
      )`,
      [req.user.id]
    );

    stats.streak_days = parseInt(streakResult.rows[0]?.streak_days || 0);

    // Récupérer tous les badges non encore gagnés par l'utilisateur
    const badgesResult = await pool.query(
      `SELECT b.* FROM badges b
       WHERE b.id NOT IN (
         SELECT badge_id FROM user_badges WHERE user_id = $1
       )`,
      [req.user.id]
    );

    const newBadges = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const badge of badgesResult.rows) {
        const userStat = parseInt(stats[badge.condition_type]) || 0;
        const conditionValue = parseInt(badge.condition_value);

        if (userStat >= conditionValue) {
          // Attribuer le badge
          await client.query(
            'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)',
            [req.user.id, badge.id]
          );

          // Attribuer les points de récompense
          if (badge.reward_points > 0) {
            await client.query(
              'UPDATE users SET loyalty_balance = loyalty_balance + $1 WHERE id = $2',
              [badge.reward_points, req.user.id]
            );
            await client.query(
              `INSERT INTO loyalty_points (user_id, points, type, description)
               VALUES ($1, $2, 'earned', $3)`,
              [req.user.id, badge.reward_points, `Badge "${badge.name}" débloqué`]
            );
          }

          newBadges.push({
            id: badge.id,
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            reward_points: badge.reward_points,
          });
        }
      }

      await client.query('COMMIT');

      res.json({
        stats,
        new_badges: newBadges,
        message: newBadges.length > 0
          ? `${newBadges.length} nouveau(x) badge(s) débloqué(s) !`
          : 'Aucun nouveau badge débloqué',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Check badges error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== LEADERBOARD =====

// Top utilisateurs par points ce mois-ci (public)
router.get('/leaderboard', async (req, res) => {
  try {
    const limitParam = parseInt(req.query.limit) || 20;
    const safeLimit = Math.min(Math.max(limitParam, 1), 100);

    const result = await pool.query(
      `SELECT u.id, u.name,
              COALESCE(SUM(lp.points), 0) as monthly_points,
              COUNT(DISTINCT ub.badge_id) as badges_count
       FROM users u
       LEFT JOIN loyalty_points lp ON lp.user_id = u.id
         AND lp.type = 'earned'
         AND lp.created_at >= DATE_TRUNC('month', NOW())
       LEFT JOIN user_badges ub ON ub.user_id = u.id
       GROUP BY u.id, u.name
       HAVING COALESCE(SUM(lp.points), 0) > 0
       ORDER BY monthly_points DESC
       LIMIT $1`,
      [safeLimit]
    );

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      user_id: row.id,
      name: row.name,
      monthly_points: parseInt(row.monthly_points),
      badges_count: parseInt(row.badges_count),
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
