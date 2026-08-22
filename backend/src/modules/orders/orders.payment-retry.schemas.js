import { z } from "zod";

export const retryOrderPaymentSchema =
  z
    .object({
      retryToken:
        z
          .string()
          .trim()
          .regex(
            /^[a-f0-9]{64}$/i,
            "Token de reintento inválido.",
          ),
    })
    .strict();
