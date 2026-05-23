import { z } from 'zod';

const nullableTrimmed = (max) =>
  z.preprocess(
    (value) => {
      const text = String(value ?? '').trim();
      return text || null;
    },
    z.string().max(max).nullable(),
  );

const optionalNullableTrimmed = (max) => nullableTrimmed(max).optional();

const viewportTargetSchema = z.preprocess(
  (value) => String(value || 'DESKTOP_TABLET').trim().toUpperCase(),
  z.enum(['DESKTOP_TABLET', 'MOBILE']),
);

const heroImageSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  imageUrl: optionalNullableTrimmed(500),
  imageAlt: optionalNullableTrimmed(255),
  viewportTarget: viewportTargetSchema.default('DESKTOP_TABLET'),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.coerce.boolean().default(false),
});

export const siteHeroUpdateSchema = z.object({
  imageAlt: nullableTrimmed(255),
  images: z.array(heroImageSchema).max(50).optional(),
  isActive: z.coerce.boolean().default(true),
});

export const siteHeroImageUpdateSchema = z.object({
  imageAlt: optionalNullableTrimmed(255),
  viewportTarget: viewportTargetSchema.default('DESKTOP_TABLET'),
});
