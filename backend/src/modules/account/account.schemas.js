import { z } from 'zod';
import { emptyToUndefined } from '../../utils/listing.js';
import {
  customerAddressSchema,
  customerIdentityContactShape,
} from '../customers/customer-profile.schemas.js';

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

export const accountProfileUpdateSchema = z.object({
  ...customerIdentityContactShape,
  birthDate: z.preprocess(emptyToUndefined, z.string().date().nullable().optional()),
  instagram: optionalTrimmed(100),
  defaultAddress: customerAddressSchema,
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
