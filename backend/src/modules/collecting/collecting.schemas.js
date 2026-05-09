import { z } from 'zod';

function emptyToNull(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

const nullableText = (max = 255) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const nullableLongText = z.preprocess(
  emptyToNull,
  z.string().trim().max(3000).nullable().optional(),
);

const booleanishDefault = (defaultValue = false) =>
  z.preprocess((value) => {
    if (value == null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return value;
  }, z.boolean().default(defaultValue));

export const updateCollectingSettingsSchema = z.object({
  isBankTransferEnabled: booleanishDefault(true),
  bankAccountHolder: nullableText(150),
  bankName: nullableText(150),
  bankAccountType: nullableText(80),
  bankAccountNumber: nullableText(120),
  bankBranch: nullableText(80),
  bankCurrency: nullableText(20),
  bankAlias: nullableText(120),
  bankDocument: nullableText(80),
  bankInstructions: nullableLongText,
  isMercadoPagoEnabled: booleanishDefault(true),
  mercadoPagoEnvironment: z.enum(['test', 'production']).default('test'),
  mercadoPagoPublicKey: nullableText(255),
  mercadoPagoAccessToken: nullableText(500),
  mercadoPagoUserId: nullableText(120),
  mercadoPagoCheckoutUrl: nullableText(500),
  mercadoPagoNotificationUrl: nullableText(500),
  mercadoPagoWebhookSecret: nullableText(500),
  mercadoPagoPreferenceNote: nullableLongText,
  mercadoPagoInstructions: nullableLongText,
});
