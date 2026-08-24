import { z } from 'zod';
import {
  emptyToUndefined,
  optionalBooleanish,
  optionalDateString,
  optionalEnum,
  optionalPositiveInt,
  optionalTrimmedString,
} from '../../utils/listing.js';
import { COST_INTEGRITY_ISSUE_CODES } from './cost-integrity.js';
import { ROTATION_HISTORY_SCOPES } from './stock.projection.js';

const formatSchema = z.preprocess(
  emptyToUndefined,
  z.enum(['csv', 'xlsx']).default('xlsx'),
);
const paymentMethodSchema = optionalEnum(['BANK_TRANSFER', 'MERCADO_PAGO']);
const publicationStatusSchema = optionalEnum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);
const stockStatusSchema = optionalEnum(['ACTIVE', 'RESERVED', 'SOLD_OUT']);
const historicalDataQualitySchema = optionalEnum(['COMPLETE', 'INCOMPLETE']);

function booleanishWithDefault(defaultValue) {
  return z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (normalized === undefined) return defaultValue;
    if (typeof normalized === 'boolean') return normalized;
    const text = String(normalized).trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(text)) return true;
    if (['false', '0', 'no', 'off'].includes(text)) return false;
    return normalized;
  }, z.boolean().default(defaultValue));
}

function withValidDateRange(schema) {
  return schema.superRefine((value, context) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      context.addIssue({
        code: 'custom',
        path: ['dateTo'],
        message: 'Hasta debe ser igual o posterior a Desde.',
      });
    }
  });
}

const historicalBaseShape = {
  format: formatSchema,
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  lotId: optionalPositiveInt,
  paymentMethod: paymentMethodSchema,
  shippingMethod: optionalTrimmedString(150),
  q: optionalTrimmedString(150),
};

export const salesReportQuerySchema = withValidDateRange(
  z.object(historicalBaseShape).strict(),
);

export const realizedProfitsReportQuerySchema = withValidDateRange(
  z.object({
    ...historicalBaseShape,
    dataQuality: historicalDataQualitySchema,
  }).strict(),
);

const currentArticleBaseShape = {
  format: formatSchema,
  q: optionalTrimmedString(150),
  lotId: optionalPositiveInt,
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  sizeId: optionalPositiveInt,
  publicationStatus: publicationStatusSchema,
  stockStatus: stockStatusSchema,
};

export const profitProjectionReportQuerySchema = withValidDateRange(
  z.object({
    ...currentArticleBaseShape,
    featured: optionalBooleanish,
    offerable: optionalBooleanish,
    dateFrom: optionalDateString,
    dateTo: optionalDateString,
  }).strict(),
);

export const stockReportQuerySchema = z.object(currentArticleBaseShape).strict();

export const stockRotationReportQuerySchema = withValidDateRange(
  z.object({
    ...currentArticleBaseShape,
    dateFrom: optionalDateString,
    dateTo: optionalDateString,
    minDays: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(36500).optional(),
    ),
    historyScope: optionalEnum(Object.values(ROTATION_HISTORY_SCOPES)),
    hasRecordedSale: optionalBooleanish,
  }).strict(),
);

export const costIntegrityReportQuerySchema = withValidDateRange(
  z.object({
    format: formatSchema,
    scope: z.preprocess(
      emptyToUndefined,
      z.enum(['CURRENT_ARTICLES', 'HISTORICAL_SALES', 'ALL']).default('ALL'),
    ),
    issueCode: optionalEnum(Object.values(COST_INTEGRITY_ISSUE_CODES)),
    unreliableOnly: booleanishWithDefault(true),
    q: optionalTrimmedString(150),
    lotId: optionalPositiveInt,
    categoryId: optionalPositiveInt,
    brandId: optionalPositiveInt,
    dateFrom: optionalDateString,
    dateTo: optionalDateString,
  }).strict().superRefine((value, context) => {
    if (value.scope !== 'CURRENT_ARTICLES' && (value.categoryId || value.brandId)) {
      context.addIssue({
        code: 'custom',
        path: ['scope'],
        message: 'Categoría y marca solo aplican al alcance Artículos actuales.',
      });
    }
  }),
);

export const REPORT_QUERY_SCHEMAS = Object.freeze({
  sales: salesReportQuerySchema,
  'profit-projection': profitProjectionReportQuerySchema,
  'realized-profits': realizedProfitsReportQuerySchema,
  stock: stockReportQuerySchema,
  'stock-rotation': stockRotationReportQuerySchema,
  'cost-integrity': costIntegrityReportQuerySchema,
});
