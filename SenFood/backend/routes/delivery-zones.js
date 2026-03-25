const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /delivery-zones - Public: list zones
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM delivery_zones WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Get delivery zones error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /delivery-zones/calculate - Calculate delivery fee
router.post('/calculate', [
  body('restaurant_lat').isFloat(),
  body('restaurant_lng').isFloat(),
  body('delivery_lat').isFloat(),
  body('delivery_lng').isFloat(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { restaurant_lat, restaurant_lng, delivery_lat, delivery_lng } = req.body;

    // Haversine distance
    const R = 6371;
    const dLat = (delivery_lat - restaurant_lat) * Math.PI / 180;
    const dLng = (delivery_lng - restaurant_lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(restaurant_lat * Math.PI / 180) * Math.cos(delivery_lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Get matching zone
    const zones = await pool.query(
      'SELECT * FROM delivery_zones WHERE is_active = true AND (max_distance_km IS NULL OR max_distance_km >= $1) ORDER BY base_fee ASC LIMIT 1',
      [distance]
    );

    if (zones.rows.length === 0) return res.status(400).json({ error: 'Zone de livraison non desservie' });

    const zone = zones.rows[0];
    const fee = parseFloat(zone.base_fee) + (distance * parseFloat(zone.price_per_km));
    const roundedFee = Math.ceil(fee / 100) * 100; // Round up to nearest 100 FCFA

    res.json({
      distance_km: Math.round(distance * 10) / 10,
      delivery_fee: roundedFee,
      zone: zone.name,
      estimated_time_min: Math.round(distance * 4 + 10),
    });
  } catch (err) {
    console.error('Calculate delivery fee error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /delivery-zones - Admin: create zone
router.post('/', authenticate, authorize('admin'), [
  body('name').trim().notEmpty(),
  body('base_fee').isFloat({ min: 0 }),
  body('price_per_km').isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, base_fee, price_per_km, max_distance_km, min_order_amount } = req.body;
    const result = await pool.query(
      'INSERT INTO delivery_zones (name, base_fee, price_per_km, max_distance_km, min_order_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, base_fee, price_per_km, max_distance_km, min_order_amount || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create zone error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== RELAY POINTS =====

// GET /delivery-zones/relay-points
router.get('/relay-points', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM relay_points WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Get relay points error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /delivery-zones/relay-points - Admin
router.post('/relay-points', authenticate, authorize('admin'), [
  body('name').trim().notEmpty(),
  body('address').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, address, latitude, longitude, opening_hours } = req.body;
    const result = await pool.query(
      'INSERT INTO relay_points (name, address, latitude, longitude, opening_hours) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, address, latitude, longitude, opening_hours]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create relay point error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
