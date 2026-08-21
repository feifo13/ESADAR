import { z } from 'zod';
import {
  DWELLING_TYPES,
  URUGUAY_COUNTRY,
  isUruguayDepartment,
  isValidEmail,
  isValidRequiredPersonName,
  isValidUruguayMobile,
  normalizeCustomerAddress,
  normalizeEmail,
  normalizePersonName,
  normalizeUruguayMobile,
  normalizeWhitespace,
} from '../../../../frontend/src/shared/customer-profile.js';

export const requiredPersonNameSchema = z.preprocess(
  normalizePersonName,
  z.string().max(100).refine(isValidRequiredPersonName, 'El nombre es obligatorio.'),
);

export const requiredEmailSchema = z.preprocess(
  normalizeEmail,
  z.string().max(255).refine(isValidEmail, 'Ingresá un email válido.'),
);

export const requiredUruguayMobileSchema = z.preprocess(
  normalizeUruguayMobile,
  z.string().refine(isValidUruguayMobile, 'Ingresá un celular uruguayo válido.').max(8),
);

export const optionalUruguayMobileSchema = z.preprocess(
  (value) => {
    const normalized = normalizeUruguayMobile(value);
    return normalized || null;
  },
  z.string().refine(isValidUruguayMobile, 'Ingresá un celular uruguayo válido.').max(8).nullable().optional(),
);

const requiredAddressText = (message, max) => z.preprocess(
  normalizeWhitespace,
  z.string().min(1, message).max(max),
);

const optionalAddressText = (max) => z.preprocess(
  (value) => normalizeWhitespace(value) || null,
  z.string().max(max).nullable().optional(),
);

export const customerAddressSchema = z.object({
  label: optionalAddressText(80),
  addressLine: requiredAddressText('La dirección es obligatoria.', 255),
  city: requiredAddressText('La ciudad es obligatoria.', 120),
  state: z.preprocess(
    normalizeWhitespace,
    z.string().refine(isUruguayDepartment, 'Seleccioná un departamento válido.'),
  ),
  country: z.preprocess(
    (value) => normalizeWhitespace(value) || URUGUAY_COUNTRY,
    z.literal(URUGUAY_COUNTRY, { error: 'El país debe ser Uruguay.' }),
  ),
  postalCode: requiredAddressText('El código postal es obligatorio.', 30),
  dwellingType: z.preprocess(
    (value) => normalizeWhitespace(value).toUpperCase(),
    z.enum(Object.values(DWELLING_TYPES), { error: 'Seleccioná casa o apartamento.' }),
  ),
  apartment: optionalAddressText(80),
  deliveryNotes: optionalAddressText(2000),
}).superRefine((address, ctx) => {
  if (address.dwellingType === DWELLING_TYPES.APARTMENT && !normalizeWhitespace(address.apartment)) {
    ctx.addIssue({
      code: 'custom',
      path: ['apartment'],
      message: 'El apartamento es obligatorio.',
    });
  }
}).transform(normalizeCustomerAddress);

export const customerIdentityContactShape = {
  firstName: requiredPersonNameSchema,
  lastName: requiredPersonNameSchema,
  email: requiredEmailSchema,
  phone: requiredUruguayMobileSchema,
};
