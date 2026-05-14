import { z } from 'zod';
import {
  emptyToUndefined,
  optionalBooleanish,
  optionalDateString,
  optionalEnum,
  optionalPositiveInt,
  sortFieldSchema,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';

export const adminWishlistFiltersSchema = z.object({
  q: optionalTrimmedString(150),
  articleId: optionalPositiveInt,
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  status: optionalEnum(['ACTIVE', 'INACTIVE', 'RESERVED', 'SOLD_OUT']),
  source: optionalTrimmedString(60),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  onlyWithStock: optionalBooleanish,
  onlySoldOut: optionalBooleanish,
});

export const adminWishlistListQuerySchema = adminWishlistFiltersSchema.extend({
  sortBy: sortFieldSchema(['updatedAt', 'lastSavedAt', 'itemCount', 'ownerName', 'source'], 'updatedAt'),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});


export const adminWishlistTopQuerySchema = adminWishlistFiltersSchema.extend({
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(50).default(10),
  ),
});
