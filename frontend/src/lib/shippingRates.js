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
    minWeightKg: Number(rate.minWeightKg ?? 0),
    maxWeightKg: Number(rate.maxWeightKg ?? 0),
    price: Number(rate.price ?? 0),
    label: rate.label || '',
    sortOrder: Number(rate.sortOrder ?? 0),
    isActive: Boolean(rate.isActive ?? true),
  };
}

export function findShippingWeightRate(rates = [], packageWeightKg = 0) {
  const weight = Number(packageWeightKg || 0);
  return rates
    .map(normalizeRate)
    .filter((rate) => rate.isActive && rate.maxWeightKg > rate.minWeightKg)
    .sort((a, b) => a.maxWeightKg - b.maxWeightKg || a.minWeightKg - b.minWeightKg || a.sortOrder - b.sortOrder)
    .find((rate) => {
      const aboveMin = rate.minWeightKg <= 0 ? weight >= rate.minWeightKg : weight > rate.minWeightKg;
      return aboveMin && weight <= rate.maxWeightKg;
    }) || null;
}

export function calculateShippingCost(method = {}, packageWeightKg = 0) {
  if (!usesWeightRanges(method.pricingType)) {
    return {
      cost: Number(method.baseCost ?? method.cost ?? 0),
      rate: null,
      isUnavailable: false,
    };
  }

  const rate = findShippingWeightRate(method.rates || method.weightRates || [], packageWeightKg);
  return {
    cost: rate ? Number(rate.price || 0) : 0,
    rate,
    isUnavailable: !rate,
  };
}

export function formatWeightKg(weightKg) {
  const weight = Number(weightKg || 0);
  if (weight <= 0) return '0 kg';
  if (weight < 1) return `${Math.round(weight * 1000)} g`;
  const decimals = weight >= 10 ? 1 : 2;
  return `${weight
    .toFixed(decimals)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '')} kg`;
}
