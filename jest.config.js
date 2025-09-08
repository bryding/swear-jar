module.exports = {
  // Handle different test environments
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/tests/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/server/tests/setup.js'],
      moduleDirectories: ['node_modules', '<rootDir>/server/node_modules'],
      collectCoverageFrom: [
        '<rootDir>/server/**/*.js',
        '!<rootDir>/server/node_modules/**',
        '!<rootDir>/server/tests/**'
      ],
      coverageDirectory: '<rootDir>/coverage/backend',
      clearMocks: true
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/frontend/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/frontend/setup.js'],
      clearMocks: true
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.js'],
      clearMocks: true
    }
  ],
  
  // Global settings
  testTimeout: 10000,
  collectCoverage: false,
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Verbose output
  verbose: true
};