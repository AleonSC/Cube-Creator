import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/ (normal static site, e.g. GitHub Pages)
// `npm run build:single` -> release/index.html, everything inlined: double-click to run, no server needed
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  publicDir: mode === 'single' ? false : 'public',
  build: {
    chunkSizeWarningLimit: 1500,
    outDir: mode === 'single' ? 'release' : 'dist',
  },
}));
