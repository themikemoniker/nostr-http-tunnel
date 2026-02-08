import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/nostr-http-tunnel/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lightning: resolve(__dirname, 'lightning.html'),
      },
    },
  },
});
