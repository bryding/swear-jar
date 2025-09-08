const request = require('supertest');
const express = require('express');
const path = require('path');
const AuthManager = require('../auth');

// Mock the main server to avoid conflicts
jest.mock('redis', () => ({
  createClient: () => global.testUtils.createMockRedis()
}));

describe('API Endpoints', () => {
  let app;
  let authManager;
  let mockRedis;
  let validToken;

  beforeAll(async () => {
    // Create test Express app
    app = express();
    app.use(express.json());
    
    // Initialize auth manager
    mockRedis = global.testUtils.createMockRedis();
    authManager = new AuthManager({ redis: mockRedis }, false);
    
    // Note: Token will be created in beforeEach to avoid being cleared

    // Mock data storage functions
    const testData = global.testUtils.getTestData();
    let currentData = { ...testData };

    const readData = jest.fn(() => Promise.resolve({ ...currentData }));
    const writeData = jest.fn((data) => {
      currentData = { ...data };
      return Promise.resolve();
    });

    // Authentication endpoints
    app.post('/api/auth/validate', async (req, res) => {
      try {
        const { pin } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress || 'test-ip';
        
        if (!pin) {
          return res.status(400).json({ error: 'PIN is required' });
        }

        const result = await authManager.validatePin(pin, clientIp);
        res.json({
          success: true,
          token: result.token,
          expiresAt: result.expiresAt
        });
      } catch (error) {
        res.status(401).json({ 
          error: error.message,
          code: error.message.includes('Too many') ? 'RATE_LIMITED' : 'INVALID_PIN'
        });
      }
    });

    app.get('/api/auth/validate-token', async (req, res) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
        
        if (!token) {
          return res.status(400).json({ error: 'Token is required' });
        }

        const isValid = await authManager.validateToken(token);
        res.json({ valid: isValid });
      } catch (error) {
        res.status(500).json({ error: 'Token validation failed' });
      }
    });

    // Status endpoint (no auth required)
    app.get('/api/status', (req, res) => {
      res.json({
        database: 'File',
        connected: true,
        environment: { NODE_ENV: 'test' },
        timestamp: new Date().toISOString()
      });
    });

    // Protected endpoints
    app.get('/api/counts', authManager.middleware(), async (req, res) => {
      try {
        const data = await readData();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to read counts' });
      }
    });

    app.post('/api/swear/:person', authManager.middleware(), async (req, res) => {
      const { person } = req.params;
      
      if (!['ben', 'kaiti'].includes(person)) {
        return res.status(400).json({ error: 'Invalid person. Must be "ben" or "kaiti"' });
      }

      try {
        const data = await readData();
        data[person] += 1;
        await writeData(data);
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update count' });
      }
    });

    app.put('/api/counts/:person', authManager.middleware(), async (req, res) => {
      const { person } = req.params;
      const { count } = req.body;
      
      if (!['ben', 'kaiti'].includes(person)) {
        return res.status(400).json({ error: 'Invalid person. Must be "ben" or "kaiti"' });
      }

      const num = parseInt(count);
      if (isNaN(num) || num < 0) {
        return res.status(400).json({ error: 'Invalid count. Must be a non-negative integer' });
      }

      try {
        const data = await readData();
        data[person] = num;
        await writeData(data);
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to set count' });
      }
    });

    app.post('/api/payout', authManager.middleware(), async (req, res) => {
      try {
        const data = await readData();
        data.ben = 0;
        data.kaiti = 0;
        await writeData(data);
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to reset counts' });
      }
    });
  });

  beforeEach(async () => {
    mockRedis.clear();
    
    // Create a valid token for authenticated tests
    validToken = authManager.generateToken();
    await authManager.storeToken(validToken, Date.now() + 3600000);
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/validate', () => {
      test('should validate correct PIN', async () => {
        const response = await request(app)
          .post('/api/auth/validate')
          .send({ pin: '12345' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.expiresAt).toBeDefined();
      });

      test('should reject incorrect PIN', async () => {
        const response = await request(app)
          .post('/api/auth/validate')
          .send({ pin: '54321' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid PIN');
        expect(response.body.code).toBe('INVALID_PIN');
      });

      test('should require PIN in request body', async () => {
        const response = await request(app)
          .post('/api/auth/validate')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('PIN is required');
      });

      test('should handle rate limiting', async () => {
        // Make 30 failed attempts in parallel for speed
        const failedAttempts = [];
        for (let i = 0; i < 30; i++) {
          failedAttempts.push(
            request(app)
              .post('/api/auth/validate')
              .send({ pin: '00000' })
          );
        }
        
        await Promise.all(failedAttempts);

        // Next request should be rate limited
        const response = await request(app)
          .post('/api/auth/validate')
          .send({ pin: '12345' });

        expect(response.status).toBe(401);
        expect(response.body.code).toBe('RATE_LIMITED');
        expect(response.body.error).toMatch(/Too many failed attempts/);
      });
    });

    describe('GET /api/auth/validate-token', () => {
      test('should validate existing token', async () => {
        const response = await request(app)
          .get('/api/auth/validate-token')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
      });

      test('should reject invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/validate-token')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      });

      test('should require token', async () => {
        const response = await request(app)
          .get('/api/auth/validate-token');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Token is required');
      });

      test('should accept token in query parameter', async () => {
        const response = await request(app)
          .get(`/api/auth/validate-token?token=${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
      });
    });
  });

  describe('Public Endpoints', () => {
    describe('GET /api/status', () => {
      test('should return status information', async () => {
        const response = await request(app)
          .get('/api/status');

        expect(response.status).toBe(200);
        expect(response.body.database).toBe('File');
        expect(response.body.connected).toBe(true);
        expect(response.body.environment.NODE_ENV).toBe('test');
        expect(response.body.timestamp).toBeDefined();
      });

      test('should not require authentication', async () => {
        const response = await request(app)
          .get('/api/status');

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Protected Endpoints', () => {
    describe('Authentication Required', () => {
      const protectedRoutes = [
        { method: 'get', path: '/api/counts' },
        { method: 'post', path: '/api/swear/ben' },
        { method: 'put', path: '/api/counts/ben', body: { count: 5 } },
        { method: 'post', path: '/api/payout' }
      ];

      test.each(protectedRoutes)('should require auth for $method $path', async ({ method, path, body }) => {
        const response = await request(app)[method](path).send(body || {});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication required');
        expect(response.body.code).toBe('NO_TOKEN');
      });

      test.each(protectedRoutes)('should reject invalid token for $method $path', async ({ method, path, body }) => {
        const response = await request(app)[method](path)
          .set('Authorization', 'Bearer invalid-token')
          .send(body || {});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid or expired token');
        expect(response.body.code).toBe('INVALID_TOKEN');
      });
    });

    describe('GET /api/counts', () => {
      test('should return current counts', async () => {
        const response = await request(app)
          .get('/api/counts')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.ben).toBeDefined();
        expect(response.body.kaiti).toBeDefined();
        expect(response.body.lastUpdated).toBeDefined();
      });
    });

    describe('POST /api/swear/:person', () => {
      test('should increment count for valid person', async () => {
        const response = await request(app)
          .post('/api/swear/ben')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.ben).toBeGreaterThan(0);
      });

      test('should reject invalid person', async () => {
        const response = await request(app)
          .post('/api/swear/invalid')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid person. Must be "ben" or "kaiti"');
      });
    });

    describe('PUT /api/counts/:person', () => {
      test('should set count for valid person', async () => {
        const response = await request(app)
          .put('/api/counts/ben')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ count: 10 });

        expect(response.status).toBe(200);
        expect(response.body.ben).toBe(10);
      });

      test('should reject invalid person', async () => {
        const response = await request(app)
          .put('/api/counts/invalid')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ count: 5 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid person. Must be "ben" or "kaiti"');
      });

      test('should reject invalid count values', async () => {
        const invalidCounts = [-1, 'abc', null, undefined];
        
        for (const count of invalidCounts) {
          const response = await request(app)
            .put('/api/counts/ben')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ count });

          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Invalid count. Must be a non-negative integer');
        }
      });

      test('should accept zero as valid count', async () => {
        const response = await request(app)
          .put('/api/counts/ben')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ count: 0 });

        expect(response.status).toBe(200);
        expect(response.body.ben).toBe(0);
      });
    });

    describe('POST /api/payout', () => {
      test('should reset both counts to zero', async () => {
        // First, set some counts
        await request(app)
          .put('/api/counts/ben')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ count: 5 });
          
        await request(app)
          .put('/api/counts/kaiti')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ count: 3 });

        // Then payout
        const response = await request(app)
          .post('/api/payout')
          .set('Authorization', `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.ben).toBe(0);
        expect(response.body.kaiti).toBe(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    test('should handle missing Content-Type', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send('pin=12345');

      // Should still work with form data or default handling
      expect([400, 401]).toContain(response.status);
    });
  });
});