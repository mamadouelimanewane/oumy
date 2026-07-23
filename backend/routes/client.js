const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../middleware/pagination');
const { sendPushToUser } = require('../lib/webpush');

const router = express.Router();

// Frais de livraison (Haversine) : 500 FCFA de base + 200 FCFA/km, 500 FCFA
// par défaut si les coordonnées du restaurant ou du point de livraison
// manquent.
function calculateDeliveryFee(restLat, restLng, lat, lng) {
  if (!restLat || !restLng || !lat || !lng) return 500;
  const R = 6371;
  const dLat = (parseFloat(lat) - parseFloat(restLat)) * Math.PI / 180;
  const dLng = (parseFloat(lng) - parseFloat(restLng)) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(parseFloat(restLat) * Math.PI / 180) *
            Math.cos(parseFloat(lat) * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance_km = Math.round(R * c * 10) / 10;
  return 500 + Math.round(distance_km * 200);
}

// Récupérer tous les restaurants actifs (paginé, avec note moyenne et horaires)
router.get('/restaurants', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { open } = req.query;

    let whereClause = `WHERE u.role = 'restaurant' AND u.is_active = true`;

    // Filtre restaurants ouverts maintenant
    if (open === 'true') {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM restaurant_hours rh
        WHERE rh.restaurant_id = u.id
        AND rh.day_of_week = EXTRACT(DOW FROM CURRENT_TIMESTAMP)
        AND CURRENT_TIME BETWEEN rh.open_time AND rh.close_time
      )`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT u.id) as total FROM users u ${whereClause}`
    );

    const result = await pool.query(
      `SELECT u.id, u.name, u.address, u.latitude, u.longitude, u.created_at,
              COUNT(DISTINCT m.id) as menu_count,
              COALESCE(ROUND(AVG(rt.rating), 1), 0) as avg_rating,
              COUNT(DISTINCT rt.id) as rating_count,
              EXISTS (
                SELECT 1 FROM restaurant_hours rh
                WHERE rh.restaurant_id = u.id
                AND rh.day_of_week = EXTRACT(DOW FROM CURRENT_TIMESTAMP)
                AND CURRENT_TIME BETWEEN rh.open_time AND rh.close_time
              ) as is_open
       FROM users u
       LEFT JOIN menu_items m ON m.restaurant_id = u.id AND m.is_available = true
       LEFT JOIN ratings rt ON rt.restaurant_id = u.id
       ${whereClause}
       GROUP BY u.id
       ORDER BY u.name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get restaurants error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer un restaurant avec son menu
router.get('/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const restaurantResult = await pool.query(
      'SELECT id, name, address, phone, created_at FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [id, 'restaurant']
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const menuResult = await pool.query(
      `SELECT id, name, description, price, image_url, category, is_available
       FROM menu_items 
       WHERE restaurant_id = $1 AND is_available = true
       ORDER BY category, name`,
      [id]
    );

    res.json({
      ...restaurantResult.rows[0],
      menu: menuResult.rows,
    });
  } catch (err) {
    console.error('Get restaurant error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer tous les plats (paginé, avec filtres et recherche améliorée)
router.get('/plats', async (req, res) => {
  try {
    const { category, restaurant_id, search, min_price, max_price } = req.query;
    const { page, limit, offset } = paginate(req.query);

    let whereClause = 'WHERE m.is_available = true AND r.is_active = true AND (m.available_from IS NULL OR m.available_from <= CURRENT_TIMESTAMP) AND (m.available_until IS NULL OR m.available_until >= CURRENT_TIMESTAMP)';
    const params = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND m.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (restaurant_id) {
      whereClause += ` AND m.restaurant_id = $${paramIndex}`;
      params.push(restaurant_id);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (m.name ILIKE $${paramIndex} OR m.description ILIKE $${paramIndex} OR m.category ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (min_price) {
      whereClause += ` AND m.price >= $${paramIndex}`;
      params.push(min_price);
      paramIndex++;
    }

    if (max_price) {
      whereClause += ` AND m.price <= $${paramIndex}`;
      params.push(max_price);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM menu_items m JOIN users r ON m.restaurant_id = r.id ${whereClause}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT m.id, m.restaurant_id, m.name, m.description, m.price,
             m.image_url, m.category, r.name as restaurant_name
       FROM menu_items m
       JOIN users r ON m.restaurant_id = r.id
       ${whereClause}
       ORDER BY m.category, m.name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get plats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une commande (nécessite authentification)
router.post('/orders', authenticate, [
  body('restaurant_id').isInt().withMessage('ID restaurant requis'),
  body('items').isArray({ min: 1 }).withMessage('Au moins un article requis'),
  body('delivery_address').trim().notEmpty().withMessage('Adresse de livraison requise'),
  body('payment_method').isIn(['wave', 'orange_money', 'cash']).withMessage('Méthode de paiement invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { restaurant_id, items, delivery_address, latitude, longitude, payment_method, promo_code } = req.body;
    const client_id = req.user.id;

    // Vérifier que le restaurant existe
    const restaurantCheck = await pool.query(
      'SELECT id, latitude, longitude FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [restaurant_id, 'restaurant']
    );

    if (restaurantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const restaurant = restaurantCheck.rows[0];
    const delivery_fee = calculateDeliveryFee(restaurant.latitude, restaurant.longitude, latitude, longitude);

    // Calculer le total et vérifier les articles
    let total_amount = 0;
    const orderItems = [];

    for (const item of items) {
      const menuResult = await pool.query(
        'SELECT price, is_available, restaurant_id FROM menu_items WHERE id = $1',
        [item.menu_item_id]
      );

      if (menuResult.rows.length === 0) {
        return res.status(404).json({ error: `Article ${item.menu_item_id} non trouvé` });
      }

      const menuItem = menuResult.rows[0];
      
      if (!menuItem.is_available) {
        return res.status(400).json({ error: `Article ${item.menu_item_id} non disponible` });
      }

      if (menuItem.restaurant_id !== parseInt(restaurant_id)) {
        return res.status(400).json({ error: 'Tous les articles doivent être du même restaurant' });
      }

      const itemTotal = menuItem.price * item.quantity;
      total_amount += itemTotal;
      orderItems.push({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price_at_time: menuItem.price,
      });
    }

    // Appliquer code promo si fourni
    let discount_amount = 0;
    let applied_promo = null;
    if (promo_code) {
      const promoResult = await pool.query(
        `SELECT * FROM promotions
         WHERE code = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (max_uses = 0 OR current_uses < max_uses)`,
        [promo_code.toUpperCase()]
      );

      if (promoResult.rows.length > 0) {
        const promo = promoResult.rows[0];
        if ((!promo.restaurant_id || promo.restaurant_id === parseInt(restaurant_id)) &&
            total_amount >= parseFloat(promo.min_order_amount)) {
          if (promo.discount_type === 'percentage') {
            discount_amount = Math.round(total_amount * parseFloat(promo.discount_value) / 100);
          } else {
            discount_amount = parseFloat(promo.discount_value);
          }
          discount_amount = Math.min(discount_amount, total_amount);
          applied_promo = promo.code;
        }
      }
    }

    const final_amount = total_amount - discount_amount;

    // Créer la commande
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address, latitude, longitude, discount_amount, promo_code, delivery_fee)
         VALUES ($1, $2, 'nouvelle', $3, $4, 'en_attente', $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [client_id, restaurant_id, final_amount, payment_method, delivery_address, latitude, longitude, discount_amount, applied_promo, delivery_fee]
      );

      // Incrémenter l'utilisation du code promo
      if (applied_promo) {
        await client.query(
          'UPDATE promotions SET current_uses = current_uses + 1 WHERE code = $1',
          [applied_promo]
        );
      }

      const order = orderResult.rows[0];

      // Insérer les articles de la commande
      for (const item of orderItems) {
        await client.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
          [order.id, item.menu_item_id, item.quantity, item.price_at_time]
        );
      }

      // Créer une notification pour le restaurant
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'new_order', 'Nouvelle commande', 'Vous avez reçu une nouvelle commande', $2)`,
        [restaurant_id, JSON.stringify({ order_id: order.id })]
      );

      await client.query('COMMIT');

      // Émettre via Socket.IO vers le restaurant
      if (req.io) {
        req.io.to(`user_${restaurant_id}`).emit('new_order_notification', {
          orderId: order.id,
          message: 'Nouvelle commande reçue !',
          total: total_amount,
        });
      }

      // Notification push reelle (utile si le restaurant n'a pas l'app ouverte)
      sendPushToUser(restaurant_id, {
        title: 'Nouvelle commande !',
        body: `Commande #${order.id} - ${total_amount} FCFA`,
      });

      res.status(201).json({
        message: 'Commande créée avec succès',
        order: {
          ...order,
          items: orderItems,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les commandes du client connecté (paginé)
router.get('/orders', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;

    let whereClause = 'WHERE o.client_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT o.*, r.name as restaurant_name,
              json_agg(json_build_object(
                'id', oi.id,
                'name', m.name,
                'quantity', oi.quantity,
                'price', oi.price_at_time
              )) as items
       FROM orders o
       JOIN users r ON o.restaurant_id = r.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       ${whereClause}
       GROUP BY o.id, r.name
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    res.json(paginatedResponse(result.rows, countResult.rows[0].total, { page, limit }));
  } catch (err) {
    console.error('Get client orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Suivi d'une commande
router.get('/orders/:id/track', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              r.latitude as restaurant_lat, r.longitude as restaurant_lng,
              c.name as courier_name, c.phone as courier_phone,
              cl.latitude as courier_lat, cl.longitude as courier_lng
       FROM orders o
       JOIN users r ON o.restaurant_id = r.id
       LEFT JOIN users c ON o.courier_id = c.id
       LEFT JOIN courier_locations cl ON cl.courier_id = o.courier_id
       WHERE o.id = $1 AND (o.client_id = $2 OR o.restaurant_id = $2 OR o.courier_id = $2)`,
      [id, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json(orderResult.rows[0]);
  } catch (err) {
    console.error('Track order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Annuler une commande (seulement si status = 'nouvelle')
router.put('/orders/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const orderCheck = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND client_id = $2',
      [id, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = orderCheck.rows[0];

    if (order.status !== 'nouvelle') {
      return res.status(400).json({ error: 'Seules les commandes en statut "nouvelle" peuvent être annulées' });
    }

    await pool.query(
      `UPDATE orders SET status = 'annulee', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Notifier le restaurant
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'order_cancelled', 'Commande annulée', 'Le client a annulé sa commande', $2)`,
      [order.restaurant_id, JSON.stringify({ order_id: id })]
    );

    // Émettre via Socket.IO
    if (req.io) {
      req.io.to(`user_${order.restaurant_id}`).emit('order_cancelled', {
        orderId: parseInt(id),
        message: 'Le client a annulé sa commande',
      });
    }

    res.json({ message: 'Commande annulée avec succès' });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Calculer les frais de livraison (Haversine)
router.get('/delivery-fee', authenticate, async (req, res) => {
  try {
    const { restaurant_id, lat, lng } = req.query;

    if (!restaurant_id || !lat || !lng) {
      return res.status(400).json({ error: 'restaurant_id, lat et lng sont requis' });
    }

    const restaurantResult = await pool.query(
      'SELECT latitude, longitude FROM users WHERE id = $1 AND role = $2 AND is_active = true',
      [restaurant_id, 'restaurant']
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    const restaurant = restaurantResult.rows[0];

    // Si le restaurant n'a pas de coordonnées, frais par défaut
    if (!restaurant.latitude || !restaurant.longitude) {
      return res.json({ distance_km: 0, delivery_fee: 500 });
    }

    // Calcul Haversine
    const R = 6371; // Rayon terre en km
    const dLat = (parseFloat(lat) - parseFloat(restaurant.latitude)) * Math.PI / 180;
    const dLng = (parseFloat(lng) - parseFloat(restaurant.longitude)) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(parseFloat(restaurant.latitude) * Math.PI / 180) *
              Math.cos(parseFloat(lat) * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance_km = Math.round(R * c * 10) / 10;

    // Barème: 500 FCFA base + 200 FCFA/km
    const delivery_fee = 500 + Math.round(distance_km * 200);

    res.json({ distance_km, delivery_fee });
  } catch (err) {
    console.error('Delivery fee error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Re-commander une commande précédente
router.post('/orders/:id/reorder', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_address, latitude, longitude, payment_method } = req.body;

    // Récupérer la commande originale avec ses items
    const orderCheck = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND client_id = $2',
      [id, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const originalOrder = orderCheck.rows[0];

    // Récupérer les items de la commande originale
    const itemsResult = await pool.query(
      `SELECT oi.menu_item_id, oi.quantity, m.price, m.is_available, m.restaurant_id
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.order_id = $1`,
      [id]
    );

    if (itemsResult.rows.length === 0) {
      return res.status(400).json({ error: 'Aucun article trouvé dans la commande originale' });
    }

    // Vérifier la disponibilité des articles
    const unavailable = itemsResult.rows.filter(item => !item.is_available);
    if (unavailable.length > 0) {
      return res.status(400).json({ error: 'Certains articles ne sont plus disponibles' });
    }

    // Calculer le nouveau total avec les prix actuels
    let total_amount = 0;
    const orderItems = itemsResult.rows.map(item => {
      const itemTotal = parseFloat(item.price) * item.quantity;
      total_amount += itemTotal;
      return {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price_at_time: item.price,
      };
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (client_id, restaurant_id, status, total_amount, payment_method, payment_status, delivery_address, latitude, longitude)
         VALUES ($1, $2, 'nouvelle', $3, $4, 'en_attente', $5, $6, $7)
         RETURNING *`,
        [req.user.id, originalOrder.restaurant_id, total_amount,
         payment_method || originalOrder.payment_method,
         delivery_address || originalOrder.delivery_address,
         latitude || originalOrder.latitude,
         longitude || originalOrder.longitude]
      );

      const newOrder = orderResult.rows[0];

      for (const item of orderItems) {
        await client.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
          [newOrder.id, item.menu_item_id, item.quantity, item.price_at_time]
        );
      }

      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'new_order', 'Nouvelle commande', 'Vous avez reçu une nouvelle commande', $2)`,
        [originalOrder.restaurant_id, JSON.stringify({ order_id: newOrder.id })]
      );

      await client.query('COMMIT');

      if (req.io) {
        req.io.to(`user_${originalOrder.restaurant_id}`).emit('new_order_notification', {
          orderId: newOrder.id,
          message: 'Nouvelle commande reçue !',
          total: total_amount,
        });
      }

      res.status(201).json({
        message: 'Commande recréée avec succès',
        order: { ...newOrder, items: orderItems },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Reorder error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Estimation du temps de livraison
router.get('/delivery-time', authenticate, async (req, res) => {
  try {
    const { restaurant_id, lat, lng } = req.query;

    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurant_id requis' });
    }

    // Temps de préparation moyen du restaurant
    const prepResult = await pool.query(
      `SELECT COALESCE(AVG(prep_time_minutes), 15) as avg_prep_time
       FROM menu_items WHERE restaurant_id = $1 AND is_available = true`,
      [restaurant_id]
    );
    const prepTime = Math.round(parseFloat(prepResult.rows[0].avg_prep_time));

    // Temps de trajet estimé (si coordonnées fournies)
    let travelTime = 10; // défaut 10 min
    if (lat && lng) {
      const restaurantResult = await pool.query(
        'SELECT latitude, longitude FROM users WHERE id = $1',
        [restaurant_id]
      );

      if (restaurantResult.rows.length > 0 && restaurantResult.rows[0].latitude) {
        const r = restaurantResult.rows[0];
        const R = 6371;
        const dLat = (parseFloat(lat) - parseFloat(r.latitude)) * Math.PI / 180;
        const dLng = (parseFloat(lng) - parseFloat(r.longitude)) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(parseFloat(r.latitude) * Math.PI / 180) *
                  Math.cos(parseFloat(lat) * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance_km = R * c;
        // Vitesse moyenne 25 km/h en ville
        travelTime = Math.max(5, Math.round(distance_km / 25 * 60));
      }
    }

    const totalEstimate = prepTime + travelTime + 5; // +5 min marge

    res.json({
      prep_time_minutes: prepTime,
      travel_time_minutes: travelTime,
      estimated_total_minutes: totalEstimate,
    });
  } catch (err) {
    console.error('Delivery time estimation error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
