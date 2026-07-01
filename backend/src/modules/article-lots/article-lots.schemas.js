import { z } from 'zod';
import {
  emptyToUndefined,
  optionalDateString,
  optionalEnum,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
  sortFieldSchema,
} from '../../utils/listing.js';

export const ARTICLE_LOT_STATUSES = ['OPEN', 'CLOSED', 'ARCHIVED'];

function optionalNullableTrimmedString(maxLength) {
  return z.preprocess(
    (value) => {
      if (value == null) return null;
      const text = String(value).trim();
      return text || null;
    },
    z.string().max(maxLength).nullable().optional(),
  );
}

const codeSchema = z.preprocess(
  (value) => String(value || '').trim().toUpperCase(),
  z.string()
    .min(2, 'Ingresa un codigo de lote.')
    .max(80, 'El codigo de lote es demasiado largo.')
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, 'Usa solo letras, numeros, guion o guion bajo.'),
);

export const articleLotListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  status: optionalEnum(ARTICLE_LOT_STATUSES),
  sortBy: sortFieldSchema(['code', 'name', 'status', 'acquisitionDate', 'arrivalDate', 'createdAt', 'updatedAt'], 'createdAt'),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});

export const articleLotOptionsQuerySchema = z.object({
  includeArchived: z.preprocess((value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'si', 'sí'].includes(normalized);
  }, z.boolean().default(false)),
});

export const articleLotWriteSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2, 'Ingresa un nombre de lote.').max(160),
  description: optionalNullableTrimmedString(5000),
  sourceLabel: optionalNullableTrimmedString(120),
  acquisitionDate: z.preprocess(emptyToUndefined, optionalDateString.nullable().optional()),
  arrivalDate: z.preprocess(emptyToUndefined, optionalDateString.nullable().optional()),
  status: z.enum(ARTICLE_LOT_STATUSES).default('OPEN'),
  notes: optionalNullableTrimmedString(5000),
});

export const articleLotStatusSchema = z.object({
  status: z.enum(ARTICLE_LOT_STATUSES),
});

export const articleLotProfitProjectionExportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('xlsx'),
});
