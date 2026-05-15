import { z } from 'zod';

export const PUBLIC_PAGE_TYPES = [
  'HOME',
  'CATALOG',
  'ARTICLE_DETAIL',
  'PURCHASE_GUIDE',
  'TERMS',
  'CONTACT',
];

export const publicPageVisitSchema = z.object({
  pageType: z.enum(PUBLIC_PAGE_TYPES),
  route: z.string().trim().min(1).max(255),
  articleId: z.coerce.number().int().positive().nullable().optional(),
});
