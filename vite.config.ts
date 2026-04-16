import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';

/** Vite+ config — scoped to the test runner. Next.js owns the actual
 *  app dev/build via Turbopack; this file exists only so `vp test` can
 *  resolve TS + path aliases against the same source tree. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
