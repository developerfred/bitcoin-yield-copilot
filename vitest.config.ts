import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'tests/*_test.ts', // Exclude clarinet tests - use vitest:clarinet
    ],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
