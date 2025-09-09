// Backend test setup - uses shared utilities
const { testUtils, setupTestEnvironment, setupConsoleMocking } = require('../../tests/shared/utils');

// Setup test environment
setupTestEnvironment();

// Setup console mocking
const { suppressLogs, restoreLogs } = setupConsoleMocking();

beforeAll(() => {
  suppressLogs();
});

afterAll(() => {
  restoreLogs();
});

// Clean up test files after each test
afterEach(async () => {
  await testUtils.cleanupFiles(__dirname);
});

// Make test utilities available globally
global.testUtils = testUtils;