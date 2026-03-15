export const CATEGORY_OPTIONS = [
  { id: 1, label: "Camperas" },
  { id: 2, label: "Buzos" },
  { id: 3, label: "Remeras" },
  { id: 4, label: "Pantalones" },
  { id: 5, label: "Shorts" },
  { id: 6, label: "Accesorios" },
];

export const BRAND_OPTIONS = [
  { id: 1, label: "Nike" },
  { id: 2, label: "Adidas" },
  { id: 3, label: "Champion" },
  { id: 4, label: "Levis" },
  { id: 5, label: "Reebok" },
  { id: 6, label: "Tommy Hilfiger" },
  { id: 7, label: "New Balance" },
  { id: 8, label: "Russell Athletic" },
  { id: 9, label: "Puma" },
];

export const SIZE_OPTIONS = [
  { id: 1, label: "XS" },
  { id: 2, label: "S" },
  { id: 3, label: "M" },
  { id: 4, label: "L" },
  { id: 5, label: "XL" },
  { id: 6, label: "XXL" },
  { id: 7, label: "36" },
  { id: 8, label: "38" },
  { id: 9, label: "40" },
  { id: 10, label: "Único" },
];

export const SHIPPING_METHOD_OPTIONS = [
  // {
  //   id: 1,
  //   label: 'Retiro en punto acordado',
  //   cost: 0,
  //   instructions: 'Coordinamos retiro por mensaje directo dentro de Montevideo.',
  // },
  {
    id: 2,
    label: "Cadetería Montevideo",
    cost: 180,
    instructions:
      "Entregas en 24 a 48 horas dentro de Montevideo luego de aprobada la orden.",
  },
  {
    id: 3,
    label: "DAC interior",
    cost: 260,
    instructions:
      "Despacho al interior dentro de 24 horas hábiles posteriores a la aprobación.",
  },
];

export const PAYMENT_METHOD_OPTIONS = [
  {
    id: "BANK_TRANSFER",
    label: "Transferencia bancaria",
    instructions:
      "Realiza la transferencia con el total indicado. Validamos el pago y aprobamos la orden.",
  },
  {
    id: "MERCADO_PAGO",
    label: "Mercado Pago",
    instructions:
      "En este starter queda preparado el flujo. Luego conectamos el link o checkout real.",
  },
];
