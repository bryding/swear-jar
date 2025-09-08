// Global test setup for backend tests
const path = require('path');
const fs = require('fs').promises;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_PIN = '12345'; // Test PIN
process.env.AUTH_TOKEN_EXPIRY = '3600000'; // 1 hour for tests

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console logs during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Clean up test files after each test
afterEach(async () => {
  const testFiles = [
    path.join(__dirname, 'test-data.json'),
    path.join(__dirname, 'test-auth.json'),
    path.join(__dirname, '../data.json'),
    path.join(__dirname, '../auth.json')
  ];
  
  for (const file of testFiles) {
    try {
      await fs.unlink(file);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }
});

// Global test utilities
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