const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();
router.use(authenticate);

// POST /catering - Client: create catering request
router.post('/', [
  body('restaurant_id').isInt(),
  body('event_date').isISO8601(),
  body('guest_count').isInt({ min: 5 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { restaurant_id, event_date, guest_count, budget, notes } = req.body;

    const eventDate = new Date(event_date);
    if (eventDate < new Date(Date.now() + 48 * 60 * 60 * 1000)) {
      return res.status(400).json({ error: 'La date doit être au moins 48h à l\'avance' });
    }

    const result = await pool.query(
      `INSERT INTO catering_requests (client_id, restaurant_id, event_date, guest_count, budget, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, restaurant_id, event_date, guest_count, budget, notes]
    );

    res.status(201).json({ message: 'Demande de traiteur envoyée', request: result.rows[0] });
  } catch (err) {
    console.error('Create catering request error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /catering/my - Client: my requests
router.get('/my', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cr.*, u.name as restaurant_name FROM catering_requests cr
       JOIN users u ON cr.restaurant_id = u.id WHERE cr.client_id = $1 ORDER BY cr.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get my catering requests error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /catering/restaurant - Restaurant: incoming requests
router.get('/restaurant', authorize('restaurant'), async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const countResult = await pool.query('SELECT COUNT(*) as total FROM catering_requests WHERE restaurant_id = $1', [req.user.id]);
    const result = await pool.query(
      `SELECT cr.*, u.name as client_name, u.phone as client_phone
       FROM catering_requests cr JOIN users u ON cr.client_id = u.id
       WHERE cr.restaurant_id = $1 ORDER BY cr.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get restaurant catering requests error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /catering/:id/respond - Restaurant: respond to request
router.put('/:id/respond', authorize('restaurant'), [
  body('status').isIn(['accepted', 'rejected']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const result = await pool.query(
      "UPDATE catering_requests SET status = $1 WHERE id = $2 AND restaurant_id = $3 AND status = 'pending' RETURNING *",
      [req.body.status, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Demande non trouvée' });

    res.json({ message: `Demande ${req.body.status === 'accepted' ? 'acceptée' : 'rejetée'}` });
  } catch (err) {
    console.error('Respond to catering error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
