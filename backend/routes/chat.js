const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Récupérer les messages d'une commande
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Vérifier que l'utilisateur est lié à cette commande
    const orderCheck = await pool.query(
      'SELECT id FROM orders WHERE id = $1 AND (client_id = $2 OR courier_id = $2 OR restaurant_id = $2)',
      [orderId, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation' });
    }

    const result = await pool.query(
      `SELECT cm.id, cm.message, cm.created_at,
              cm.sender_id, u.name as sender_name, u.role as sender_role
       FROM chat_messages cm
       JOIN users u ON cm.sender_id = u.id
       WHERE cm.order_id = $1
       ORDER BY cm.created_at ASC`,
      [orderId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get chat error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Envoyer un message
router.post('/:orderId', [
  body('message').trim().notEmpty().isLength({ max: 500 }).withMessage('Message requis (max 500 caractères)'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { orderId } = req.params;
    const { message } = req.body;

    // Vérifier que l'utilisateur est lié à la commande et qu'elle est en cours
    const orderCheck = await pool.query(
      `SELECT id, client_id, courier_id, restaurant_id
       FROM orders
       WHERE id = $1 AND (client_id = $2 OR courier_id = $2 OR restaurant_id = $2)
       AND status IN ('preparation', 'prete', 'en_route')`,
      [orderId, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Impossible d\'envoyer un message pour cette commande' });
    }

    const order = orderCheck.rows[0];

    const result = await pool.query(
      `INSERT INTO chat_messages (order_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [orderId, req.user.id, message]
    );

    const chatMessage = {
      ...result.rows[0],
      sender_name: req.user.name,
      sender_role: req.user.role,
    };

    // Émettre via Socket.IO aux participants de la commande
    if (req.io) {
      const recipients = [order.client_id, order.courier_id, order.restaurant_id].filter(id => id && id !== req.user.id);
      recipients.forEach(userId => {
        req.io.to(`user_${userId}`).emit('chat_message', {
          orderId: parseInt(orderId),
          ...chatMessage,
        });
      });
    }

    res.status(201).json({ message: 'Message envoyé', chat: chatMessage });
  } catch (err) {
    console.error('Send chat error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
