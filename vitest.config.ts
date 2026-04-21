import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.js'],
    exclude: ['node_modules', 'tests/e2e/**', '.claude/worktrees/**', 'dist/**', 'release/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
