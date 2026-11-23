import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkGfm from 'remark-gfm';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [{ enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) }, react({ include: /\.(mdx|tsx?)$/ })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
