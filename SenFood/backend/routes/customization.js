const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ===== HELPERS =====

// Vérifier qu'un menu_item appartient au restaurant authentifié
async function verifyMenuItemOwnership(menuItemId, userId) {
  const result = await pool.query(
    `SELECT mi.id, mi.restaurant_id
     FROM menu_items mi
     WHERE mi.id = $1 AND mi.restaurant_id = $2`,
    [menuItemId, userId]
  );
  return result.rows.length > 0;
}

// Vérifier qu'un option_group appartient au restaurant via menu_item
async function verifyOptionGroupOwnership(optionGroupId, userId) {
  const result = await pool.query(
    `SELECT og.id
     FROM option_groups og
     JOIN menu_items mi ON og.menu_item_id = mi.id
     WHERE og.id = $1 AND mi.restaurant_id = $2`,
    [optionGroupId, userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Vérifier qu'une option_value appartient au restaurant via option_group -> menu_item
async function verifyOptionValueOwnership(optionValueId, userId) {
  const result = await pool.query(
    `SELECT ov.id
     FROM option_values ov
     JOIN option_groups og ON ov.option_group_id = og.id
     JOIN menu_items mi ON og.menu_item_id = mi.id
     WHERE ov.id = $1 AND mi.restaurant_id = $2`,
    [optionValueId, userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// ===== CLIENT VIEW (public) =====

// Récupérer toutes les options d'un plat
router.get('/menu-item/:menuItemId', async (req, res) => {
  try {
    const { menuItemId } = req.params;

    const result = await pool.query(
      `SELECT og.id, og.name, og.type, og.is_required, og.max_selections,
              json_agg(json_build_object(
                'id', ov.id,
                'name', ov.name,
                'price_extra', ov.price_extra,
                'is_default', ov.is_default,
                'is_available', ov.is_available
              ) ORDER BY ov.id) FILTER (WHERE ov.id IS NOT NULL) as values
       FROM option_groups og
       LEFT JOIN option_values ov ON ov.option_group_id = og.id
       WHERE og.menu_item_id = $1
       GROUP BY og.id, og.name, og.type, og.is_required, og.max_selections
       ORDER BY og.id`,
      [menuItemId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get menu item options error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== RESTAURANT MANAGEMENT =====

// Créer un groupe d'options pour un plat
router.post('/options', authenticate, authorize('restaurant'), [
  body('menu_item_id').isInt({ min: 1 }).withMessage('ID du plat requis'),
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('type').isIn(['single', 'multiple']).withMessage('Type invalide (single ou multiple)'),
  body('is_required').optional().isBoolean().withMessage('is_required doit être un booléen'),
  body('max_selections').optional().isInt({ min: 1 }).withMessage('max_selections doit être un entier positif'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { menu_item_id, name, type, is_required, max_selections } = req.body;
    const restaurantId = req.user.id;

    // Vérifier que le plat appartient au restaurant
    const isOwner = await verifyMenuItemOwnership(menu_item_id, restaurantId);
    if (!isOwner) {
      return res.status(404).json({ error: 'Plat non trouvé' });
    }

    const result = await pool.query(
      `INSERT INTO option_groups (menu_item_id, name, type, is_required, max_selections)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [menu_item_id, name, type, is_required || false, max_selections || null]
    );

    res.status(201).json({
      message: 'Groupe d\'options créé avec succès',
      option_group: result.rows[0],
    });
  } catch (err) {
    console.error('Create option group error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un groupe d'options
router.put('/options/:id', authenticate, authorize('restaurant'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, is_required, max_selections } = req.body;
    const restaurantId = req.user.id;

    // Vérifier que le groupe d'options appartient au restaurant
    const ownership = await verifyOptionGroupOwnership(id, restaurantId);
    if (!ownership) {
      return res.status(404).json({ error: 'Groupe d\'options non trouvé' });
    }

    const result = await pool.query(
      `UPDATE option_groups
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           is_required = COALESCE($3, is_required),
           max_selections = COALESCE($4, max_selections)
       WHERE id = $5
       RETURNING *`,
      [name, type, is_required, max_selections, id]
    );

    res.json({
      message: 'Groupe d\'options mis à jour',
      option_group: result.rows[0],
    });
  } catch (err) {
    console.error('Update option group error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un groupe d'options
router.delete('/options/:id', authenticate, authorize('restaurant'), async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user.id;

    // Vérifier que le groupe d'options appartient au restaurant
    const ownership = await verifyOptionGroupOwnership(id, restaurantId);
    if (!ownership) {
      return res.status(404).json({ error: 'Groupe d\'options non trouvé' });
    }

    await pool.query('DELETE FROM option_groups WHERE id = $1', [id]);

    res.json({ message: 'Groupe d\'options supprimé avec succès' });
  } catch (err) {
    console.error('Delete option group error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter une valeur à un groupe d'options
router.post('/options/:optionId/values', authenticate, authorize('restaurant'), [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('price_extra').optional().isFloat({ min: 0 }).withMessage('Supplément de prix invalide'),
  body('is_default').optional().isBoolean().withMessage('is_default doit être un booléen'),
  body('is_available').optional().isBoolean().withMessage('is_available doit être un booléen'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { optionId } = req.params;
    const { name, price_extra, is_default, is_available } = req.body;
    const restaurantId = req.user.id;

    // Vérifier que le groupe d'options appartient au restaurant
    const ownership = await verifyOptionGroupOwnership(optionId, restaurantId);
    if (!ownership) {
      return res.status(404).json({ error: 'Groupe d\'options non trouvé' });
    }

    const result = await pool.query(
      `INSERT INTO option_values (option_group_id, name, price_extra, is_default, is_available)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [optionId, name, price_extra || 0, is_default || false, is_available !== false]
    );

    res.status(201).json({
      message: 'Valeur d\'option ajoutée avec succès',
      option_value: result.rows[0],
    });
  } catch (err) {
    console.error('Add option value error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour une valeur d'option
router.put('/values/:id', authenticate, authorize('restaurant'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price_extra, is_default, is_available } = req.body;
    const restaurantId = req.user.id;

    // Vérifier que la valeur d'option appartient au restaurant
    const ownership = await verifyOptionValueOwnership(id, restaurantId);
    if (!ownership) {
      return res.status(404).json({ error: 'Valeur d\'option non trouvée' });
    }

    const result = await pool.query(
      `UPDATE option_values
       SET name = COALESCE($1, name),
           price_extra = COALESCE($2, price_extra),
           is_default = COALESCE($3, is_default),
           is_available = COALESCE($4, is_available)
       WHERE id = $5
       RETURNING *`,
      [name, price_extra, is_default, is_available, id]
    );

    res.json({
      message: 'Valeur d\'option mise à jour',
      option_value: result.rows[0],
    });
  } catch (err) {
    console.error('Update option value error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une valeur d'option
router.delete('/values/:id', authenticate, authorize('restaurant'), async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user.id;

    // Vérifier que la valeur d'option appartient au restaurant
    const ownership = await verifyOptionValueOwnership(id, restaurantId);
    if (!ownership) {
      return res.status(404).json({ error: 'Valeur d\'option non trouvée' });
    }

    await pool.query('DELETE FROM option_values WHERE id = $1', [id]);

    res.json({ message: 'Valeur d\'option supprimée avec succès' });
  } catch (err) {
    console.error('Delete option value error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
