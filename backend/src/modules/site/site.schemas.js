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

const heroHeightModeSchema = z.preprocess(
  (value) => String(value || 'HALF_SCREEN').trim().toUpperCase(),
  z.enum(['HALF_SCREEN', 'FULL_SCREEN', 'CUSTOM']),
);

const heroDisplayModeSchema = z.preprocess(
  (value) => String(value || 'SINGLE_IMAGE').trim().toUpperCase(),
  z.enum(['SINGLE_IMAGE', 'CAROUSEL']),
);

export const siteHeroUpdateSchema = z.object({
  title: optionalNullableTrimmed(180),
  subtitle: optionalNullableTrimmed(500),
  ctaLabel: optionalNullableTrimmed(120),
  ctaUrl: optionalNullableTrimmed(500),
  heroHeightMode: heroHeightModeSchema.default('HALF_SCREEN'),
  customHeightVh: z.coerce.number().int().min(30).max(100).nullable().optional(),
  heroDisplayMode: heroDisplayModeSchema.default('SINGLE_IMAGE'),
  imageAlt: nullableTrimmed(255),
  images: z.array(heroImageSchema).max(50).optional(),
  isActive: z.coerce.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.heroHeightMode === 'CUSTOM' && value.customHeightVh == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customHeightVh'],
      message: 'El alto personalizado es obligatorio cuando el modo es CUSTOM.',
    });
  }
});

export const siteHeroImageUpdateSchema = z.object({
  imageAlt: optionalNullableTrimmed(255),
  viewportTarget: viewportTargetSchema.default('DESKTOP_TABLET'),
});
