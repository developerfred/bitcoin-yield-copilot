import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'clarinet',
    include: ['tests/*_test.ts'],
    exclude: ['tests/deps.ts', 'tests/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    environmentOptions: {
      clarinet: {
        manifestPath: './Clarinet.toml',
        coverage: false,
        costs: false,
      },
    },
  },
});
