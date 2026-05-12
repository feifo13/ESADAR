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


const ROLE_CODES = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'CUSTOMER'];

export const adminUserUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.preprocess(
    (value) => String(value || '').trim().toLowerCase(),
    z.string().email().max(255),
  ),
  phone: z.preprocess(
    (value) => (value == null ? null : String(value).trim() || null),
    z.string().max(50).nullable(),
  ),
  instagram: z.preprocess(
    (value) => (value == null ? null : String(value).trim() || null),
    z.string().max(100).nullable(),
  ),
  address: z.preprocess(
    (value) => (value == null ? null : String(value).trim() || null),
    z.string().max(255).nullable(),
  ),
  isActive: z.boolean(),
  roles: z.array(z.enum(ROLE_CODES)).min(1),
});
