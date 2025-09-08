// Integration test setup
const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_PIN = '12345';
process.env.AUTH_TOKEN_EXPIRY = '3600000'; // 1 hour for tests

// Global test utilities (shared with backend)
global.testUtils = {
  // Generate test data
  getTestData: () => ({
    ben: 5,
    kaiti: 3,
    lastUpdated: new Date().toISOString()
  }),
  
  // Create mock Redis client
  createMockRedis: () => {
    const store = new Map();
    return {
      get: jest.fn((key) => Promise.resolve(store.get(key) || null)),
      set: jest.fn((key, value) => { store.set(key, value); return Promise.resolve('OK'); }),
      setEx: jest.fn((key, ttl, value) => { store.set(key, value); return Promise.resolve('OK'); }),
      del: jest.fn((key) => { store.delete(key); return Promise.resolve(1); }),
      connect: jest.fn(() => Promise.resolve()),
      disconnect: jest.fn(() => Promise.resolve()),
      on: jest.fn(),
      clear: () => store.clear()
    };
  },
  
  // Wait utility for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Global test utilities for integration tests
global.integrationUtils = {
  // Clean up test files
  cleanupFiles: async () => {
    const testFiles = [
      path.join(__dirname, '../../server/test-data.json'),
      path.join(__dirname, '../../server/test-auth.json'),
      path.join(__dirname, '../../server/data.json'),
      path.join(__dirname, '../../server/auth.json')
    ];
    
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // File doesn't exist, ignore
      }
    }
  },

  // Wait for server to be ready
  waitForServer: async (server, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Server did not start within timeout'));
      }, timeout);
      
      server.on('listening', () => {
        clearTimeout(timeoutId);
        resolve(true);
      });
      
      server.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
      
      // If server is already listening
      if (server.listening) {
        clearTimeout(timeoutId);
        resolve(true);
      }
    });
  },

  // Create test user session
  createTestSession: async (app) => {
    const response = await request(app)
      .post('/api/auth/validate')
      .send({ pin: '12345' });
    
    if (response.status !== 200) {
      throw new Error('Failed to create test session');
    }
    
    return response.body.token;
  }
};

// Clean up after each test
afterEach(async () => {
  await global.integrationUtils.cleanupFiles();
});