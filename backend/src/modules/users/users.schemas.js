import { z } from 'zod';
import {
  optionalBooleanish,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortFieldSchema,
  sortDirSchema,
} from '../../utils/listing.js';

export const adminUserListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  isActive: optionalBooleanish,
  role: optionalTrimmedString(50),
  sortBy: sortFieldSchema(['createdAt', 'updatedAt', 'lastLoginAt', 'name', 'email', 'status'], 'createdAt'),
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

export const adminUserPasswordSchema = z.object({
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128),
});
