import { z } from 'zod';

export const inventoryAdjustmentSchema = z.object({
  quantityTotal: z.coerce.number().int().min(0).optional(),
  quantityAvailable: z.coerce.number().int().min(0).optional(),
  quantityReserved: z.coerce.number().int().min(0).optional(),
  quantitySold: z.coerce.number().int().min(0).optional(),
  quantityLost: z.coerce.number().int().min(0).optional(),
  reason: z.string().trim().min(2).max(255),
}).refine(
  (value) =>
    value.quantityTotal !== undefined ||
    value.quantityAvailable !== undefined ||
    value.quantityReserved !== undefined ||
    value.quantitySold !== undefined ||
    value.quantityLost !== undefined,
  { message: 'Debes enviar al menos una cantidad para ajustar.' },
);
