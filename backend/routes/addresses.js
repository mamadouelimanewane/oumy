const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Lister les adresses de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get addresses error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter une adresse
router.post('/', [
  body('label').trim().notEmpty().withMessage('Label requis (ex: Maison, Bureau)'),
  body('address').trim().notEmpty().withMessage('Adresse requise'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { label, address, latitude, longitude, is_default } = req.body;

    // Si cette adresse est par défaut, retirer le défaut des autres
    if (is_default) {
      await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    }

    const result = await pool.query(
      `INSERT INTO user_addresses (user_id, label, address, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, label, address, latitude, longitude, is_default || false]
    );

    res.status(201).json({ message: 'Adresse ajoutée', address: result.rows[0] });
  } catch (err) {
    console.error('Add address error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une adresse
router.put('/:id', async (req, res) => {
  try {
    const { label, address, latitude, longitude, is_default } = req.body;

    const check = await pool.query(
      'SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Adresse non trouvée' });

    if (is_default) {
      await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    }

    const result = await pool.query(
      `UPDATE user_addresses
       SET label = COALESCE($1, label), address = COALESCE($2, address),
           latitude = COALESCE($3, latitude), longitude = COALESCE($4, longitude),
           is_default = COALESCE($5, is_default)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [label, address, latitude, longitude, is_default, req.params.id, req.user.id]
    );

    res.json({ message: 'Adresse modifiée', address: result.rows[0] });
  } catch (err) {
    console.error('Update address error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une adresse
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Adresse non trouvée' });
    res.json({ message: 'Adresse supprimée' });
  } catch (err) {
    console.error('Delete address error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Définir une adresse par défaut
router.put('/:id/default', async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Adresse non trouvée' });

    await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    await pool.query('UPDATE user_addresses SET is_default = true WHERE id = $1', [req.params.id]);

    res.json({ message: 'Adresse définie par défaut' });
  } catch (err) {
    console.error('Set default address error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
