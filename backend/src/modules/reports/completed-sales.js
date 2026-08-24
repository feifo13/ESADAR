export const CANONICAL_COMPLETED_SALE_STATUSES = Object.freeze(['APPROVED', 'SHIPPED']);
export const CANONICAL_SALE_DATE_FIELD = 'approved_at';

export function isCanonicalCompletedSaleStatus(status) {
  return CANONICAL_COMPLETED_SALE_STATUSES.includes(String(status || '').toUpperCase());
}

export function getCanonicalCompletedSaleStatusParameters() {
  return [...CANONICAL_COMPLETED_SALE_STATUSES];
}
