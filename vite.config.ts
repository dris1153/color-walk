/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // The crawl cache is ~90k thumbnails (19 GB) that a running crawl keeps
      // writing to. Watching it starved the dependency scan: a cold start sat
      // over ten minutes before the first page, against 0.6 s without it.
      // public/index stays watched, so a rebuilt index is served without a restart.
      ignored: ['**/scripts/color-index/.cache/**', '**/dist/**', '**/plans/**'],
    },
  },
  optimizeDeps: {
    // The one entry there is; otherwise the scan globs **/*.html across the
    // whole project, cache included, which alone took 18 s.
    entries: ['index.html'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
