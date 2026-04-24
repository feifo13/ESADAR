import { z } from 'zod';

export const createContactMessageSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  birthDate: z.string().date().optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  instagram: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  message: z.string().trim().min(2).max(3000),
});

export const updateContactMessageStatusSchema = z.object({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']),
});
