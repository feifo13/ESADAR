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

const optionalContactString = (max) => z.string().trim().max(max).optional().nullable();
const preferenceArraySchema = z.array(z.union([z.string().trim(), z.coerce.number()])).max(100).optional().nullable();

const leadIdentitySchema = z.object({
  firstName: optionalContactString(100),
  lastName: optionalContactString(100),
  birthDate: z.string().date().optional().nullable(),
  email: z.string().trim().email().max(255),
  phone: optionalContactString(50),
  instagram: optionalContactString(100),
  address: optionalContactString(255),
});

export const publicNewsletterLeadSchema = leadIdentitySchema.extend({
  preferredCategories: preferenceArraySchema,
  preferredBrands: preferenceArraySchema,
  preferredSizes: preferenceArraySchema,
  preferredColors: preferenceArraySchema,
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const publicLeadPreferencesSchema = leadIdentitySchema.extend({
  potentialCustomerId: z.coerce.number().int().positive().optional().nullable(),
  preferredCategories: preferenceArraySchema,
  preferredBrands: preferenceArraySchema,
  preferredSizes: preferenceArraySchema,
  preferredColors: preferenceArraySchema,
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const publicStockAlertSchema = leadIdentitySchema.extend({
  articleId: z.coerce.number().int().positive().optional().nullable(),
  alertType: z.enum(['BACK_IN_STOCK', 'SIMILAR_ITEMS', 'PRICE_OR_OFFER', 'NEW_ARRIVALS']).default('BACK_IN_STOCK'),
  preferredCategories: preferenceArraySchema,
  preferredBrands: preferenceArraySchema,
  preferredSizes: preferenceArraySchema,
  preferredColors: preferenceArraySchema,
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const wishlistMutationSchema = z.object({
  articleId: z.coerce.number().int().positive(),
  sessionToken: optionalContactString(120),
  contact: leadIdentitySchema.optional(),
});

export const wishlistQuerySchema = z.object({
  sessionToken: optionalTrimmedString(120),
});

export const articleEventSchema = z.object({
  articleId: z.coerce.number().int().positive().optional().nullable(),
  eventType: z.enum(['VIEW', 'SHARE', 'ADD_TO_CART', 'OFFER_CLICK', 'CHECKOUT_START', 'WISHLIST_ADD', 'STOCK_ALERT']),
  sessionToken: optionalTrimmedString(120),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const adminLeadListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  source: optionalEnum(['CHECKOUT', 'CONTACT_FORM', 'MANUAL', 'OFFER', 'NEWSLETTER', 'STOCK_ALERT', 'WISHLIST', 'ABANDONED_CART', 'PRODUCT_INTEREST']),
  leadStatus: optionalEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'ARCHIVED']),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  sortBy: optionalSortField(['createdAt', 'updatedAt', 'source', 'leadStatus', 'name']),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});

export const updateLeadStatusSchema = z.object({
  leadStatus: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'ARCHIVED']),
  adminNotes: z.string().trim().max(4000).optional().nullable(),
});

export const adminArticleEventsQuerySchema = z.object({
  articleId: optionalPositiveInt,
  eventType: optionalEnum(['VIEW', 'SHARE', 'ADD_TO_CART', 'OFFER_CLICK', 'CHECKOUT_START', 'WISHLIST_ADD', 'STOCK_ALERT']),
  q: optionalTrimmedString(150),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  sortBy: optionalSortField(['createdAt', 'eventType']),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
