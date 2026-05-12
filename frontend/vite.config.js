import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
