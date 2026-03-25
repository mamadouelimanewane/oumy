const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();
router.use(authenticate);

// POST /support/tickets - Create ticket
router.post('/tickets', [
  body('subject').trim().notEmpty(),
  body('category').isIn(['order_issue', 'payment', 'delivery', 'general', 'refund']),
  body('message').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { subject, category, message, order_id, priority } = req.body;

    const ticket = await pool.query(
      `INSERT INTO support_tickets (user_id, order_id, subject, category, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, order_id || null, subject, category, priority || 'medium']
    );

    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message, is_admin) VALUES ($1, $2, $3, false)',
      [ticket.rows[0].id, req.user.id, message]
    );

    res.status(201).json({ message: 'Ticket créé', ticket: ticket.rows[0] });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /support/tickets - Get my tickets
router.get('/tickets', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = req.user.role === 'admin' ? '' : `WHERE t.user_id = ${req.user.id}`;
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM support_tickets t ${where}`);
    const result = await pool.query(
      `SELECT t.*, u.name as user_name,
       (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count
       FROM support_tickets t JOIN users u ON t.user_id = u.id
       ${where} ORDER BY t.updated_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get tickets error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /support/tickets/:id - Get ticket with messages
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);
    if (ticket.rows.length === 0) return res.status(404).json({ error: 'Ticket non trouvé' });
    if (req.user.role !== 'admin' && ticket.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const messages = await pool.query(
      `SELECT tm.*, u.name as sender_name FROM ticket_messages tm
       JOIN users u ON tm.sender_id = u.id WHERE tm.ticket_id = $1 ORDER BY tm.created_at ASC`,
      [req.params.id]
    );

    res.json({ ticket: ticket.rows[0], messages: messages.rows });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /support/tickets/:id/messages - Reply to ticket
router.post('/tickets/:id/messages', [
  body('message').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const ticket = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);
    if (ticket.rows.length === 0) return res.status(404).json({ error: 'Ticket non trouvé' });
    if (req.user.role !== 'admin' && ticket.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const isAdmin = req.user.role === 'admin';
    await pool.query(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message, is_admin) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.user.id, req.body.message, isAdmin]
    );

    // Update ticket status
    if (isAdmin) {
      await pool.query("UPDATE support_tickets SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
    }

    res.status(201).json({ message: 'Réponse envoyée' });
  } catch (err) {
    console.error('Reply to ticket error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /support/tickets/:id/status - Admin: update ticket status
router.put('/tickets/:id/status', authorize('admin'), [
  body('status').isIn(['open', 'in_progress', 'resolved', 'closed']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    await pool.query(
      'UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [req.body.status, req.params.id]
    );
    res.json({ message: 'Statut mis à jour' });
  } catch (err) {
    console.error('Update ticket status error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
