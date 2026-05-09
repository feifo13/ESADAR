import { z } from 'zod';
import {
  optionalBooleanish,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';

function emptyToUndefined(value) {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export const adminShippingListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  isActive: optionalBooleanish,
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(['description', 'baseCost', 'status', 'createdAt', 'updatedAt']).default('createdAt'),
  ),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});

export const shippingMethodWriteSchema = z.object({
  description: z.string().trim().min(2, 'Ingresa una descripcion.').max(150),
  baseCost: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
  instructions: z.preprocess(
    (value) => (value == null ? '' : String(value).trim()),
    z.string().max(3000).optional(),
  ),
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
