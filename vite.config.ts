import { defineConfig } from 'vite';

const allowedHosts = (process.env.PREVIEW_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter((h) => h.length > 0);

export default defineConfig({
  base: './',
  build: {
    target: 'chrome120',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 5173),
    strictPort: false,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
  },
});
