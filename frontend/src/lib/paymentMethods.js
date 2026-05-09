export const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: 'Transferencia bancaria',
  MERCADO_PAGO: 'Mercado Pago',
};

export function formatPaymentMethod(value, fallback = '-') {
  if (!value) return fallback;
  return PAYMENT_METHOD_LABELS[value] || String(value);
}
