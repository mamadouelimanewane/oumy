const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

router.use(authenticate);

// Toggle favori (ajouter / retirer)
router.post('/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Vérifier que le restaurant existe
    const restaurantCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [restaurantId, 'restaurant']
    );

    if (restaurantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    // Vérifier si déjà en favori
    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND restaurant_id = $2',
      [req.user.id, restaurantId]
    );

    if (existing.rows.length > 0) {
      // Retirer des favoris
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND restaurant_id = $2',
        [req.user.id, restaurantId]
      );
      return res.json({ message: 'Restaurant retiré des favoris', isFavorite: false });
    }

    // Ajouter aux favoris
    await pool.query(
      'INSERT INTO favorites (user_id, restaurant_id) VALUES ($1, $2)',
      [req.user.id, restaurantId]
    );

    res.status(201).json({ message: 'Restaurant ajouté aux favoris', isFavorite: true });
  } catch (err) {
    console.error('Toggle favorite error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des favoris (paginé)
router.get('/', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM favorites WHERE user_id = $1',
      [req.user.id]
    );

    const result = await pool.query(
      `SELECT f.id, f.created_at as favorited_at,
              u.id as restaurant_id, u.name, u.address,
              COUNT(DISTINCT m.id) as menu_count,
              COALESCE(ROUND(AVG(rt.rating), 1), 0) as avg_rating
       FROM favorites f
       JOIN users u ON f.restaurant_id = u.id
       LEFT JOIN menu_items m ON m.restaurant_id = u.id AND m.is_available = true
       LEFT JOIN ratings rt ON rt.restaurant_id = u.id
       WHERE f.user_id = $1 AND u.is_active = true
       GROUP BY f.id, u.id
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Vérifier si un restaurant est en favori
router.get('/check/:restaurantId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND restaurant_id = $2',
      [req.user.id, req.params.restaurantId]
    );

    res.json({ isFavorite: result.rows.length > 0 });
  } catch (err) {
    console.error('Check favorite error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
