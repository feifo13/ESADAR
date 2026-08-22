import { z } from 'zod';
function emptyToNull(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

const nullableText = (max = 255) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const nullableLongText = z.preprocess(
  emptyToNull,
  z.string().trim().max(3000).nullable().optional(),
);

const booleanishOptional = z.preprocess((value) => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value;

  const normalized =
    String(value).trim().toLowerCase();

  if (
    ['true', '1', 'yes', 'si', 'sí', 'on'].includes(
      normalized,
    )
  ) {
    return true;
  }

  if (
    ['false', '0', 'no', 'off'].includes(
      normalized,
    )
  ) {
    return false;
  }

  return value;
}, z.boolean().optional());

const bankTaxPercent = z.preprocess((value) => {
  if (value == null || value === '') return undefined;
  return value;
}, z.coerce.number().min(0).max(100).optional());

export const updateCollectingSettingsSchema = z.object({
  bankTaxPercent,
  bankTaxRate: z.coerce.number().min(0).max(1).optional(),
  isBankTransferEnabled: booleanishOptional,
  bankAccountHolder: nullableText(150),
  bankName: nullableText(150),
  bankAccountType: nullableText(80),
  bankAccountNumber: nullableText(120),
  bankBranch: nullableText(80),
  bankCurrency: nullableText(20),
  bankAlias: nullableText(120),
  bankDocument: nullableText(80),
  bankInstructions: nullableLongText,
  isMercadoPagoEnabled: booleanishOptional,
  mercadoPagoEnvironment: z.enum(['test', 'production']).optional(),
  mercadoPagoPublicKey: nullableText(255),
  mercadoPagoAccessToken: nullableText(500),
  mercadoPagoUserId: nullableText(120),
  mercadoPagoCheckoutUrl: nullableText(500),
  mercadoPagoNotificationUrl: nullableText(500),
  mercadoPagoWebhookSecret: nullableText(500),
  mercadoPagoPreferenceNote: nullableLongText,
  mercadoPagoInstructions: nullableLongText,
});
