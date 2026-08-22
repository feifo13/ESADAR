import { pool } from "../../db/pool.js";
import { badRequest } from "../../utils/app-error.js";
import { getCollectingSettings } from "../collecting/collecting.service.js";
import { getPaymentProvider } from "./payment-provider.registry.js";

export function evaluatePaymentProviderAvailability(
  provider,
  settings = {},
) {
  if (!provider || typeof provider.isAvailable !== "function") {
    return false;
  }

  try {
    return Boolean(provider.isAvailable(settings));
  } catch (error) {
    console.error("[payments] provider availability check failed", {
      paymentMethod: provider.id || null,
      message: error?.message || String(error),
    });

    return false;
  }
}

export function isPaymentMethodAvailable(
  paymentMethod,
  settings = {},
) {
  const provider = getPaymentProvider(paymentMethod);

  return evaluatePaymentProviderAvailability(
    provider,
    settings,
  );
}

export function filterAvailablePaymentMethods(
  methods = [],
  settings = {},
) {
  return methods.filter((method) =>
    isPaymentMethodAvailable(method?.id, settings),
  );
}

export async function listAvailablePaymentMethods(
  methods = [],
  connection = pool,
) {
  const settings = await getCollectingSettings(connection);

  return filterAvailablePaymentMethods(
    methods,
    settings,
  );
}

export async function assertPaymentMethodAvailable(
  paymentMethod,
  connection = pool,
) {
  const settings = await getCollectingSettings(connection);

  if (isPaymentMethodAvailable(paymentMethod, settings)) {
    return;
  }

  throw badRequest(
    "El medio de pago seleccionado no está disponible. Actualizá el checkout e intentalo nuevamente.",
  );
}
