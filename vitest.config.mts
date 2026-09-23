import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// .mts so the config itself is loaded as ESM. Loaded as CJS, vitest/config
// resolves to a build that require()s ESM-only packages, which Node refuses
// before 22.12.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
