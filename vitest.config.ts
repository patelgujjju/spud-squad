import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/shared/src/**/*.test.ts',
      'apps/server/src/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/index.ts', '**/types.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
