import { z } from 'zod';
import {
  optionalBooleanish,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortFieldSchema,
  sortDirSchema,
} from '../../utils/listing.js';
import {
  customerAddressSchema,
  requiredEmailSchema,
  requiredPersonNameSchema,
} from '../customers/customer-profile.schemas.js';
import {
  isValidUruguayMobile,
  normalizeUruguayMobile,
} from '../../../../frontend/src/shared/customer-profile.js';

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
  firstName: requiredPersonNameSchema,
  lastName: requiredPersonNameSchema,
  email: requiredEmailSchema,
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
  defaultAddress: customerAddressSchema.nullable().optional(),
  isActive: z.boolean(),
  roles: z.array(z.enum(ROLE_CODES)).min(1),
}).superRefine((value, ctx) => {
  if (!value.roles.includes('CUSTOMER')) return;

  if (!isValidUruguayMobile(value.phone)) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: 'Ingresá un celular uruguayo válido para el cliente.',
    });
  }
  if (!value.defaultAddress) {
    ctx.addIssue({
      code: 'custom',
      path: ['defaultAddress'],
      message: 'La dirección completa es obligatoria para el cliente.',
    });
  }
}).transform((value) => ({
  ...value,
  phone: value.roles.includes('CUSTOMER') ? normalizeUruguayMobile(value.phone) : value.phone,
  address: value.roles.includes('CUSTOMER')
    ? value.defaultAddress?.addressLine || null
    : value.address,
}));

export const adminUserPasswordSchema = z.object({
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128),
});
