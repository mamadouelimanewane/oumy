const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

// Inscription
router.post('/register', [
  body('role').isIn(['client', 'restaurant', 'livreur']).withMessage('Rôle invalide'),
  body('name').trim().isLength({ min: 2 }).withMessage('Nom requis (min 2 caractères)'),
  body('phone').trim().matches(/^\+?[0-9]{8,15}$/).withMessage('Numéro de téléphone invalide'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe min 6 caractères'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role, name, phone, email, password, address } = req.body;

    // Vérifier si le téléphone existe déjà
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Ce numéro est déjà utilisé' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const result = await pool.query(
      `INSERT INTO users (role, name, phone, email, password, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, role, name, phone, email, address, created_at`,
      [role, name, phone, email || null, hashedPassword, address || null]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      message: 'Inscription réussie',
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address,
      },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
router.post('/login', [
  body('phone').trim().notEmpty().withMessage('Téléphone requis'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password } = req.body;

    // Chercher l'utilisateur
    const result = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Compte désactivé' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Profil utilisateur connecté
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, role, name, phone, email, address, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour le profil
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, email, address } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name), 
           email = COALESCE($2, email), 
           address = COALESCE($3, address),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, role, name, phone, email, address`,
      [name, email, address, req.user.id]
    );

    res.json({
      message: 'Profil mis à jour',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Changer le mot de passe
router.put('/password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  body('newPassword').isLength({ min: 6 }).withMessage('Nouveau mot de passe min 6 caractères'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Vérifier l'ancien mot de passe
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher et mettre à jour le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
