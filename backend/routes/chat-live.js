const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.use(authenticate);

// GET /:orderId/messages - Get chat messages for an order
router.get('/:orderId/messages', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Verify user is part of this order (client or courier)
    const order = await pool.query(
      `SELECT id, client_id, courier_id FROM orders WHERE id = $1`,
      [orderId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const { client_id, courier_id } = order.rows[0];
    if (req.user.id !== client_id && req.user.id !== courier_id) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation' });
    }

    const messages = await pool.query(
      `SELECT cm.id, cm.order_id, cm.sender_id, cm.sender_role, cm.message, cm.created_at,
              u.name as sender_name
       FROM chat_messages cm
       JOIN users u ON u.id = cm.sender_id
       WHERE cm.order_id = $1
       ORDER BY cm.created_at ASC`,
      [orderId]
    );

    res.json({ messages: messages.rows });
  } catch (err) {
    console.error('Chat messages error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:orderId/messages - Send a message
router.post('/:orderId/messages', [
  body('message').trim().notEmpty().withMessage('Le message est requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { message } = req.body;

    // Verify user is part of this order
    const order = await pool.query(
      `SELECT id, client_id, courier_id FROM orders WHERE id = $1`,
      [orderId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const { client_id, courier_id } = order.rows[0];
    if (req.user.id !== client_id && req.user.id !== courier_id) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation' });
    }

    const senderRole = req.user.id === client_id ? 'client' : 'livreur';

    const newMessage = await pool.query(
      `INSERT INTO chat_messages (order_id, sender_id, sender_role, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, req.user.id, senderRole, message]
    );

    // Notify the other party via Socket.IO
    const recipientId = req.user.id === client_id ? courier_id : client_id;
    if (recipientId && req.io) {
      req.io.to(`user_${recipientId}`).emit('new_chat_message', {
        orderId: parseInt(orderId),
        message: newMessage.rows[0]
      });
    }

    res.status(201).json({ message: newMessage.rows[0] });
  } catch (err) {
    console.error('Send chat message error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
