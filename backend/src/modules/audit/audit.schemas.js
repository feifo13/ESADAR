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

export const auditListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  source: optionalEnum(['BACKOFFICE', 'FRONTEND', 'SYSTEM', 'API']),
  entityType: optionalTrimmedString(100),
  actionCode: optionalTrimmedString(100),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  sortBy: optionalSortField(['createdAt', 'actionCode', 'actorLabel', 'entityType', 'source']),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
