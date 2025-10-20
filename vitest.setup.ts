import { beforeAll, afterAll } from 'vitest';
import * as dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config();

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  
  // Mock console methods to reduce noise in tests
  if (!process.env.DEBUG) {
    global.console = {
      ...console,
      log: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
    };
  }
});

// Global test teardown
afterAll(() => {
  // Cleanup
});

