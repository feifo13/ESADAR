export const PAYMENT_METHODS = [
  {
    id: 'BANK_TRANSFER',
    label: 'Transferencia bancaria',
    instructions:
      'Al confirmar la orden, vas a ver los datos para transferir el total. Validaremos el pago antes de aprobar la orden.',
  },
  {
    id: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    instructions:
      'Al confirmar la orden, vas a poder continuar el pago en Mercado Pago. La orden se aprobará cuando recibamos la confirmación del pago.',
  },
];
