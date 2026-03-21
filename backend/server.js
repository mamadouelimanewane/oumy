/**
 * 🇸🇳 SenFood Backend API - Production Ready
 * PostgreSQL + JWT + Socket.IO + Full Features
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { pool, initDatabase } = require('./config/database');
const { authenticate, authorize } = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const restaurantRoutes = require('./routes/restaurant');
const livreurRoutes = require('./routes/livreur');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
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
    status: 'SenFood API is running', 
    version: '2.0.0 (PostgreSQL + JWT + Socket.IO)',
    timestamp: new Date().toISOString()
  });
});

// Auth routes (publiques)
app.use('/api/auth', authRoutes);

// Client routes
app.use('/api/client', clientRoutes);

// Restaurant routes
app.use('/api/restaurant', restaurantRoutes);

// Livreur routes
app.use('/api/livreur', livreurRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_in_production');
    
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
    
    try {
      // Mettre à jour la position en DB
      await pool.query(
        `INSERT INTO courier_locations (courier_id, latitude, longitude, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (courier_id) 
         DO UPDATE SET latitude = $2, longitude = $3, updated_at = CURRENT_TIMESTAMP`,
        [socket.user.id, latitude, longitude]
      );

      // Notifier le client si commande en cours
      if (orderId) {
        const orderResult = await pool.query(
          'SELECT client_id FROM orders WHERE id = $1 AND courier_id = $2',
          [orderId, socket.user.id]
        );

        if (orderResult.rows.length > 0) {
          const clientId = orderResult.rows[0].client_id;
          io.to(`user_${clientId}`).emit('courier_location_update', {
            orderId,
            latitude,
            longitude,
            courierId: socket.user.id,
          });
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
    await initDatabase();
    
    server.listen(PORT, () => {
      console.log(`🚀 API SenFood lancée sur http://localhost:${PORT}`);
      console.log(`📡 Socket.IO actif pour temps réel`);
      console.log(`🔐 JWT Authentication activée`);
      console.log(`🐘 PostgreSQL connecté`);
    });
  } catch (err) {
    console.error('❌ Erreur démarrage serveur:', err);
    process.exit(1);
  }
};

startServer();

module.exports = { sendNotification };
