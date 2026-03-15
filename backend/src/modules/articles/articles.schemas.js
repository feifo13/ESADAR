import { z } from 'zod';

const numericMoney = z.coerce.number().min(0);
const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional();

const articleBaseShape = {
  internalCode: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(180).optional(),
  title: z.string().trim().min(2).max(255),
  categoryId: z.coerce.number().int().positive(),
  brandId: optionalId,
  sizeId: optionalId,
  sizeText: z.string().trim().max(80).optional().nullable(),
  measurementsText: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  purchasePriceItem: numericMoney.default(0),
  purchasePriceShipping: numericMoney.default(0),
  purchasePriceCourier: numericMoney.default(0),
  salePrice: numericMoney,
  discountType: z.enum(['NONE', 'PERCENT', 'FIXED']).default('NONE'),
  discountValue: numericMoney.default(0),
  allowOffers: z.coerce.boolean().default(false),
  isFeatured: z.coerce.boolean().default(false),
  intakeDate: z.string().date(),
  quantityTotal: z.coerce.number().int().min(0).default(1),
  quantityAvailable: z.coerce.number().int().min(0).optional(),
  quantityReserved: z.coerce.number().int().min(0).default(0),
  quantitySold: z.coerce.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'RESERVED', 'SOLD_OUT']).default('ACTIVE'),
  originNotes: z.string().trim().optional().nullable(),
};

const articleCreateBaseSchema = z.object(articleBaseShape);
const articleUpdateBaseSchema = z.object({
  internalCode: articleBaseShape.internalCode,
  slug: articleBaseShape.slug,
  title: articleBaseShape.title.optional(),
  categoryId: articleBaseShape.categoryId.optional(),
  brandId: articleBaseShape.brandId,
  sizeId: articleBaseShape.sizeId,
  sizeText: articleBaseShape.sizeText,
  measurementsText: articleBaseShape.measurementsText,
  description: articleBaseShape.description,
  purchasePriceItem: articleBaseShape.purchasePriceItem.optional(),
  purchasePriceShipping: articleBaseShape.purchasePriceShipping.optional(),
  purchasePriceCourier: articleBaseShape.purchasePriceCourier.optional(),
  salePrice: articleBaseShape.salePrice.optional(),
  discountType: articleBaseShape.discountType.optional(),
  discountValue: articleBaseShape.discountValue.optional(),
  allowOffers: articleBaseShape.allowOffers.optional(),
  isFeatured: articleBaseShape.isFeatured.optional(),
  intakeDate: articleBaseShape.intakeDate.optional(),
  quantityTotal: articleBaseShape.quantityTotal.optional(),
  quantityAvailable: articleBaseShape.quantityAvailable,
  quantityReserved: articleBaseShape.quantityReserved.optional(),
  quantitySold: articleBaseShape.quantitySold.optional(),
  status: articleBaseShape.status.optional(),
  originNotes: articleBaseShape.originNotes,
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
  const quantityTotal = value.quantityTotal;
  const quantityAvailable = value.quantityAvailable;
  const quantityReserved = value.quantityReserved;
  const quantitySold = value.quantitySold;

  const hasAnyQuantity = [quantityTotal, quantityAvailable, quantityReserved, quantitySold].some(
    (item) => item != null,
  );

  if (hasAnyQuantity && [quantityTotal, quantityAvailable, quantityReserved, quantitySold].some((item) => item == null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['quantityTotal'],
      message: 'When updating stock numbers, send quantityTotal, quantityAvailable, quantityReserved and quantitySold together',
    });
  }

  if (
    hasAnyQuantity &&
    quantityTotalIsInvalid(quantityTotal, quantityAvailable, quantityReserved, quantitySold)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['quantityTotal'],
      message: 'quantityTotal must be >= quantityAvailable + quantityReserved + quantitySold',
    });
  }

  if (value.allowOffers && value.discountType && value.discountType !== 'NONE' && (value.discountValue || 0) > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['allowOffers'],
      message: 'Articles with discount cannot allow offers',
    });
  }
});

export const articleStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'RESERVED', 'SOLD_OUT']),
});

function quantityTotalIsInvalid(total, available, reserved, sold) {
  return total < available + reserved + sold;
}
