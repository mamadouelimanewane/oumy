const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Demander un retrait (livreur ou restaurant)
router.post('/request', authorize('restaurant', 'livreur'), [
  body('amount').isFloat({ min: 1000 }).withMessage('Montant minimum de 1000 FCFA'),
  body('method').isIn(['wave', 'orange_money']).withMessage('Méthode de retrait invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, method } = req.body;
    const userId = req.user.id;

    // Vérifier s'il n'y a pas déjà une demande en attente
    const pending = await pool.query('SELECT id FROM payouts WHERE user_id = $1 AND status = \'en_attente\'', [userId]);
    if (pending.rows.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà une demande de retrait en attente' });
    }

    // Calculer le solde disponible (gains des commandes livrées - retraits deja
    // payes ou en attente), pour empecher une demande de retrait superieure aux
    // gains reels de l'utilisateur.
    const earningsQuery = req.user.role === 'livreur'
      ? `SELECT COALESCE(SUM(delivery_fee), 0) AS total FROM orders WHERE courier_id = $1 AND status = 'livree'`
      : `SELECT COALESCE(SUM(total_amount - COALESCE(delivery_fee, 0)), 0) AS total FROM orders WHERE restaurant_id = $1 AND status = 'livree'`;
    const earningsResult = await pool.query(earningsQuery, [userId]);
    const totalEarnings = parseFloat(earningsResult.rows[0].total);

    const alreadyWithdrawnResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payouts WHERE user_id = $1 AND status IN ('en_attente', 'paye')`,
      [userId]
    );
    const alreadyWithdrawn = parseFloat(alreadyWithdrawnResult.rows[0].total);

    const available = totalEarnings - alreadyWithdrawn;
    if (parseFloat(amount) > available) {
      return res.status(400).json({
        error: `Solde disponible insuffisant (${available} FCFA disponible pour ${amount} FCFA demandes)`,
        available,
      });
    }

    const result = await pool.query(
      `INSERT INTO payouts (user_id, amount, method, status)
       VALUES ($1, $2, $3, 'en_attente')
       RETURNING *`,
      [userId, amount, method]
    );

    // Notifier les admins (via Socket.IO si besoin)
    if (req.io) {
      req.io.to('admin').emit('new_payout_request', {
        id: result.rows[0].id,
        userName: req.user.name,
        amount
      });
    }

    res.status(201).json({
      message: 'Demande de retrait enregistrée. Traitement sous 24h.',
      payout: result.rows[0]
    });
  } catch (err) {
    console.error('Payout request error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer son historique de retraits
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
       'SELECT * FROM payouts WHERE user_id = $1 ORDER BY created_at DESC',
       [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Payout history error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === ROUTES ADMIN ===

// Lister toutes les demandes de retrait (admin seulement)
router.get('/all', authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as user_name, u.role as user_role, u.phone as user_phone
       FROM payouts p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.status DESC, p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('All payouts error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Valider ou rejeter un retrait (admin)
router.put('/:id', authorize('admin'), [
  body('status').isIn(['paye', 'rejete']).withMessage('Statut invalide'),
  body('reference_id').optional().trim(),
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reference_id } = req.body;

    const result = await pool.query(
      'UPDATE payouts SET status = $1, reference_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, reference_id, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Demande non trouvée' });

    const payout = result.rows[0];

    // Notifier l'utilisateur
    if (req.io) {
      req.io.to(`user_${payout.user_id}`).emit('notification', {
        type: 'payout_update',
        title: status === 'paye' ? 'Retrait effectué ✅' : 'Retrait rejeté ❌',
        message: status === 'paye' 
          ? `Votre retrait de ${payout.amount} FCFA a été validé.` 
          : `Votre retrait de ${payout.amount} FCFA a été rejeté. Veuillez contacter le support.`
      });
    }

    res.json({ message: 'Demande mise à jour', payout });
  } catch (err) {
    console.error('Update payout error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
