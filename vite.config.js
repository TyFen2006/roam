import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: { port: 5173, host: true },
  build: { target: 'es2018', assetsInlineLimit: 100000000, cssCodeSplit: false },
});
