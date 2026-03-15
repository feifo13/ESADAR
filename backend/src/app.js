import fs from 'node:fs';
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

fs.mkdirSync(env.uploadDir, { recursive: true });

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.appOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContext);
  app.use('/uploads', express.static(env.uploadDir));

  app.get('/', (_req, res) => {
    res.json({ ok: true, name: 'Miami Closet Backend Starter' });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/public/articles', publicArticleRoutes);
  app.use('/api/public/orders', publicOrderRoutes);
  app.use('/api/admin/articles', adminArticleRoutes);
  app.use('/api/admin/orders', adminOrderRoutes);
  app.use('/api/admin/audit', auditRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
