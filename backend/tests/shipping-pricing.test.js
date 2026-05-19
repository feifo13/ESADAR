import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateShippingCost,
  findShippingWeightRate,
  SHIPPING_PRICING_TYPES,
  usesWeightRanges,
} from '../src/modules/shipping/shipping-pricing.js';

const AHIVA_RATES = [
  { minWeightKg: 0, maxWeightKg: 2, price: 195, label: 'Hasta 2 kg', isActive: true },
  { minWeightKg: 2, maxWeightKg: 5, price: 220, label: 'De 2 a 5 kg', isActive: true },
  { minWeightKg: 5, maxWeightKg: 10, price: 275, label: 'De 5 a 10 kg', isActive: true },
];

test('fixed shipping methods keep using baseCost, including free methods', () => {
  assert.deepEqual(
    calculateShippingCost({
      pricingType: SHIPPING_PRICING_TYPES.FIXED,
      baseCost: 0,
      rates: AHIVA_RATES,
    }, 12),
    {
      cost: 0,
      rate: null,
      pricingType: SHIPPING_PRICING_TYPES.FIXED,
    },
  );

  assert.equal(
    calculateShippingCost({
      pricingType: SHIPPING_PRICING_TYPES.FIXED,
      baseCost: 180,
    }, 1.2).cost,
    180,
  );
});

test('weight range methods use active configured ranges and preserve Ahiva compatibility', () => {
  assert.equal(usesWeightRanges(SHIPPING_PRICING_TYPES.AHIVA_CORREO_NACIONAL), true);
  assert.equal(usesWeightRanges(SHIPPING_PRICING_TYPES.WEIGHT_RANGES), true);

  const exactBoundary = calculateShippingCost({
    pricingType: SHIPPING_PRICING_TYPES.AHIVA_CORREO_NACIONAL,
    baseCost: 999,
    rates: AHIVA_RATES,
  }, 2);

  const nextRange = calculateShippingCost({
    pricingType: SHIPPING_PRICING_TYPES.WEIGHT_RANGES,
    baseCost: 999,
    rates: AHIVA_RATES,
  }, 2.001);

  assert.equal(exactBoundary.cost, 195);
  assert.equal(exactBoundary.rate.label, 'Hasta 2 kg');
  assert.equal(nextRange.cost, 220);
  assert.equal(nextRange.rate.label, 'De 2 a 5 kg');
});

test('weight range methods return no cost when configuration misses the package weight', () => {
  const quote = calculateShippingCost({
    pricingType: SHIPPING_PRICING_TYPES.WEIGHT_RANGES,
    baseCost: 0,
    rates: AHIVA_RATES,
  }, 30.5);

  assert.equal(quote.cost, null);
  assert.equal(quote.rate, null);
});

test('inactive or invalid ranges are ignored when finding a weight rate', () => {
  const rate = findShippingWeightRate([
    { minWeightKg: 0, maxWeightKg: 1, price: 1, isActive: false },
    { minWeightKg: 1, maxWeightKg: 1, price: 2, isActive: true },
    { minWeightKg: 0, maxWeightKg: 3, price: 300, isActive: true },
  ], 0.8);

  assert.equal(rate.price, 300);
});
