import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizePublicSiteUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolvePublicSiteUrl(env) {
  return normalizePublicSiteUrl(
    env.VITE_PUBLIC_SITE_URL ||
      env.PUBLIC_SITE_URL ||
      env.APP_ORIGIN ||
      'https://esadar.com.uy',
  );
}

function htmlSocialMetaPlugin(publicSiteUrl) {
  const socialShareImageUrl = `${publicSiteUrl}/social-share-isotipo.png`;

  return {
    name: 'esadar-html-social-meta',
    transformIndexHtml(html) {
      return html
        .replaceAll('__ESADAR_PUBLIC_SITE_URL__', publicSiteUrl)
        .replaceAll('__ESADAR_SOCIAL_SHARE_IMAGE_URL__', socialShareImageUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:4000';
  const publicSiteUrl = resolvePublicSiteUrl(env);

  return {
    plugins: [react(), htmlSocialMetaPlugin(publicSiteUrl)],
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
