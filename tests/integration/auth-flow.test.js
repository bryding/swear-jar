const request = require('supertest');
const express = require('express');
const path = require('path');
const AuthManager = require('../../server/auth');

describe('End-to-End Authentication Flow', () => {
  let app;
  let authManager;
  let server;
  let mockRedis;

  beforeAll(async () => {
    // Create a test Express app similar to the real server
    app = express();
    app.use(express.json());

    // Mock Redis for testing
    mockRedis = global.testUtils.createMockRedis();
    authManager = new AuthManager({ redis: mockRedis }, false);

    // Mock data functions
    let testData = { ben: 0, kaiti: 0, lastUpdated: new Date().toISOString() };
    const readData = () => Promise.resolve({ ...testData });
    const writeData = (data) => {
      testData = { ...data, lastUpdated: new Date().toISOString() };
      return Promise.resolve();
    };

    // Authentication endpoints
    app.post('/api/auth/validate', async (req, res) => {
      try {
        // Check if request body is valid first
        if (!req.body || typeof req.body !== 'object') {
          return res.status(400).json({ error: 'PIN is required' });
        }
        
        const { pin } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || 'test-ip';
        
        if (!pin || typeof pin !== 'string' || pin.trim() === '') {
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

    // Status endpoint (for server readiness check)
    app.get('/api/status', (req, res) => {
      res.json({
        database: 'Mock',
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
        return res.status(400).json({ error: 'Invalid person' });
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

    // Start server
    server = app.listen(0); // Use random port
    await global.integrationUtils.waitForServer(server);
  });

  beforeEach(() => {
    // Clear rate limiting state between tests
    if (authManager && authManager.rateLimitMap) {
      authManager.rateLimitMap.clear();
    }
    // Clear mock Redis state
    if (mockRedis) {
      mockRedis.clear();
    }
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Complete Authentication Flow', () => {
    test('should complete full authentication flow', async () => {
      // Step 1: Initial request without auth should fail
      const unauthorizedResponse = await request(app)
        .get('/api/counts');
      
      expect(unauthorizedResponse.status).toBe(401);
      expect(unauthorizedResponse.body.code).toBe('NO_TOKEN');

      // Step 2: Validate PIN to get token
      const authResponse = await request(app)
        .post('/api/auth/validate')
        .send({ pin: '12345' });

      expect(authResponse.status).toBe(200);
      expect(authResponse.body.success).toBe(true);
      expect(authResponse.body.token).toBeDefined();
      
      const token = authResponse.body.token;

      // Step 3: Use token to access protected endpoint
      const protectedResponse = await request(app)
        .get('/api/counts')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.ben).toBeDefined();
      expect(protectedResponse.body.kaiti).toBeDefined();
    });

    test('should validate token independently', async () => {
      // Create a session
      const token = await global.integrationUtils.createTestSession(app);

      // Validate token through dedicated endpoint
      const validationResponse = await request(app)
        .get('/api/auth/validate-token')
        .set('Authorization', `Bearer ${token}`);

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body.valid).toBe(true);
    });

    test('should handle invalid token gracefully', async () => {
      const invalidToken = 'invalid-token-12345';

      // Try to use invalid token
      const response = await request(app)
        .get('/api/counts')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_TOKEN');

      // Validate invalid token through dedicated endpoint
      const validationResponse = await request(app)
        .get('/api/auth/validate-token')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(validationResponse.status).toBe(200);
      expect(validationResponse.body.valid).toBe(false);
    });
  });

  describe('Token Persistence Across Requests', () => {
    test('should maintain session across multiple requests', async () => {
      const token = await global.integrationUtils.createTestSession(app);

      // Make multiple requests with same token
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .get('/api/counts')
            .set('Authorization', `Bearer ${token}`)
        );
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should handle token expiration', async () => {
      // Create a short-lived token for testing
      const shortLivedAuthManager = new AuthManager({ redis: global.testUtils.createMockRedis() }, false);
      shortLivedAuthManager.TOKEN_EXPIRY = 100; // 100ms

      const result = await shortLivedAuthManager.validatePin('12345', 'test-ip');
      const token = result.token;

      // Wait for token to expire
      await global.testUtils.wait(150);

      // Token should now be invalid
      const isValid = await shortLivedAuthManager.validateToken(token);
      expect(isValid).toBe(false);
    });
  });

  describe('Rate Limiting Integration', () => {
    test('should enforce rate limiting across multiple attempts', async () => {
      const testIp = 'rate-limit-test-ip';
      
      // Make 30 failed attempts in parallel
      const failedAttempts = [];
      for (let i = 0; i < 30; i++) {
        failedAttempts.push(
          request(app)
            .post('/api/auth/validate')
            .set('X-Forwarded-For', testIp)
            .send({ pin: '00000' })
        );
      }

      const results = await Promise.all(failedAttempts);
      
      // All should fail with invalid PIN
      results.forEach(result => {
        expect(result.status).toBe(401);
        expect(result.body.code).toBe('INVALID_PIN');
      });

      // Next attempt should be rate limited
      const rateLimitedResponse = await request(app)
        .post('/api/auth/validate')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '12345' }); // Even correct PIN should be blocked

      expect(rateLimitedResponse.status).toBe(401);
      expect(rateLimitedResponse.body.code).toBe('RATE_LIMITED');
    });

    test('should reset rate limit after successful authentication', async () => {
      const testIp = 'reset-test-ip';
      
      // Make some failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/validate')
          .set('X-Forwarded-For', testIp)
          .send({ pin: '00000' });
      }

      // Successful authentication should reset rate limit
      const successResponse = await request(app)
        .post('/api/auth/validate')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '12345' });

      expect(successResponse.status).toBe(200);

      // Should be able to make more attempts after reset
      const nextAttempt = await request(app)
        .post('/api/auth/validate')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '00000' });

      expect(nextAttempt.status).toBe(401);
      expect(nextAttempt.body.code).toBe('INVALID_PIN'); // Not rate limited
    });
  });

  describe('Multi-User Session Handling', () => {
    test('should handle multiple concurrent sessions', async () => {
      // Create multiple sessions
      const session1 = await global.integrationUtils.createTestSession(app);
      const session2 = await global.integrationUtils.createTestSession(app);
      const session3 = await global.integrationUtils.createTestSession(app);

      // All sessions should be valid and independent
      const requests = [
        request(app).get('/api/counts').set('Authorization', `Bearer ${session1}`),
        request(app).get('/api/counts').set('Authorization', `Bearer ${session2}`),
        request(app).get('/api/counts').set('Authorization', `Bearer ${session3}`)
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should isolate rate limiting by IP', async () => {
      const ip1 = 'multi-user-ip-1';
      const ip2 = 'multi-user-ip-2';

      // Exhaust rate limit for IP1 using parallel requests
      const failedAttempts = [];
      for (let i = 0; i < 30; i++) {
        failedAttempts.push(
          request(app)
            .post('/api/auth/validate')
            .set('X-Forwarded-For', ip1)
            .send({ pin: '00000' })
        );
      }
      
      await Promise.all(failedAttempts);

      // IP1 should be rate limited
      const ip1Response = await request(app)
        .post('/api/auth/validate')
        .set('X-Forwarded-For', ip1)
        .send({ pin: '12345' });

      expect(ip1Response.status).toBe(401);
      expect(ip1Response.body.code).toBe('RATE_LIMITED');

      // IP2 should still work
      const ip2Response = await request(app)
        .post('/api/auth/validate')
        .set('X-Forwarded-For', ip2)
        .send({ pin: '12345' });

      expect(ip2Response.status).toBe(200);
      expect(ip2Response.body.success).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from authentication failures', async () => {
      // Fail authentication
      const failedResponse = await request(app)
        .post('/api/auth/validate')
        .send({ pin: '99999' });

      expect(failedResponse.status).toBe(401);

      // Should be able to authenticate successfully after failure
      const successResponse = await request(app)
        .post('/api/auth/validate')
        .send({ pin: '12345' });

      expect(successResponse.status).toBe(200);
      expect(successResponse.body.success).toBe(true);

      // Should be able to use the token
      const token = successResponse.body.token;
      const protectedResponse = await request(app)
        .get('/api/counts')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedResponse.status).toBe(200);
    });

    test('should handle malformed requests gracefully', async () => {
      // Reset rate limiting for this test to ensure clean slate
      if (authManager && authManager.rateLimitMap) {
        authManager.rateLimitMap.clear();
      }
      
      const malformedRequests = [
        { body: null, expectedStatus: 400 },
        { body: {}, expectedStatus: 400 },
        { body: { pin: null }, expectedStatus: 400 },
        { body: { pin: '' }, expectedStatus: 400 },
        { body: { wrongField: '12345' }, expectedStatus: 400 }
      ];

      for (const { body, expectedStatus } of malformedRequests) {
        const response = await request(app)
          .post('/api/auth/validate')
          .set('X-Forwarded-For', 'malformed-test-ip') // Use unique IP
          .send(body);

        expect(response.status).toBe(expectedStatus);
      }
    });
  });
});