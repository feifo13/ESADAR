import { z } from 'zod';

const nullableTrimmed = (max) =>
  z.preprocess(
    (value) => {
      const text = String(value ?? '').trim();
      return text || null;
    },
    z.string().max(max).nullable(),
  );

export const siteHeroUpdateSchema = z.object({
  title: nullableTrimmed(180),
  subtitle: nullableTrimmed(500),
  ctaLabel: nullableTrimmed(120),
  ctaUrl: nullableTrimmed(500),
  imageUrl: nullableTrimmed(500).optional(),
  imageAlt: nullableTrimmed(255),
  isActive: z.coerce.boolean().default(true),
});

export const siteHeroImageUpdateSchema = z.object({
  imageAlt: nullableTrimmed(255).optional(),
});
