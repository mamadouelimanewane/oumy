const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

// Créer une notation (après livraison)
router.post('/', authenticate, [
  body('order_id').isInt().withMessage('ID commande requis'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Note entre 1 et 5 requise'),
  body('comment').optional().trim().isLength({ max: 500 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { order_id, rating, comment } = req.body;

    // Vérifier que la commande est livrée et appartient au client
    const orderCheck = await pool.query(
      'SELECT restaurant_id FROM orders WHERE id = $1 AND client_id = $2 AND status = $3',
      [order_id, req.user.id, 'livree']
    );

    if (orderCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Commande non trouvée ou non livrée' });
    }

    const restaurant_id = orderCheck.rows[0].restaurant_id;

    // Vérifier qu'il n'existe pas déjà une notation pour cette commande
    const existingRating = await pool.query(
      'SELECT id FROM ratings WHERE user_id = $1 AND order_id = $2',
      [req.user.id, order_id]
    );

    if (existingRating.rows.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà noté cette commande' });
    }

    const result = await pool.query(
      `INSERT INTO ratings (user_id, restaurant_id, order_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, restaurant_id, order_id, rating, comment]
    );

    // Notifier le restaurant
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'new_rating', 'Nouvel avis', $2, $3)`,
      [restaurant_id, `Vous avez reçu une note de ${rating}/5`, JSON.stringify({ rating_id: result.rows[0].id, rating })]
    );

    // Émettre via Socket.IO
    if (req.io) {
      req.io.to(`user_${restaurant_id}`).emit('rating_received', {
        rating,
        comment,
        orderId: order_id,
      });
    }

    res.status(201).json({
      message: 'Merci pour votre avis !',
      rating: result.rows[0],
    });
  } catch (err) {
    console.error('Create rating error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les avis d'un restaurant (paginé)
router.get('/restaurant/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = paginate(req.query);

    // Moyenne globale
    const avgResult = await pool.query(
      `SELECT COALESCE(ROUND(AVG(rating), 1), 0) as avg_rating,
              COUNT(*) as total_ratings
       FROM ratings WHERE restaurant_id = $1`,
      [id]
    );

    // Distribution des notes
    const distributionResult = await pool.query(
      `SELECT rating, COUNT(*) as count
       FROM ratings WHERE restaurant_id = $1
       GROUP BY rating ORDER BY rating DESC`,
      [id]
    );

    // Avis paginés
    const result = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.name as user_name
       FROM ratings r
       JOIN users u ON r.user_id = u.id
       WHERE r.restaurant_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      ...paginatedResponse(result.rows, avgResult.rows[0].total_ratings, { page, limit }),
      avg_rating: parseFloat(avgResult.rows[0].avg_rating),
      total_ratings: parseInt(avgResult.rows[0].total_ratings),
      distribution: distributionResult.rows,
    });
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
