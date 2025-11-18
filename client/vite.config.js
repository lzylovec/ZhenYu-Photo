// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['*.ngrok-free.dev'], // 允许所有 ngrok 域名
    // 或者指定具体域名：
    // allowedHosts: ['unreticent-emmanuel-involucrate.ngrok-free.dev']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});