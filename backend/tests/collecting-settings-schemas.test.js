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
