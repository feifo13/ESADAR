export const SHIPPING_PRICING_TYPES = {
  FIXED: 'FIXED',
  AHIVA_CORREO_NACIONAL: 'AHIVA_CORREO_NACIONAL',
  WEIGHT_RANGES: 'WEIGHT_RANGES',
};

export function usesWeightRanges(pricingType) {
  return [
    SHIPPING_PRICING_TYPES.AHIVA_CORREO_NACIONAL,
    SHIPPING_PRICING_TYPES.WEIGHT_RANGES,
  ].includes(pricingType);
}

function normalizeRate(rate = {}) {
  return {
    id: rate.id ?? null,
    minWeightKg: Number(rate.minWeightKg ?? rate.min_weight_kg ?? 0),
    maxWeightKg: Number(rate.maxWeightKg ?? rate.max_weight_kg ?? 0),
    price: Number(rate.price ?? 0),
    label: rate.label || '',
    sortOrder: Number(rate.sortOrder ?? rate.sort_order ?? 0),
    isActive: Boolean(rate.isActive ?? rate.is_active ?? true),
  };
}

export function findShippingWeightRate(rates = [], packageWeightKg = 0) {
  const weight = Number(packageWeightKg || 0);
  const sortedRates = rates
    .map(normalizeRate)
    .filter((rate) => rate.isActive && rate.maxWeightKg > rate.minWeightKg)
    .sort((a, b) => a.maxWeightKg - b.maxWeightKg || a.minWeightKg - b.minWeightKg || a.sortOrder - b.sortOrder);

  return sortedRates.find((rate) => {
    const aboveMin = rate.minWeightKg <= 0 ? weight >= rate.minWeightKg : weight > rate.minWeightKg;
    return aboveMin && weight <= rate.maxWeightKg;
  }) || null;
}

export function calculateShippingCost(method = {}, packageWeightKg = 0) {
  if (!usesWeightRanges(method.pricingType)) {
    return {
      cost: Number(method.baseCost || 0),
      rate: null,
      pricingType: method.pricingType || SHIPPING_PRICING_TYPES.FIXED,
    };
  }

  const rate = findShippingWeightRate(method.rates || method.weightRates || [], packageWeightKg);
  if (!rate) {
    return {
      cost: null,
      rate: null,
      pricingType: method.pricingType,
    };
  }

  return {
    cost: Number(rate.price || 0),
    rate,
    pricingType: method.pricingType,
  };
}
