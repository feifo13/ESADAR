import { env } from '../config/env.js';
import { forbidden } from '../utils/app-error.js';

export function createCorsOptions() {
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (env.cors.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (!env.isProduction && env.cors.allowLocalhostInDevelopment) {
        try {
          const { hostname } = new URL(origin);
          if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
            return callback(null, true);
          }
        } catch {
          // Fall through to the explicit rejection below.
        }
      }

      return callback(forbidden('Origen CORS no permitido.'));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'X-Export-Count'],
  };
}
