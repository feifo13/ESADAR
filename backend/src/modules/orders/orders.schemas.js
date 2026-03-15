import { z } from 'zod';

const guestSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  birthDate: z.string().date().optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  instagram: z.string().trim().max(100).optional().nullable(),
});

export const createOrderSchema = z.object({
  shippingMethodId: z.coerce.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'MERCADO_PAGO']),
  items: z
    .array(
      z.object({
        articleId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive().default(1),
      }),
    )
    .min(1),
  guest: guestSchema.optional(),
  notes: z.string().trim().optional().nullable(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});
