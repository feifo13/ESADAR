import { z } from 'zod';
import {
  emptyToUndefined,
  optionalBooleanish,
  optionalDateString,
  optionalEnum,
  optionalPositiveInt,
  optionalSortField,
  optionalTrimmedString,
  pageSchema,
  pageSizeSchema,
  sortDirSchema,
} from '../../utils/listing.js';

const numericMoney = z.coerce.number().min(0);
const optionalNullableId = z.preprocess(
  emptyToUndefined,
  z.union([z.coerce.number().int().positive(), z.null()]).optional(),
);

const articleGenderSchema = z.enum(['UNISEX', 'HOMBRE', 'MUJER', 'NIÑO', 'NIÑA', 'OTRO']);
const articleAgeGroupSchema = z.enum(['ADULT', 'KIDS', 'TODDLER', 'INFANT', 'NEWBORN']);
const articlePublicationStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);
const adminArticleStatusFilterValues = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED', 'RESERVED', 'SOLD_OUT'];

const articleBaseShape = {
  internalCode: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(180).optional(),
  title: z.string().trim().min(2).max(255),
  seoTitle: z.string().trim().max(255).optional().nullable(),
  seoDescription: z.string().trim().max(500).optional().nullable(),
  googleProductCategory: z.string().trim().max(255).optional().nullable(),
  conditionLabel: z.string().trim().max(120).optional().nullable(),
  color: z.string().trim().max(120).optional().nullable(),
  material: z.string().trim().max(120).optional().nullable(),
  gender: articleGenderSchema.optional().nullable(),
  ageGroup: articleAgeGroupSchema.optional().nullable(),
  imageAltOverride: z.string().trim().max(255).optional().nullable(),
  canonicalUrl: z.string().trim().url().max(500).optional().nullable(),
  lotId: optionalNullableId,
  categoryId: optionalNullableId,
  categoryName: z.string().trim().max(120).optional().nullable(),
  brandId: optionalNullableId,
  brandName: z.string().trim().max(120).optional().nullable(),
  sizeId: optionalNullableId,
  sizeCode: z.string().trim().max(80).optional().nullable(),
  sizeText: z.string().trim().max(80).optional().nullable(),
  measurementsText: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  weightKg: z.coerce.number().min(0).max(30).default(0),
  purchasePriceItem: numericMoney.default(0),
  purchasePriceShipping: numericMoney.default(0),
  purchasePriceCourier: numericMoney.default(0),
  salePrice: numericMoney,
  discountType: z.enum(['NONE', 'PERCENT', 'FIXED']).default('NONE'),
  discountValue: numericMoney.default(0),
  allowOffers: z.coerce.boolean().default(false),
  isFeatured: z.coerce.boolean().default(false),
  intakeDate: optionalDateString,
  quantityTotal: z.coerce.number().int().min(0).default(1),
  quantityAvailable: z.coerce.number().int().min(0).optional(),
  quantityReserved: z.coerce.number().int().min(0).default(0),
  quantitySold: z.coerce.number().int().min(0).default(0),
  status: articlePublicationStatusSchema.default('ACTIVE'),
  originNotes: z.string().trim().optional().nullable(),
};

const articleCreateBaseSchema = z.object(articleBaseShape);
const articleUpdateBaseSchema = z.object({
  internalCode: articleBaseShape.internalCode,
  slug: articleBaseShape.slug,
  title: articleBaseShape.title.optional(),
  seoTitle: articleBaseShape.seoTitle,
  seoDescription: articleBaseShape.seoDescription,
  googleProductCategory: articleBaseShape.googleProductCategory,
  conditionLabel: articleBaseShape.conditionLabel,
  color: articleBaseShape.color,
  material: articleBaseShape.material,
  gender: articleBaseShape.gender,
  ageGroup: articleBaseShape.ageGroup,
  imageAltOverride: articleBaseShape.imageAltOverride,
  canonicalUrl: articleBaseShape.canonicalUrl,
  lotId: articleBaseShape.lotId,
  categoryId: articleBaseShape.categoryId,
  categoryName: articleBaseShape.categoryName,
  brandId: articleBaseShape.brandId,
  brandName: articleBaseShape.brandName,
  sizeId: articleBaseShape.sizeId,
  sizeCode: articleBaseShape.sizeCode,
  sizeText: articleBaseShape.sizeText,
  measurementsText: articleBaseShape.measurementsText,
  description: articleBaseShape.description,
  weightKg: articleBaseShape.weightKg.optional(),
  purchasePriceItem: articleBaseShape.purchasePriceItem.optional(),
  purchasePriceShipping: articleBaseShape.purchasePriceShipping.optional(),
  purchasePriceCourier: articleBaseShape.purchasePriceCourier.optional(),
  salePrice: articleBaseShape.salePrice.optional(),
  discountType: articleBaseShape.discountType.optional(),
  discountValue: articleBaseShape.discountValue.optional(),
  allowOffers: articleBaseShape.allowOffers.optional(),
  isFeatured: articleBaseShape.isFeatured.optional(),
  intakeDate: articleBaseShape.intakeDate,
  quantityTotal: articleBaseShape.quantityTotal.optional(),
  quantityAvailable: articleBaseShape.quantityAvailable,
  status: articleBaseShape.status.optional(),
  originNotes: articleBaseShape.originNotes,
  stockAdjustmentReason: z.string().trim().max(255).optional().nullable(),
});

export const articleCreateSchema = articleCreateBaseSchema.superRefine((value, ctx) => {
  const quantityAvailable =
    value.quantityAvailable == null ? value.quantityTotal : value.quantityAvailable;

  if (quantityTotalIsInvalid(value.quantityTotal, quantityAvailable, value.quantityReserved, value.quantitySold)) {
    ctx.addIssue({
      code: 'custom',
      path: ['quantityTotal'],
      message: 'quantityTotal must be >= quantityAvailable + quantityReserved + quantitySold',
    });
  }

  if (value.allowOffers && value.discountType !== 'NONE' && value.discountValue > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['allowOffers'],
      message: 'Articles with discount cannot allow offers',
    });
  }

});

export const articleUpdateSchema = articleUpdateBaseSchema.superRefine((value, ctx) => {
  if (value.allowOffers && value.discountType && value.discountType !== 'NONE' && (value.discountValue || 0) > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['allowOffers'],
      message: 'Articles with discount cannot allow offers',
    });
  }

});

export const articleStatusSchema = z.object({
  status: articlePublicationStatusSchema,
});

export const articleStockAdjustmentSchema = z.object({
  quantityAvailable: z.coerce.number().int().min(0),
  reason: z.string().trim().min(2).max(255),
});

export const articleQuickFlagsSchema = z
  .object({
    status: articlePublicationStatusSchema.optional(),
    isFeatured: z.coerce.boolean().optional(),
    allowOffers: z.coerce.boolean().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.isFeatured !== undefined ||
      value.allowOffers !== undefined,
    { message: 'Debes enviar al menos un campo para actualizar' },
  );

export const adminArticleListQuerySchema = z.object({
  q: optionalTrimmedString(150),
  search: optionalTrimmedString(150),
  status: optionalEnum(adminArticleStatusFilterValues),
  featured: optionalBooleanish,
  offerable: optionalBooleanish,
  categoryId: optionalPositiveInt,
  lotId: optionalPositiveInt,
  lotCode: optionalTrimmedString(80),
  brandId: optionalPositiveInt,
  sizeId: optionalPositiveInt,
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
  sort: optionalSortField(['price_asc', 'price_desc', 'intake_asc', 'intake_desc']),
  sortBy: optionalSortField([
    'intakeDate',
    'title',
    'salePrice',
    'discountedPrice',
    'status',
    'quantityAvailable',
    'categoryName',
    'brandName',
    'lotCode',
    'lotName',
    'internalCode',
    'updatedAt',
  ]),
  sortDir: sortDirSchema,
  page: pageSchema,
  pageSize: pageSizeSchema(25),
});

export const publicArticleListQuerySchema = z.object({
  search: optionalTrimmedString(150),
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  sizeId: optionalPositiveInt,
  featured: optionalBooleanish,
  discounted: optionalBooleanish,
  offerable: optionalBooleanish,
  sort: optionalSortField(['price_asc', 'price_desc', 'intake_asc', 'intake_desc']),
  page: pageSchema,
  pageSize: pageSizeSchema(20),
});

export const publicRelatedArticlesQuerySchema = z.object({
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(12).default(8),
  ),
});

export const articleImportOptionsSchema = z.object({
  updateExisting: optionalBooleanish,
  createMissingLookups: optionalBooleanish,
  createMissingLots: optionalBooleanish,
});

export const articleImportTemplateQuerySchema = z.object({
  format: z.enum(['csv']).default('csv'),
  type: z.enum(['simple', 'full']).default('simple'),
});

export const articleExportQuerySchema = adminArticleListQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).default('xlsx'),
});

export const articleImageUpdateSchema = z.object({
  altText: z.string().trim().max(255).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isPrimary: z.coerce.boolean().optional(),
});

export const articleImageReorderSchema = z.object({
  imageIds: z.array(z.coerce.number().int().positive()).min(1),
});

export const bulkArticleRowSchema = z.object({
  internalCode: articleBaseShape.internalCode,
  title: articleBaseShape.title,
  salePrice: articleBaseShape.salePrice,
  categoryId: articleBaseShape.categoryId,
  lotId: articleBaseShape.lotId,
  categoryName: z.string().trim().max(120).optional().nullable(),
  brandId: articleBaseShape.brandId,
  brandName: z.string().trim().max(120).optional().nullable(),
  sizeId: articleBaseShape.sizeId,
  sizeCode: z.string().trim().max(80).optional().nullable(),
  sizeText: articleBaseShape.sizeText,
  conditionLabel: articleBaseShape.conditionLabel,
  color: articleBaseShape.color,
  material: articleBaseShape.material,
  quantityTotal: articleBaseShape.quantityTotal.optional(),
  allowOffers: articleBaseShape.allowOffers.optional(),
  isFeatured: articleBaseShape.isFeatured.optional(),
  description: articleBaseShape.description,
  measurementsText: articleBaseShape.measurementsText,
  purchasePriceItem: articleBaseShape.purchasePriceItem.optional(),
  purchasePriceShipping: articleBaseShape.purchasePriceShipping.optional(),
  purchasePriceCourier: articleBaseShape.purchasePriceCourier.optional(),
  seoTitle: articleBaseShape.seoTitle,
  seoDescription: articleBaseShape.seoDescription,
  primaryImage: z.string().trim().max(500).optional().nullable(),
  additionalImages: z.union([
    z.string().trim().max(4000),
    z.array(z.string().trim().max(500)),
  ]).optional().nullable(),
});

export const adminBulkArticleCreateSchema = z.object({
  createMissingLookups: z.coerce.boolean().default(false),
  lotId: optionalNullableId,
  articles: z.array(bulkArticleRowSchema).min(1).max(100),
});

export const adminArticleBatchActionSchema = z.object({
  action: z.enum([
    'ACTIVATE',
    'DEACTIVATE',
    'FEATURE',
    'UNFEATURE',
    'ALLOW_OFFERS',
    'DISALLOW_OFFERS',
    'ASSIGN_LOT',
  ]),
  lotId: optionalNullableId,
  ids: z.array(z.coerce.number().int().positive()).min(1).max(100)
    .transform((ids) => Array.from(new Set(ids))),
}).superRefine((value, ctx) => {
  if (value.action === 'ASSIGN_LOT' && !value.lotId) {
    ctx.addIssue({
      code: 'custom',
      path: ['lotId'],
      message: 'lotId es requerido para asignar lote',
    });
  }
});

function quantityTotalIsInvalid(total, available, reserved, sold) {
  return total < available + reserved + sold;
}
