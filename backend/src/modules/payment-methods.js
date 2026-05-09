export const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: 'Transferencia bancaria',
  MERCADO_PAGO: 'Mercado Pago',
};

export function getPaymentMethodLabel(paymentMethod) {
  if (!paymentMethod) return '';
  return PAYMENT_METHOD_LABELS[paymentMethod] || String(paymentMethod);
}
