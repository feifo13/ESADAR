import { z } from 'zod';
import {
  optionalDateString,
  optionalEnum,
  optionalPositiveInt,
  optionalSortField,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';

const guestSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  birthDate: z.string().date().optional().nullable(),
  email: z.string().trim().email().max(255),
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
        acceptedOfferId: z.coerce.number().int().positive().nullable().optional(),
      }),
    )
    .min(1),
  guest: guestSchema.optional(),
  notes: z.string().trim().optional().nullable(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});

export const batchOrderActionSchema = z.object({
  action: z.enum(['APPROVE', 'CANCEL', 'SHIP']),
  ids: z.array(z.coerce.number().int().positive()).min(1).max(100)
    .transform((ids) => Array.from(new Set(ids))),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const createOrderPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  providerName: z.string().trim().max(100).optional().nullable(),
  providerReference: z.string().trim().max(150).optional().nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'REFUNDED']).default('APPROVED'),
});

export const expireReservationsSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  now: z.string().datetime().optional(),
});

export const adminOrderListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  status: optionalEnum(['PENDING', 'RESERVED', 'APPROVED', 'SHIPPED', 'CANCELLED', 'EXPIRED']),
  paymentStatus: optionalEnum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  sortBy: optionalSortField([
    'createdAt',
    'orderNumber',
    'total',
    'orderStatus',
    'paymentStatus',
    'customerName',
  ]),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
