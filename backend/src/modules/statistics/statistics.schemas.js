import { z } from 'zod';
import {
  emptyToUndefined,
  optionalDateString,
  optionalEnum,
  optionalPositiveInt,
  optionalTrimmedString,
} from '../../utils/listing.js';

export const statisticsFiltersSchema = z.object({
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  status: optionalEnum(['PENDING', 'RESERVED', 'APPROVED', 'SHIPPED', 'CANCELLED', 'EXPIRED']),
  paymentMethod: optionalEnum(['BANK_TRANSFER', 'MERCADO_PAGO']),
  shippingMethod: z.preprocess(
    (value) => (value == null || value === '' ? undefined : Number(value)),
    z.number().int().positive().optional(),
  ),
  groupBy: optionalEnum(['day', 'week', 'month', 'year']),
  q: optionalTrimmedString(150),
});

export const statisticsExportQuerySchema = statisticsFiltersSchema.extend({
  type: z.enum([
    'summary',
    'sales',
    'profits',
    'top_articles',
    'top_customers',
    'categories',
    'wishlist',
    'market_study',
    'full',
  ]).default('full'),
});

export const statisticsArticleMarginsQuerySchema = z.object({
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  status: optionalEnum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']),
  q: optionalTrimmedString(150),
});

export const statisticsTopQuerySchema = statisticsFiltersSchema.extend({
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(50).default(10),
  ),
});
