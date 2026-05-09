import { z } from 'zod';
import {
  optionalBooleanish,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';

export const adminUserListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  isActive: optionalBooleanish,
  role: optionalTrimmedString(50),
  sortBy: z.preprocess(
    (value) => (value == null || String(value).trim() === '' ? undefined : String(value).trim()),
    z.enum(['createdAt', 'updatedAt', 'lastLoginAt', 'name', 'email', 'status']).default('createdAt'),
  ),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});

export const adminUserStatusSchema = z.object({
  isActive: z.boolean(),
});
