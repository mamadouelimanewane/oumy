/**
 * 🇸🇳 NOOR EAT Backend API - Production Ready
 * PostgreSQL + JWT + Socket.IO + Full Features
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { pool, initDatabase } = require('./config/database');
const { authenticate, authorize } = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const restaurantRoutes = require('./routes/restaurant');
const livreurRoutes = require('./routes/livreur');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const ratingRoutes = require('./routes/ratings');
const favoriteRoutes = require('./routes/favorites');
const promotionRoutes = require('./routes/promotions');
const addressRoutes = require('./routes/addresses');
const chatRoutes = require('./routes/chat');
const loyaltyRoutes = require('./routes/loyalty');
const payoutRoutes = require('./routes/payouts');
// New feature routes
const walletRoutes = require('./routes/wallet');
const customizationRoutes = require('./routes/customization');
const scheduledRoutes = require('./routes/scheduled');
const gamificationRoutes = require('./routes/gamification');
const giftcardRoutes = require('./routes/giftcards');
const tipsRoutes = require('./routes/tips');
const supportRoutes = require('./routes/support');
const subscriptionRoutes = require('./routes/subscriptions');
const deliveryZoneRoutes = require('./routes/delivery-zones');
const storiesRoutes = require('./routes/stories');
const socialRoutes = require('./routes/social');
const stockRoutes = require('./routes/stock');
const cateringRoutes = require('./routes/catering');
const qrcodeRoutes = require('./routes/qrcodes');
const recommendationRoutes = require('./routes/recommendations');
const fraudRoutes = require('./routes/fraud');
// Wave 2 feature routes
const reorderRoutes = require('./routes/reorder');
const chatLiveRoutes = require('./routes/chat-live');
const preferencesRoutes = require('./routes/preferences');
const referralRoutes = require('./routes/referral');
const groupOrderRoutes = require('./routes/group-orders');
const mealPlanRoutes = require('./routes/meal-plans');
const miniGameRoutes = require('./routes/mini-games');
const analyticsRestaurantRoutes = require('./routes/analytics-restaurant');
const priceAlertRoutes = require('./routes/price-alerts');
const splitPaymentRoutes = require('./routes/split-payment');
// Wave 3 feature routes
const photoReviewRoutes = require('./routes/photo-reviews');
const notificationsPushRoutes = require('./routes/notifications-push');
const voiceOrderRoutes = require('./routes/voice-order');
const twofaRoutes = require('./routes/twofa');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(',');

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

// Rate limiting sur les routes auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Attacher io aux requêtes pour les notifications
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ==========================================
// 🛣️ ROUTES
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'NOOR EAT API is running', 
    version: '2.0.0 (PostgreSQL + JWT + Socket.IO)',
    timestamp: new Date().toISOString()
  });
});

// Auth routes (publiques, avec rate limiting)
app.use('/api/auth', authLimiter, authRoutes);

// Client routes
app.use('/api/client', clientRoutes);

// Restaurant routes
app.use('/api/restaurant', restaurantRoutes);

// Livreur routes
app.use('/api/livreur', livreurRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Notifications routes
app.use('/api/notifications', notificationRoutes);

// Ratings routes
app.use('/api/ratings', ratingRoutes);

// Favorites routes
app.use('/api/favorites', favoriteRoutes);

// Promotions routes
app.use('/api/promotions', promotionRoutes);

// Addresses routes
app.use('/api/addresses', addressRoutes);

// Chat routes
app.use('/api/chat', chatRoutes);

// Loyalty routes
app.use('/api/loyalty', loyaltyRoutes);

// Payouts routes
app.use('/api/payouts', payoutRoutes);

// ===== NEW FEATURE ROUTES =====
app.use('/api/wallet', walletRoutes);
app.use('/api/customization', customizationRoutes);
app.use('/api/scheduled', scheduledRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/giftcards', giftcardRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/delivery-zones', deliveryZoneRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/catering', cateringRoutes);
app.use('/api/qrcodes', qrcodeRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/fraud', fraudRoutes);

// ===== WAVE 2 FEATURE ROUTES =====
app.use('/api/reorder', reorderRoutes);
app.use('/api/chat-live', chatLiveRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/group-orders', groupOrderRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/mini-games', miniGameRoutes);
app.use('/api/analytics-restaurant', analyticsRestaurantRoutes);
app.use('/api/price-alerts', priceAlertRoutes);
app.use('/api/split-payment', splitPaymentRoutes);

// ===== WAVE 3 FEATURE ROUTES =====
app.use('/api/photo-reviews', photoReviewRoutes);
app.use('/api/notifications-push', notificationsPushRoutes);
app.use('/api/voice-order', voiceOrderRoutes);
app.use('/api/2fa', twofaRoutes);

// ==========================================
// 🔌 SOCKET.IO - Temps Réel
// ==========================================

const connectedUsers = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token manquant'));
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT id, role, name FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return next(new Error('Utilisateur non trouvé'));
    }

    socket.user = result.rows[0];
    next();
  } catch (err) {
    next(new Error('Authentification invalide'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Utilisateur connecté: ${socket.user.name} (${socket.user.role})`);
  
  connectedUsers.set(socket.user.id, {
    socketId: socket.id,
    userId: socket.user.id,
    role: socket.user.role,
    name: socket.user.name,
  });

  // Rejoindre une room spécifique au rôle
  socket.join(socket.user.role);
  socket.join(`user_${socket.user.id}`);

  // Position du livreur (temps réel)
  socket.on('courier_location', async (data) => {
    if (socket.user.role !== 'livreur') return;

    const { latitude, longitude, orderId } = data;

    // Validation des coordonnées
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return;
    }

    try {
      // Mettre à jour la position en DB
      await pool.query(
        `INSERT INTO courier_locations (courier_id, latitude, longitude, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (courier_id) 
         DO UPDATE SET latitude = $2, longitude = $3, updated_at = CURRENT_TIMESTAMP`,
        [socket.user.id, latitude, longitude]
      );
      
      // Enregistrer l'historique
      await pool.query(
        `INSERT INTO courier_location_history (courier_id, latitude, longitude)
         VALUES ($1, $2, $3)`,
        [socket.user.id, latitude, longitude]
      );

      // Broadcast global pour le dashboard admin (optionnel pour fleet monitoring)
      io.to('admin').emit('fleet_location_update', {
        courierId: socket.user.id,
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });

      // Notifier le client et le restaurant si commande en cours
      if (orderId) {
        const orderResult = await pool.query(
          'SELECT client_id, restaurant_id FROM orders WHERE id = $1 AND courier_id = $2',
          [orderId, socket.user.id]
        );

        if (orderResult.rows.length > 0) {
          const { client_id, restaurant_id } = orderResult.rows[0];
          
          const payload = {
            orderId,
            latitude,
            longitude,
            courierId: socket.user.id,
            timestamp: new Date().toISOString()
          };

          // Envoyer au client
          io.to(`user_${client_id}`).emit('courier_location_update', payload);
          // Envoyer au restaurant
          io.to(`user_${restaurant_id}`).emit('courier_location_update', payload);
        }
      }
    } catch (err) {
      console.error('Location update error:', err);
    }
  });

  // Nouvelle commande (restaurant notifié)
  socket.on('new_order', async (data) => {
    const { restaurantId, orderId } = data;
    
    io.to(`user_${restaurantId}`).emit('new_order_notification', {
      orderId,
      message: 'Nouvelle commande reçue !',
    });
  });

  // Mise à jour statut commande
  socket.on('order_status_update', async (data) => {
    const { orderId, status, userId } = data;
    
    io.to(`user_${userId}`).emit('order_status_changed', {
      orderId,
      status,
      timestamp: new Date().toISOString(),
    });
  });

  // Livreur disponible
  socket.on('courier_available', async () => {
    if (socket.user.role !== 'livreur') return;
    
    await pool.query(
      'UPDATE users SET is_active = true WHERE id = $1',
      [socket.user.id]
    );
    
    io.to('admin').emit('courier_status_changed', {
      courierId: socket.user.id,
      status: 'available',
    });
  });

  // Livreur hors ligne
  socket.on('courier_offline', async () => {
    if (socket.user.role !== 'livreur') return;
    
    await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [socket.user.id]
    );
    
    io.to('admin').emit('courier_status_changed', {
      courierId: socket.user.id,
      status: 'offline',
    });
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`🔌 Utilisateur déconnecté: ${socket.user.name}`);
    connectedUsers.delete(socket.user.id);
  });
});

// Fonction utilitaire pour envoyer des notifications
const sendNotification = (userId, type, data) => {
  io.to(`user_${userId}`).emit('notification', {
    type,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Exporter pour utilisation dans les routes
app.set('sendNotification', sendNotification);
app.set('io', io);

// ==========================================
// 🚀 DÉMARRAGE
// ==========================================

const startServer = async () => {
  try {
    // initDatabase() cree/migre le schema (CREATE TABLE IF NOT EXISTS +
    // ALTER TABLE idempotents) et doit tourner aussi bien en local qu'en
    // serverless Vercel — seul server.listen() (incompatible avec le modele
    // serverless) est reserve au mode local.
    await initDatabase();
    if (!process.env.VERCEL) {
      server.listen(PORT, () => {
        console.log(`🚀 API NOOR EAT lancée sur http://localhost:${PORT}`);
        console.log(`📡 Socket.IO actif pour temps réel`);
        console.log(`🔐 JWT Authentication activée`);
        console.log(`🐘 PostgreSQL connecté`);
      });
    }
  } catch (err) {
    console.error('❌ Erreur démarrage serveur:', err);
    if (!process.env.VERCEL) process.exit(1);
  }
};

startServer();

// Exporter l'application Express pour le Serverless Vercel
module.exports = app;
