const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.use(authenticate);

// GET / - Get user's meal plans
router.get('/', async (req, res) => {
  try {
    const plans = await pool.query(
      `SELECT * FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ meal_plans: plans.rows });
  } catch (err) {
    console.error('Get meal plans error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST / - Create a meal plan
router.post('/', [
  body('name').trim().notEmpty().withMessage('Le nom du plan est requis'),
  body('days').isObject().withMessage('Les jours du plan sont requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, days } = req.body;

    // Validate that menu items exist
    const allItemIds = new Set();
    for (const dayItems of Object.values(days)) {
      if (Array.isArray(dayItems)) {
        dayItems.forEach(id => allItemIds.add(id));
      }
    }

    if (allItemIds.size > 0) {
      const itemCheck = await pool.query(
        `SELECT id FROM menu_items WHERE id = ANY($1::int[])`,
        [Array.from(allItemIds)]
      );

      if (itemCheck.rows.length !== allItemIds.size) {
        return res.status(400).json({ error: 'Certains articles du menu sont invalides' });
      }
    }

    const plan = await pool.query(
      `INSERT INTO meal_plans (user_id, name, plan_data, is_active)
       VALUES ($1, $2, $3, false)
       RETURNING *`,
      [req.user.id, name, JSON.stringify(days)]
    );

    res.status(201).json({ meal_plan: plan.rows[0] });
  } catch (err) {
    console.error('Create meal plan error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:id/activate - Activate a meal plan (auto-order)
router.post('/:id/activate', async (req, res) => {
  try {
    // Verify ownership
    const plan = await pool.query(
      `SELECT * FROM meal_plans WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (plan.rows.length === 0) {
      return res.status(404).json({ error: 'Plan repas non trouve' });
    }

    // Deactivate all other plans
    await pool.query(
      `UPDATE meal_plans SET is_active = false WHERE user_id = $1`,
      [req.user.id]
    );

    // Activate this plan
    const updated = await pool.query(
      `UPDATE meal_plans SET is_active = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );

    res.json({
      message: 'Plan repas active ! Les commandes seront passees automatiquement.',
      meal_plan: updated.rows[0]
    });
  } catch (err) {
    console.error('Activate meal plan error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:id - Delete a meal plan
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Plan repas non trouve' });
    }

    res.json({ message: 'Plan repas supprime' });
  } catch (err) {
    console.error('Delete meal plan error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
