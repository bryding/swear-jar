// Shared test utilities across all test suites
const path = require('path');
const fs = require('fs').promises;

// Common test utilities
const testUtils = {
  // Generate consistent test data
  getTestData: () => ({
    ben: 5,
    kaiti: 3,
    lastUpdated: new Date().toISOString()
  }),
  
  // Create mock Redis client with consistent interface
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
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Clean up test files
  cleanupFiles: async (baseDir = __dirname) => {
    const testFiles = [
      path.join(baseDir, '../../server/test-data.json'),
      path.join(baseDir, '../../server/test-auth.json'),
      path.join(baseDir, '../../server/data.json'),
      path.join(baseDir, '../../server/auth.json')
    ];
    
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // File doesn't exist, ignore
      }
    }
  }
};

// Integration-specific utilities
const integrationUtils = {
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
    const request = require('supertest');
    const response = await request(app)
      .post('/api/auth/validate')
      .send({ pin: '12345' });
    
    if (response.status !== 200) {
      throw new Error('Failed to create test session');
    }
    
    return response.body.token;
  }
};

// Environment setup
const setupTestEnvironment = () => {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_PIN = '12345'; // Test PIN
  process.env.AUTH_TOKEN_EXPIRY = '3600000'; // 1 hour for tests
};

// Console mocking utilities
const setupConsoleMocking = () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  const suppressLogs = () => {
    if (!process.env.DEBUG) {
      console.log = jest.fn();
      console.error = jest.fn();
    }
  };
  
  const restoreLogs = () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  };
  
  return { suppressLogs, restoreLogs };
};

module.exports = {
  testUtils,
  integrationUtils,
  setupTestEnvironment,
  setupConsoleMocking
};