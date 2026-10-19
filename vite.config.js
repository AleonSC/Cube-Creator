import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths so dist/ can be hosted anywhere (GitHub Pages, itch.io...)
  build: { chunkSizeWarningLimit: 1500 },
});
