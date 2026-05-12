import { z } from 'zod';
import { optionalTrimmedString, pageSchema, pageSizeSchema, sortDirSchema } from '../../utils/listing.js';

function trimmed(max) {
  return z.preprocess(
    (value) => (value == null ? undefined : String(value).trim()),
    z.string().max(max).optional(),
  );
}

export const clientLogCreateSchema = z.object({
  level: trimmed(30).default('error'),
  type: trimmed(120).default('ClientError'),
  message: z.preprocess(
    (value) => String(value || '').trim(),
    z.string().min(1).max(500),
  ),
  stack: trimmed(4000),
  route: trimmed(500),
  userAgent: trimmed(500),
  statusCode: z.preprocess(
    (value) => (value == null || value === '' ? null : Number(value)),
    z.number().int().min(100).max(599).nullable().optional(),
  ),
  requestId: trimmed(120),
  metadata: z.any().optional(),
});

export const clientLogListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  level: optionalTrimmedString(30),
  type: optionalTrimmedString(120),
  page: pageSchema,
  pageSize: pageSizeSchema(25),
  sortBy: z.preprocess(
    (value) => (value == null || String(value).trim() === '' ? undefined : String(value).trim()),
    z.enum(['createdAt', 'level', 'type', 'statusCode']).default('createdAt'),
  ),
  sortDir: sortDirSchema,
});
