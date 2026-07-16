const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// POST /qrcodes/generate - Restaurant: generate QR for a table
router.post('/generate', authenticate, authorize('restaurant'), [
  body('table_number').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { table_number } = req.body;
    const qrData = JSON.stringify({
      restaurant_id: req.user.id,
      table: table_number,
      token: crypto.randomBytes(8).toString('hex'),
    });

    const result = await pool.query(
      `INSERT INTO qr_codes (restaurant_id, table_number, qr_data) VALUES ($1, $2, $3)
       ON CONFLICT (restaurant_id, table_number) DO UPDATE SET qr_data = $3, is_active = true
       RETURNING *`,
      [req.user.id, table_number, qrData]
    );

    res.status(201).json({ qr_code: result.rows[0], qr_url: `/api/qrcodes/scan/${result.rows[0].id}` });
  } catch (err) {
    console.error('Generate QR error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /qrcodes/my - Restaurant: list my QR codes
router.get('/my', authenticate, authorize('restaurant'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM qr_codes WHERE restaurant_id = $1 AND is_active = true ORDER BY table_number',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get QR codes error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /qrcodes/scan/:id - Public: scan QR code to get restaurant menu
router.get('/scan/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT qr.*, u.name as restaurant_name FROM qr_codes qr
       JOIN users u ON qr.restaurant_id = u.id WHERE qr.id = $1 AND qr.is_active = true`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'QR code invalide' });

    const qr = result.rows[0];
    const menu = await pool.query(
      'SELECT * FROM menu_items WHERE restaurant_id = $1 AND is_available = true ORDER BY category, name',
      [qr.restaurant_id]
    );

    res.json({
      restaurant: { id: qr.restaurant_id, name: qr.restaurant_name },
      table: qr.table_number,
      menu: menu.rows,
    });
  } catch (err) {
    console.error('Scan QR error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /qrcodes/:id
router.delete('/:id', authenticate, authorize('restaurant'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE qr_codes SET is_active = false WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'QR code non trouvé' });
    res.json({ message: 'QR code désactivé' });
  } catch (err) {
    console.error('Delete QR error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
