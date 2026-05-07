import { z } from 'zod';
import {
  optionalDateString,
  optionalEnum,
  optionalPositiveInt,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';

const guestOfferSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  birthDate: z.string().date().optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  instagram: z.string().trim().max(100).optional().nullable(),
});

export const createOfferSchema = z.object({
  articleId: z.coerce.number().int().positive(),
  offeredAmount: z.coerce.number().positive(),
  message: z.preprocess(
    (value) => {
      const text = typeof value === 'string' ? value.trim() : '';
      return text || 'Oferta enviada desde la web.';
    },
    z.string().trim().min(2).max(2000),
  ),
  guest: guestOfferSchema.optional(),
});

export const updateOfferStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'CANCELLED']),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const adminOfferListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  status: optionalEnum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED']),
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  sortBy: optionalEnum([
    'createdAt',
    'offeredAmount',
    'status',
    'articleTitle',
    'contactName',
  ]),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
