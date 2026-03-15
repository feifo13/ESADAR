import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
  birthDate: z.string().date().optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  instagram: z.string().trim().max(100).optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
});
