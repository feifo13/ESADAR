import { z } from 'zod';
import {
  optionalBooleanish,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortFieldSchema,
  sortDirSchema,
} from '../../utils/listing.js';

const pricingTypeSchema = z.enum(['FIXED', 'AHIVA_CORREO_NACIONAL', 'WEIGHT_RANGES']).default('FIXED');

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

const optionalOfficialRatesUrlSchema = optionalNullableTrimmedString(500).refine(
  (value) => !value || /^https?:\/\//i.test(value),
  'La URL oficial debe comenzar con http:// o https://.',
);

const optionalOfficialRatesPathSchema = optionalNullableTrimmedString(500).refine(
  (value) => !value || value.startsWith('/'),
  'El path oficial debe comenzar con /.',
);

const weightRateSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  minWeightKg: z.coerce.number().min(0, 'El peso mínimo no puede ser negativo.'),
  maxWeightKg: z.coerce.number().min(0, 'El peso maximo no puede ser negativo.'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo.'),
  label: z.preprocess(
    (value) => (value == null ? '' : String(value).trim()),
    z.string().max(120).optional(),
  ),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.preprocess((value) => {
    if (value == null || value === '') return true;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return value;
  }, z.boolean().default(true)),
});

export const adminShippingListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  isActive: optionalBooleanish,
  sortBy: sortFieldSchema(['description', 'baseCost', 'pricingType', 'status', 'createdAt', 'updatedAt'], 'createdAt'),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});

export const shippingMethodWriteSchema = z.object({
  description: z.string().trim().min(2, 'Ingresa una descripcion.').max(150),
  baseCost: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
  pricingType: pricingTypeSchema,
  officialRatesLabel: optionalNullableTrimmedString(120),
  officialRatesUrl: optionalOfficialRatesUrlSchema,
  officialRatesFilePath: optionalOfficialRatesPathSchema,
  instructions: z.preprocess(
    (value) => (value == null ? '' : String(value).trim()),
    z.string().max(3000).optional(),
  ),
  weightRates: z.array(weightRateSchema).optional().default([]),
  isActive: z.preprocess((value) => {
    if (value == null || value === '') return true;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return value;
  }, z.boolean().default(true)),
});

export const shippingMethodStatusSchema = z.object({
  isActive: z.boolean(),
});
