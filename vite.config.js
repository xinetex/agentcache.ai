import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'studio-dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        advanced_services: resolve(__dirname, 'advanced-services.html'),
        media: resolve(__dirname, 'media.html'),
        reliability: resolve(__dirname, 'reliability.html'),
        pipeline_studio: resolve(__dirname, 'pipeline-studio.html'),
        gov_portal: resolve(__dirname, 'gov-portal.html'),
        analytics: resolve(__dirname, 'analytics.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
      },
    },
  },
});
