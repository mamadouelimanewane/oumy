const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

// Fraud detection helper
async function checkOrderFraud(orderId) {
  const alerts = [];
  const order = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (order.rows.length === 0) return alerts;
  const o = order.rows[0];

  // Check 1: Multiple orders in short time
  const recentOrders = await pool.query(
    `SELECT COUNT(*) as cnt FROM orders WHERE client_id = $1
     AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 minutes' AND id != $2`,
    [o.client_id, orderId]
  );
  if (parseInt(recentOrders.rows[0].cnt) >= 3) {
    alerts.push({ type: 'rapid_orders', severity: 'medium', description: `${recentOrders.rows[0].cnt} commandes en 30 min` });
  }

  // Check 2: High-value order from new account
  const user = await pool.query('SELECT created_at FROM users WHERE id = $1', [o.client_id]);
  const accountAge = (Date.now() - new Date(user.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (accountAge < 1 && parseFloat(o.total_amount) > 50000) {
    alerts.push({ type: 'new_account_high_value', severity: 'high', description: `Compte < 24h, commande ${o.total_amount} FCFA` });
  }

  // Check 3: Multiple promo code usage
  if (o.promo_code) {
    const promoUse = await pool.query(
      'SELECT COUNT(*) as cnt FROM orders WHERE client_id = $1 AND promo_code IS NOT NULL',
      [o.client_id]
    );
    if (parseInt(promoUse.rows[0].cnt) > 10) {
      alerts.push({ type: 'promo_abuse', severity: 'high', description: `${promoUse.rows[0].cnt} promos utilisées` });
    }
  }

  // Check 4: Delivery far from usual location
  if (o.latitude && o.longitude) {
    const usualLocation = await pool.query(
      `SELECT AVG(latitude) as lat, AVG(longitude) as lng FROM orders
       WHERE client_id = $1 AND latitude IS NOT NULL AND id != $2`,
      [o.client_id, orderId]
    );
    if (usualLocation.rows[0].lat) {
      const dist = Math.sqrt(
        Math.pow(parseFloat(usualLocation.rows[0].lat) - parseFloat(o.latitude), 2) +
        Math.pow(parseFloat(usualLocation.rows[0].lng) - parseFloat(o.longitude), 2)
      ) * 111;
      if (dist > 20) {
        alerts.push({ type: 'unusual_location', severity: 'low', description: `${Math.round(dist)} km de la localisation habituelle` });
      }
    }
  }

  // Store alerts
  for (const alert of alerts) {
    await pool.query(
      'INSERT INTO fraud_alerts (user_id, order_id, alert_type, severity, description) VALUES ($1, $2, $3, $4, $5)',
      [o.client_id, orderId, alert.type, alert.severity, alert.description]
    );
  }

  return alerts;
}

// GET /fraud/alerts
router.get('/alerts', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { severity, resolved } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (severity) { params.push(severity); where += ` AND fa.severity = $${params.length}`; }
    if (resolved !== undefined) { params.push(resolved === 'true'); where += ` AND fa.is_resolved = $${params.length}`; }

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM fraud_alerts fa ${where}`, params);
    const result = await pool.query(
      `SELECT fa.*, u.name as user_name, u.phone as user_phone
       FROM fraud_alerts fa JOIN users u ON fa.user_id = u.id
       ${where} ORDER BY fa.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get fraud alerts error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /fraud/alerts/:id/resolve
router.put('/alerts/:id/resolve', async (req, res) => {
  try {
    await pool.query(
      'UPDATE fraud_alerts SET is_resolved = true, resolved_by = $1 WHERE id = $2',
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Alerte résolue' });
  } catch (err) {
    console.error('Resolve fraud alert error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /fraud/check/:orderId - Manually check an order
router.post('/check/:orderId', async (req, res) => {
  try {
    const alerts = await checkOrderFraud(parseInt(req.params.orderId));
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    console.error('Check fraud error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Export for use in order creation
module.exports = router;
module.exports.checkOrderFraud = checkOrderFraud;
