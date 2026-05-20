/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/test-setup.ts',
        'src/vite-env.d.ts'
      ],
      thresholds: {
        // Ratcheted 2026-05-20 after adding export, errorMessage, and
        // supabaseRetry test suites (308 tests). Floors sit just below the
        // measured values so they gate regressions without false failures.
        lines: 38,
        statements: 38,
        branches: 76,
        functions: 69,
      },
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});