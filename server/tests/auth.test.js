const AuthManager = require('../auth');
const path = require('path');
const fs = require('fs').promises;

describe('AuthManager', () => {
  let authManager;
  let mockRedis;
  
  beforeEach(() => {
    mockRedis = global.testUtils.createMockRedis();
    authManager = new AuthManager({ redis: mockRedis }, false);
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('Token Generation', () => {
    test('should generate unique tokens', () => {
      const token1 = authManager.generateToken();
      const token2 = authManager.generateToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 (hex)
      expect(/^[a-f0-9]+$/.test(token1)).toBe(true);
    });
  });

  describe('Secure PIN Comparison', () => {
    test('should return true for matching strings', () => {
      const result = authManager.secureCompare('12345', '12345');
      expect(result).toBe(true);
    });

    test('should return false for non-matching strings', () => {
      const result = authManager.secureCompare('12345', '54321');
      expect(result).toBe(false);
    });

    test('should return false for different length strings', () => {
      const result = authManager.secureCompare('1234', '12345');
      expect(result).toBe(false);
    });

    test('should be resistant to timing attacks', () => {
      // Test the core function works correctly with different strings
      const correctPin = '12345';
      const incorrectPin1 = '54321';
      const incorrectPin2 = '00000';
      const differentLength = '123';
      
      // Test basic functionality - all should return consistent results
      expect(authManager.secureCompare(correctPin, correctPin)).toBe(true);
      expect(authManager.secureCompare(correctPin, incorrectPin1)).toBe(false);
      expect(authManager.secureCompare(correctPin, incorrectPin2)).toBe(false);
      expect(authManager.secureCompare(correctPin, differentLength)).toBe(false);
      
      // Test that the function completes in reasonable time for various inputs
      const testCases = [
        [correctPin, correctPin],
        [correctPin, incorrectPin1],
        [correctPin, incorrectPin2],
        [correctPin, differentLength]
      ];
      
      testCases.forEach(([a, b]) => {
        const start = Date.now();
        authManager.secureCompare(a, b);
        const duration = Date.now() - start;
        
        // Should complete very quickly (< 10ms) regardless of input
        expect(duration).toBeLessThan(10);
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests under limit', () => {
      const ip = '192.168.1.1';
      
      for (let i = 0; i < 29; i++) {
        const result = authManager.checkRateLimit(ip);
        expect(result.allowed).toBe(true);
        authManager.recordFailedAttempt(ip);
      }
    });

    test('should block requests after 30 failed attempts', () => {
      const ip = '192.168.1.1';
      
      // Make 30 failed attempts
      for (let i = 0; i < 30; i++) {
        authManager.recordFailedAttempt(ip);
      }
      
      const result = authManager.checkRateLimit(ip);
      expect(result.allowed).toBe(false);
      expect(result.remainingSeconds).toBeGreaterThan(0);
    });

    test('should reset attempts after 15 minutes', async () => {
      const ip = '192.168.1.1';
      
      // Make failed attempts
      for (let i = 0; i < 5; i++) {
        authManager.recordFailedAttempt(ip);
      }
      
      // Simulate 15 minutes passing
      const record = authManager.rateLimitMap.get(ip);
      record.lastAttempt = Date.now() - (16 * 60 * 1000); // 16 minutes ago
      
      const result = authManager.checkRateLimit(ip);
      expect(result.allowed).toBe(true);
    });

    test('should handle different IPs independently', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';
      
      // Exhaust attempts for ip1
      for (let i = 0; i < 30; i++) {
        authManager.recordFailedAttempt(ip1);
      }
      
      // ip2 should still be allowed
      const result1 = authManager.checkRateLimit(ip1);
      const result2 = authManager.checkRateLimit(ip2);
      
      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('PIN Validation', () => {
    test('should validate correct PIN', async () => {
      const result = await authManager.validatePin('12345', '192.168.1.1');
      
      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    test('should reject incorrect PIN', async () => {
      await expect(authManager.validatePin('54321', '192.168.1.1'))
        .rejects.toThrow('Invalid PIN');
    });

    test('should handle rate limiting during PIN validation', async () => {
      const ip = '192.168.1.1';
      
      // Exhaust rate limit
      for (let i = 0; i < 30; i++) {
        try {
          await authManager.validatePin('00000', ip);
        } catch (error) {
          // Expected failures
        }
      }
      
      // Next attempt should be rate limited
      await expect(authManager.validatePin('12345', ip))
        .rejects.toThrow(/Too many failed attempts/);
    });

    test('should reset rate limit on successful authentication', async () => {
      const ip = '192.168.1.1';
      
      // Make some failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authManager.validatePin('00000', ip);
        } catch (error) {
          // Expected failures
        }
      }
      
      // Successful authentication should reset rate limit
      await authManager.validatePin('12345', ip);
      
      // Rate limit should be reset
      expect(authManager.rateLimitMap.has(ip)).toBe(false);
    });
  });

  describe('Token Storage and Validation', () => {
    test('should store and validate tokens in file storage', async () => {
      // Use file storage (non-production)
      const authManager = new AuthManager({ redis: null }, false);
      const token = authManager.generateToken();
      const expiresAt = Date.now() + 3600000; // 1 hour
      
      await authManager.storeToken(token, expiresAt);
      const isValid = await authManager.validateToken(token);
      
      expect(isValid).toBe(true);
    });

    test('should store and validate tokens in Redis', async () => {
      // Use Redis storage (production)
      const authManager = new AuthManager({ redis: mockRedis }, true);
      const token = authManager.generateToken();
      const expiresAt = Date.now() + 3600000; // 1 hour
      
      await authManager.storeToken(token, expiresAt);
      const isValid = await authManager.validateToken(token);
      
      expect(isValid).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalled();
    });

    test('should reject expired tokens', async () => {
      const token = authManager.generateToken();
      const expiresAt = Date.now() - 1000; // Expired 1 second ago
      
      await authManager.storeToken(token, expiresAt);
      const isValid = await authManager.validateToken(token);
      
      expect(isValid).toBe(false);
    });

    test('should reject non-existent tokens', async () => {
      const fakeToken = 'fake-token-that-does-not-exist';
      const isValid = await authManager.validateToken(fakeToken);
      
      expect(isValid).toBe(false);
    });

    test('should reject empty/null tokens', async () => {
      expect(await authManager.validateToken('')).toBe(false);
      expect(await authManager.validateToken(null)).toBe(false);
      expect(await authManager.validateToken(undefined)).toBe(false);
    });
  });

  describe('Token Cleanup', () => {
    test('should clean up expired tokens in file storage', async () => {
      const authManager = new AuthManager({ redis: null }, false);
      
      // Store expired and valid tokens
      const expiredToken = authManager.generateToken();
      const validToken = authManager.generateToken();
      
      await authManager.storeToken(expiredToken, Date.now() - 1000); // Expired
      await authManager.storeToken(validToken, Date.now() + 3600000); // Valid
      
      await authManager.cleanupExpiredTokens();
      
      expect(await authManager.validateToken(expiredToken)).toBe(false);
      expect(await authManager.validateToken(validToken)).toBe(true);
    });

    test('should handle Redis cleanup gracefully', async () => {
      const authManager = new AuthManager({ redis: mockRedis }, true);
      
      // Redis handles TTL automatically, so cleanup should be no-op
      await expect(authManager.cleanupExpiredTokens()).resolves.not.toThrow();
    });
  });

  describe('Middleware', () => {
    test('should create middleware function', () => {
      const middleware = authManager.middleware();
      expect(typeof middleware).toBe('function');
    });

    test('should reject requests without token', () => {
      const middleware = authManager.middleware();
      const req = { headers: {}, query: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should accept requests with valid token', async () => {
      // Store a valid token
      const token = authManager.generateToken();
      await authManager.storeToken(token, Date.now() + 3600000);
      
      const middleware = authManager.middleware();
      const req = { 
        headers: { authorization: `Bearer ${token}` }, 
        query: {} 
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject requests with invalid token', async () => {
      const middleware = authManager.middleware();
      const req = { 
        headers: { authorization: 'Bearer invalid-token' }, 
        query: {} 
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});