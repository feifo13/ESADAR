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
const tickerColorTokens = new Set(['orange', 'navy', 'aqua', 'surface', 'text']);

function isSafeInternalTickerUrl(value) {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized) return true;
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return false;
  if (/[\u0000-\u001f]/.test(normalized)) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(normalized);
}

function isTickerBackgroundColor(value) {
  const normalized = String(value || '').trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) return true;
  return tickerColorTokens.has(normalized.toLowerCase());
}

const booleanFromFormValue = (fallback) =>
  z.preprocess((value) => {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
    return value;
  }, z.boolean());

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

export const siteTickerUpdateSchema = z.object({
  isEnabled: booleanFromFormValue(true),
  text: z.preprocess(
    (value) => String(value ?? '').trim(),
    z.string().min(1, 'El texto del ticker es obligatorio.').max(180),
  ),
  targetUrl: z.preprocess(
    (value) => String(value ?? '/articles').trim(),
    z.string().max(500).refine(isSafeInternalTickerUrl, {
      message: 'La URL del ticker debe ser interna.',
    }),
  ),
  targetSection: optionalNullableTrimmed(80).refine(
    (value) => !value || /^[a-z0-9_-]{1,80}$/i.test(value),
    'La sección debe usar letras, números, guion o guion bajo.',
  ),
  backgroundColor: z.preprocess(
    (value) => String(value ?? '#ec672b').trim(),
    z.string().max(32).refine(isTickerBackgroundColor, {
      message: 'Usa un color hexadecimal o un token válido.',
    }),
  ),
  isSticky: booleanFromFormValue(false),
});
