import { z } from 'zod';
import { emptyToUndefined } from '../../utils/listing.js';

const optionalTrimmed = (max) => z.preprocess(
  emptyToUndefined,
  z.string().trim().max(max).nullable().optional(),
);

const preferenceArraySchema = z.preprocess(
  (value) => {
    if (value == null || value === '') return undefined;
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
    }
    return value;
  },
  z.array(z.string().trim().min(1).max(120)).max(100).nullable().optional(),
);

const defaultAddressSchema = z.object({
  label: optionalTrimmed(80),
  addressLine: optionalTrimmed(255),
  city: optionalTrimmed(120),
  state: optionalTrimmed(120),
  country: optionalTrimmed(120),
  postalCode: optionalTrimmed(30),
  deliveryNotes: optionalTrimmed(2000),
}).superRefine((value, ctx) => {
  const hasOtherFields = [
    value.city,
    value.state,
    value.country,
    value.postalCode,
    value.deliveryNotes,
  ].some(Boolean);

  if (hasOtherFields && !value.addressLine) {
    ctx.addIssue({
      code: 'custom',
      path: ['addressLine'],
      message: 'La dirección principal es obligatoria si completás datos de envío.',
    });
  }
});

export const accountProfileUpdateSchema = z.object({
  firstName: optionalTrimmed(100),
  lastName: optionalTrimmed(100),
  birthDate: z.preprocess(emptyToUndefined, z.string().date().nullable().optional()),
  phone: optionalTrimmed(50),
  instagram: optionalTrimmed(100),
  defaultAddress: defaultAddressSchema.nullable().optional(),
  preferredPaymentMethod: z.preprocess(
    emptyToUndefined,
    z.enum(['BANK_TRANSFER', 'MERCADO_PAGO']).nullable().optional(),
  ),
  preferredShippingMethodId: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().nullable().optional(),
  ),
  preferredCategories: preferenceArraySchema,
  preferredBrands: preferenceArraySchema,
  preferredSizes: preferenceArraySchema,
  preferredColors: preferenceArraySchema,
  preferenceNotes: optionalTrimmed(2000),
});
