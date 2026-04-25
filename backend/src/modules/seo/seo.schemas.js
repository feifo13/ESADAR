import { z } from 'zod';

export const updateSeoPageSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().min(2).max(500),
  canonicalUrl: z.string().trim().url().max(500).optional().nullable(),
  ogImage: z.string().trim().max(500).optional().nullable(),
  isIndexable: z.coerce.boolean().default(true),
});
