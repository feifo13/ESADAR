import { z } from 'zod';
import {
  customerAddressSchema,
  customerIdentityContactShape,
  requiredEmailSchema,
} from '../customers/customer-profile.schemas.js';

export const registerSchema = z.object({
  ...customerIdentityContactShape,
  password: z.string().min(6).max(100),
  birthDate: z.string().date().optional().nullable(),
  address: customerAddressSchema,
  instagram: z.string().trim().max(100).optional().nullable(),
});

export const loginSchema = z.object({
  email: requiredEmailSchema,
  password: z.string().min(6).max(100),
});

export const googleCredentialSchema = z.object({
  credential: z.string().trim().min(100).max(10000),
});

export const googleLinkSchema = googleCredentialSchema.extend({
  password: z.string().min(6).max(100),
});


export const forgotPasswordSchema = z.object({
  email: requiredEmailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(255),
  password: z.string().min(6).max(100),
});
