import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/e2e/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 60000, // E2E tests may take longer
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@pablos/contracts': path.resolve(__dirname, './packages/contracts/src'),
      '@pablos/utils': path.resolve(__dirname, './packages/utils/src'),
    },
  },
});

