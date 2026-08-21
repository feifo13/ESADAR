import { z } from 'zod';
import {
  optionalDateString,
  optionalEnum,
  optionalSortField,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';
import {
  optionalUruguayMobileSchema,
  requiredEmailSchema,
  requiredPersonNameSchema,
} from '../customers/customer-profile.schemas.js';

export const createContactMessageSchema = z.object({
  firstName: requiredPersonNameSchema,
  lastName: requiredPersonNameSchema,
  birthDate: z.string().date().optional().nullable(),
  phone: optionalUruguayMobileSchema,
  instagram: z.string().trim().max(100).optional().nullable(),
  email: requiredEmailSchema,
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
  sortBy: optionalSortField(['createdAt', 'status', 'name', 'email']),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
