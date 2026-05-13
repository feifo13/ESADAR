import { z } from 'zod';
import {
  optionalDateString,
  optionalEnum,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';

export const createContactMessageSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  birthDate: z.string().date().optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  instagram: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(2).max(3000),
});

export const updateContactMessageStatusSchema = z.object({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']),
});

export const replyContactMessageSchema = z.object({
  replyMessage: z.string().trim().min(2).max(4000),
});

export const adminContactMessageListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  search: optionalTrimmedString(150),
  status: optionalEnum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  sortBy: optionalEnum(['createdAt', 'status', 'name', 'email']),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
