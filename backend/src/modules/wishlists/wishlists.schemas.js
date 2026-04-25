import { z } from 'zod';
import {
  optionalBooleanish,
  optionalDateString,
  optionalPositiveInt,
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
  status: optionalTrimmedString(40),
  source: optionalTrimmedString(60),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  onlyWithStock: optionalBooleanish,
  onlySoldOut: optionalBooleanish,
});

export const adminWishlistListQuerySchema = adminWishlistFiltersSchema.extend({
  sortBy: z.preprocess(
    (value) => (value == null || value === '' ? undefined : value),
    z.enum(['updatedAt', 'lastSavedAt', 'itemCount', 'ownerName', 'source']).default('updatedAt'),
  ),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
