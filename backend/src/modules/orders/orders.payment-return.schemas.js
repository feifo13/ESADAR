import { z } from "zod";

export const reconcileReturnedMercadoPagoPaymentSchema =
  z
    .object({
      paymentId:
        z
          .string()
          .trim()
          .regex(
            /^\d{1,40}$/,
            "Identificador de pago inválido.",
          ),
      retryToken:
        z
          .string()
          .trim()
          .regex(
            /^[a-f0-9]{64}$/i,
            "Token de pago inválido.",
          ),
    })
    .strict();
