const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.use(authenticate);

// GET / - Get user preferences
router.get('/', async (req, res) => {
  try {
    let prefs = await pool.query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [req.user.id]
    );

    // Create default preferences if none exist
    if (prefs.rows.length === 0) {
      prefs = await pool.query(
        `INSERT INTO user_preferences (user_id, dark_mode, language, notifications_enabled, created_at, updated_at)
         VALUES ($1, false, 'fr', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [req.user.id]
      );
    }

    res.json({ preferences: prefs.rows[0] });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT / - Update preferences
router.put('/', async (req, res) => {
  try {
    const { dark_mode, language, notifications_enabled } = req.body;

    // Upsert preferences
    const result = await pool.query(
      `INSERT INTO user_preferences (user_id, dark_mode, language, notifications_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         dark_mode = COALESCE($2, user_preferences.dark_mode),
         language = COALESCE($3, user_preferences.language),
         notifications_enabled = COALESCE($4, user_preferences.notifications_enabled),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, dark_mode, language, notifications_enabled]
    );

    res.json({ preferences: result.rows[0] });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /addresses - Get saved addresses
router.get('/addresses', async (req, res) => {
  try {
    const addresses = await pool.query(
      `SELECT * FROM saved_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );

    res.json({ addresses: addresses.rows });
  } catch (err) {
    console.error('Get addresses error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /addresses - Save a new address
router.post('/addresses', [
  body('label').trim().notEmpty().withMessage('Le label est requis'),
  body('address').trim().notEmpty().withMessage('L\'adresse est requise'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { label, address, lat, lng, is_default } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await pool.query(
        `UPDATE saved_addresses SET is_default = false WHERE user_id = $1`,
        [req.user.id]
      );
    }

    const result = await pool.query(
      `INSERT INTO saved_addresses (user_id, label, address, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, label, address, lat, lng, is_default || false]
    );

    res.status(201).json({ address: result.rows[0] });
  } catch (err) {
    console.error('Save address error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /addresses/:id - Delete saved address
router.delete('/addresses/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM saved_addresses WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Adresse non trouvée' });
    }

    res.json({ message: 'Adresse supprimée' });
  } catch (err) {
    console.error('Delete address error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
