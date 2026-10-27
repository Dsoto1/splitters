import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'tools/ci/test/**/*.test.mjs'],
    testTimeout: 20000,
  },
});
