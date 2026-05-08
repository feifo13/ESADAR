import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestContext } from './middlewares/request-context.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import { adminRouter as adminArticleRoutes, publicRouter as publicArticleRoutes } from './modules/articles/articles.routes.js';
import { adminRouter as adminOrderRoutes, publicRouter as publicOrderRoutes } from './modules/orders/orders.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import lookupsRoutes from './modules/lookups/lookups.routes.js';
import { adminRouter as adminOfferRoutes, publicRouter as publicOfferRoutes } from './modules/offers/offers.routes.js';
import { adminRouter as adminContactRoutes, publicRouter as publicContactRoutes } from './modules/contact/contact.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import { adminRouter as adminSeoRoutes, publicRouter as publicSeoRoutes, seoSpecialRouter } from './modules/seo/seo.routes.js';
import { adminRouter as adminLeadsRoutes, publicInteractionRouter, publicLeadRouter } from './modules/leads/leads.routes.js';
import accountRoutes from './modules/account/account.routes.js';
import wishlistsRoutes from './modules/wishlists/wishlists.routes.js';
import statisticsRoutes from './modules/statistics/statistics.routes.js';

fs.mkdirSync(env.uploadDir, { recursive: true });
fs.mkdirSync(env.articleUploadDir, { recursive: true });
fs.mkdirSync(env.bundledUploadDir, { recursive: true });
const publicAssetsDir = path.resolve(process.cwd(), 'public', 'assets');
fs.mkdirSync(publicAssetsDir, { recursive: true });

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({
    origin: env.appOrigin,
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'X-Export-Count'],
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContext);
  app.use('/assets', express.static(publicAssetsDir));
  app.use('/uploads', express.static(env.uploadDir));
  if (path.resolve(env.bundledUploadDir) !== path.resolve(env.uploadDir)) {
    app.use('/uploads', express.static(env.bundledUploadDir));
  }
  app.use(seoSpecialRouter);

  app.get('/', (_req, res) => {
    res.json({ ok: true, name: 'ESADAR Backend' });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/public/lookups', lookupsRoutes);
  app.use('/api/public/seo', publicSeoRoutes);
  app.use('/api/public/articles', publicArticleRoutes);
  app.use('/api/public/account', accountRoutes);
  app.use('/api/public/offers', publicOfferRoutes);
  app.use('/api/public/contact-messages', publicContactRoutes);
  app.use('/api/public/leads', publicLeadRouter);
  app.use('/api/public', publicInteractionRouter);
  app.use('/api/public/orders', publicOrderRoutes);
  app.use('/api/admin/articles', adminArticleRoutes);
  app.use('/api/admin/offers', adminOfferRoutes);
  app.use('/api/admin/contact-messages', adminContactRoutes);
  app.use('/api/admin/orders', adminOrderRoutes);
  app.use('/api/admin/audit', auditRoutes);
  app.use('/api/admin', adminSeoRoutes);
  app.use('/api/admin', adminLeadsRoutes);
  app.use('/api/admin', wishlistsRoutes);
  app.use('/api/admin', statisticsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
