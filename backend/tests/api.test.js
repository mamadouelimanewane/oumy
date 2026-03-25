const request = require('supertest');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

// Mock server for testing
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('../routes/auth');
const clientRoutes = require('../routes/client');

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);

describe('SenFood API Tests', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Clean test data
    await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE client_id IN (SELECT id FROM users WHERE phone LIKE \'+22199%\'))');
    await pool.query('DELETE FROM orders WHERE client_id IN (SELECT id FROM users WHERE phone LIKE \'+22199%\')');
    await pool.query('DELETE FROM menu_items WHERE restaurant_id IN (SELECT id FROM users WHERE phone LIKE \'+22199%\')');
    await pool.query('DELETE FROM users WHERE phone LIKE \'+22199%\'');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Authentication', () => {
    test('POST /api/auth/register - should create a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          role: 'client',
          name: 'Test User',
          phone: '+22199000001',
          password: 'password123',
          address: 'Dakar, Sénégal'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.phone).toBe('+22199000001');
      
      authToken = res.body.token;
      userId = res.body.user.id;
    });

    test('POST /api/auth/login - should authenticate user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '+22199000001',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('client');
    });

    test('POST /api/auth/login - should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '+22199000001',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
    });

    test('GET /api/auth/me - should get user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.phone).toBe('+22199000001');
    });
  });

  describe('Client Routes', () => {
    test('GET /api/client/restaurants - should get restaurants', async () => {
      const res = await request(app)
        .get('/api/client/restaurants');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/client/plats - should get menu items', async () => {
      const res = await request(app)
        .get('/api/client/plats');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Protected Routes', () => {
    test('should reject requests without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    test('should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });
  });
});

describe('Database Connection', () => {
  test('should connect to PostgreSQL', async () => {
    const result = await pool.query('SELECT NOW()');
    expect(result.rows[0]).toHaveProperty('now');
  });

  test('should have required tables', async () => {
    const tables = ['users', 'menu_items', 'orders', 'order_items', 'notifications', 'courier_locations'];
    
    for (const table of tables) {
      const result = await pool.query(
        'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
        [table]
      );
      expect(result.rows[0].exists).toBe(true);
    }
  });
});
