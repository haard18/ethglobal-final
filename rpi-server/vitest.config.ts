import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.config.{js,ts}',
        '**/types.ts'
      ]
    }
  },
  esbuild: {
    target: 'node18'
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
});