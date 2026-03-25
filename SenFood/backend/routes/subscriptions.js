const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

// GET /subscriptions/plans - Public: list plans
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_per_week ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /subscriptions/plans - Admin: create plan
router.post('/plans', authenticate, authorize('admin'), [
  body('name').trim().notEmpty(),
  body('meals_per_week').isInt({ min: 1 }),
  body('price_per_week').isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, meals_per_week, price_per_week, discount_percent } = req.body;
    const result = await pool.query(
      'INSERT INTO subscription_plans (name, description, meals_per_week, price_per_week, discount_percent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, meals_per_week, price_per_week, discount_percent || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /subscriptions/subscribe - Client: subscribe to a plan
router.post('/subscribe', authenticate, [
  body('plan_id').isInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { plan_id } = req.body;
    const plan = await pool.query('SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true', [plan_id]);
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Forfait non trouvé' });

    // Check existing active subscription
    const existing = await pool.query(
      "SELECT id FROM user_subscriptions WHERE user_id = $1 AND status = 'active'", [req.user.id]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Vous avez déjà un abonnement actif' });

    const p = plan.rows[0];
    const startsAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1 week

    const result = await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, starts_at, expires_at, meals_remaining)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, plan_id, startsAt, expiresAt, p.meals_per_week]
    );

    res.status(201).json({ message: `Abonnement ${p.name} activé`, subscription: result.rows[0] });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /subscriptions/my - Client: my subscription
router.get('/my', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT us.*, sp.name as plan_name, sp.meals_per_week, sp.price_per_week, sp.discount_percent
       FROM user_subscriptions us JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1 ORDER BY us.created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.json({ subscription: null });
    res.json({ subscription: result.rows[0] });
  } catch (err) {
    console.error('Get my subscription error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /subscriptions/pause - Client: pause subscription
router.put('/pause', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE user_subscriptions SET status = 'paused' WHERE user_id = $1 AND status = 'active' RETURNING *",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pas d\'abonnement actif' });
    res.json({ message: 'Abonnement mis en pause' });
  } catch (err) {
    console.error('Pause subscription error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /subscriptions/resume
router.put('/resume', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE user_subscriptions SET status = 'active' WHERE user_id = $1 AND status = 'paused' RETURNING *",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pas d\'abonnement en pause' });
    res.json({ message: 'Abonnement repris' });
  } catch (err) {
    console.error('Resume subscription error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /subscriptions/cancel
router.put('/cancel', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE user_subscriptions SET status = 'cancelled' WHERE user_id = $1 AND status IN ('active','paused') RETURNING *",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pas d\'abonnement actif' });
    res.json({ message: 'Abonnement annulé' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
