import { z } from 'zod';

export const SITE_HERO_HEIGHT_MODES = ['HALF_SCREEN', 'FULL_SCREEN', 'CUSTOM'];
export const SITE_HERO_DISPLAY_MODES = ['SINGLE_IMAGE', 'CAROUSEL'];

const nullableTrimmed = (max) =>
  z.preprocess(
    (value) => {
      const text = String(value ?? '').trim();
      return text || null;
    },
    z.string().max(max).nullable(),
  );

const optionalNullableTrimmed = (max) => nullableTrimmed(max).optional();

const heroImageSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  imageUrl: optionalNullableTrimmed(500),
  imageAlt: optionalNullableTrimmed(255),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const siteHeroUpdateSchema = z.object({
  title: nullableTrimmed(180),
  subtitle: nullableTrimmed(500),
  ctaLabel: nullableTrimmed(120),
  ctaUrl: nullableTrimmed(500),
  heroHeightMode: z.enum(SITE_HERO_HEIGHT_MODES).default('HALF_SCREEN'),
  customHeightVh: z.preprocess(
    (value) => {
      if (value == null || value === '') return null;
      return Number(value);
    },
    z.number().int().min(30).max(100).nullable(),
  ),
  heroDisplayMode: z.enum(SITE_HERO_DISPLAY_MODES).default('SINGLE_IMAGE'),
  imageUrl: optionalNullableTrimmed(500),
  imageAlt: nullableTrimmed(255),
  images: z.array(heroImageSchema).max(20).optional(),
  isActive: z.coerce.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.heroHeightMode === 'CUSTOM' && value.customHeightVh == null) {
    ctx.addIssue({
      code: 'custom',
      path: ['customHeightVh'],
      message: 'customHeightVh is required when heroHeightMode is CUSTOM',
    });
  }
});

export const siteHeroImageUpdateSchema = z.object({
  imageAlt: optionalNullableTrimmed(255),
  heroDisplayMode: z.enum(SITE_HERO_DISPLAY_MODES).optional(),
});
