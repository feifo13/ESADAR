import { z } from 'zod';
import {
  optionalDateString,
  optionalEnum,
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
  sortBy: optionalEnum(['createdAt', 'actionCode', 'actorLabel', 'entityType', 'source']),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});
