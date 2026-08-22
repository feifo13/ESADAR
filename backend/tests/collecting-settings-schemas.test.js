import test from 'node:test';
import assert from 'node:assert/strict';
import { updateCollectingSettingsSchema } from '../src/modules/collecting/collecting.schemas.js';

test('collecting settings schema preserves bank tax rate when omitted', () => {
  const parsed = updateCollectingSettingsSchema.parse({});

  assert.equal(parsed.bankTaxPercent, undefined);
  assert.equal(parsed.bankTaxRate, undefined);
});

test('collecting settings schema accepts bank tax percent in UI units', () => {
  const parsed = updateCollectingSettingsSchema.parse({
    bankTaxPercent: '3',
  });

  assert.equal(parsed.bankTaxPercent, 3);
});


test('collecting partial schema does not inject enablement defaults', () => {
  const parsed =
    updateCollectingSettingsSchema.parse({});

  assert.equal(
    parsed.isBankTransferEnabled,
    undefined,
  );

  assert.equal(
    parsed.isMercadoPagoEnabled,
    undefined,
  );

  assert.equal(
    parsed.mercadoPagoEnvironment,
    undefined,
  );

  assert.equal(
    parsed.bankAccountHolder,
    undefined,
  );
});

test('collecting schema keeps explicit blank text as a clear request', () => {
  const parsed =
    updateCollectingSettingsSchema.parse({
      mercadoPagoNotificationUrl: '',
    });

  assert.equal(
    parsed.mercadoPagoNotificationUrl,
    null,
  );
});

test('collecting schema accepts explicit booleanish Mercado Pago values', () => {
  const enabled =
    updateCollectingSettingsSchema.parse({
      isMercadoPagoEnabled: 'true',
    });

  const disabled =
    updateCollectingSettingsSchema.parse({
      isMercadoPagoEnabled: 'false',
    });

  assert.equal(
    enabled.isMercadoPagoEnabled,
    true,
  );

  assert.equal(
    disabled.isMercadoPagoEnabled,
    false,
  );
});
