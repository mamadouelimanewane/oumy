const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();

// Vérifier / appliquer un code promo (client)
router.post('/validate', authenticate, [
  body('code').trim().notEmpty().withMessage('Code promo requis'),
  body('order_amount').isFloat({ min: 0 }).withMessage('Montant requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { code, order_amount, restaurant_id } = req.body;

    const result = await pool.query(
      `SELECT * FROM promotions
       WHERE code = $1 AND is_active = true
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
       AND (max_uses = 0 OR current_uses < max_uses)`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Code promo invalide ou expiré' });
    }

    const promo = result.rows[0];

    // Vérifier si la promo est liée à un restaurant spécifique
    if (promo.restaurant_id && restaurant_id && promo.restaurant_id !== parseInt(restaurant_id)) {
      return res.status(400).json({ error: 'Ce code promo n\'est pas valable pour ce restaurant' });
    }

    // Vérifier le montant minimum
    if (parseFloat(order_amount) < parseFloat(promo.min_order_amount)) {
      return res.status(400).json({ error: `Commande minimum de ${promo.min_order_amount} FCFA requise` });
    }

    // Calculer la réduction
    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = Math.round(parseFloat(order_amount) * parseFloat(promo.discount_value) / 100);
    } else {
      discount = parseFloat(promo.discount_value);
    }

    // Ne pas dépasser le montant de la commande
    discount = Math.min(discount, parseFloat(order_amount));

    res.json({
      valid: true,
      code: promo.code,
      description: promo.description,
      discount_type: promo.discount_type,
      discount_value: parseFloat(promo.discount_value),
      discount_amount: discount,
      final_amount: parseFloat(order_amount) - discount,
    });
  } catch (err) {
    console.error('Validate promo error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === Routes Admin ===

// Créer une promotion (admin)
router.post('/', authenticate, authorize('admin'), [
  body('code').trim().notEmpty().withMessage('Code requis'),
  body('discount_type').isIn(['percentage', 'fixed']).withMessage('Type invalide'),
  body('discount_value').isFloat({ min: 0 }).withMessage('Valeur invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { code, description, discount_type, discount_value, min_order_amount, max_uses, restaurant_id, starts_at, expires_at } = req.body;

    const result = await pool.query(
      `INSERT INTO promotions (code, description, discount_type, discount_value, min_order_amount, max_uses, restaurant_id, starts_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [code.toUpperCase(), description, discount_type, discount_value, min_order_amount || 0, max_uses || 0, restaurant_id, starts_at, expires_at]
    );

    res.status(201).json({ message: 'Promotion créée', promotion: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ce code existe déjà' });
    console.error('Create promo error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les promotions (admin)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const countResult = await pool.query('SELECT COUNT(*) as total FROM promotions');
    const result = await pool.query(
      `SELECT p.*, r.name as restaurant_name
       FROM promotions p
       LEFT JOIN users r ON p.restaurant_id = r.id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('List promos error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Activer/Désactiver une promotion (admin)
router.put('/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE promotions SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Promotion non trouvée' });

    res.json({ message: `Promotion ${result.rows[0].is_active ? 'activée' : 'désactivée'}`, promotion: result.rows[0] });
  } catch (err) {
    console.error('Toggle promo error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une promotion (admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM promotions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promotion non trouvée' });
    res.json({ message: 'Promotion supprimée' });
  } catch (err) {
    console.error('Delete promo error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
