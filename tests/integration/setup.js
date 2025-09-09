// Integration test setup - uses shared utilities
const { testUtils, integrationUtils, setupTestEnvironment } = require('../shared/utils');

// Setup test environment
setupTestEnvironment();

// Make test utilities available globally
global.testUtils = testUtils;
global.integrationUtils = integrationUtils;

// Clean up after each test
afterEach(async () => {
  await testUtils.cleanupFiles(__dirname);
});