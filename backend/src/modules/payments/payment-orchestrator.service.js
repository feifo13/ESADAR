import { pool } from "../../db/pool.js";
import { badRequest } from "../../utils/app-error.js";
import { getCollectingSettings } from "../collecting/collecting.service.js";
import { getPaymentMethodLabel } from "../payment-methods.js";
import { getPaymentProvider } from "./payment-provider.registry.js";

function buildUnavailablePaymentInstructions(
  paymentMethod,
  failureReason,
  retryable = true,
) {
  const method = String(paymentMethod || "").trim();

  return {
    method,
    label: getPaymentMethodLabel(method),
    title: "Datos de pago",
    enabled: false,
    status: "TEMPORARILY_UNAVAILABLE",
    fields: [],
    instructions:
      "No pudimos preparar este medio de pago en este momento. Tu orden fue creada correctamente.",
    checkoutUrl: null,
    qrCodeUrl: null,
    retryable,
    failureReason,
  };
}

function normalizePreparedPaymentInstructions(
  provider,
  order,
  prepared,
) {
  const method = String(
    provider?.id ||
    order?.paymentMethod ||
    "",
  ).trim();

  const enabled = Boolean(prepared?.enabled);

  return {
    ...(prepared || {}),
    method,
    label:
      prepared?.label ||
      getPaymentMethodLabel(method),
    title:
      prepared?.title ||
      "Datos de pago",
    enabled,
    status:
      prepared?.status ||
      (enabled
        ? "READY"
        : "TEMPORARILY_UNAVAILABLE"),
    fields:
      Array.isArray(prepared?.fields)
        ? prepared.fields
        : [],
    instructions:
      prepared?.instructions || null,
    checkoutUrl:
      prepared?.checkoutUrl || null,
    qrCodeUrl:
      prepared?.qrCodeUrl || null,
    retryable:
      prepared?.retryable == null
        ? !enabled
        : Boolean(prepared.retryable),
  };
}

export function evaluatePaymentProviderAvailability(
  provider,
  settings = {},
) {
  if (
    !provider ||
    typeof provider.isAvailable !== "function"
  ) {
    return false;
  }

  try {
    return Boolean(
      provider.isAvailable(settings),
    );
  } catch (error) {
    console.error(
      "[payments] provider availability check failed",
      {
        paymentMethod: provider.id || null,
        errorName: error?.name || "Error",
      },
    );

    return false;
  }
}

export function isPaymentMethodAvailable(
  paymentMethod,
  settings = {},
) {
  const provider =
    getPaymentProvider(paymentMethod);

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
    isPaymentMethodAvailable(
      method?.id,
      settings,
    ),
  );
}

export async function listAvailablePaymentMethods(
  methods = [],
  connection = pool,
) {
  const settings =
    await getCollectingSettings(connection);

  return filterAvailablePaymentMethods(
    methods,
    settings,
  );
}

export async function assertPaymentMethodAvailable(
  paymentMethod,
  connection = pool,
) {
  const settings =
    await getCollectingSettings(connection);

  if (
    isPaymentMethodAvailable(
      paymentMethod,
      settings,
    )
  ) {
    return;
  }

  throw badRequest(
    "El medio de pago seleccionado no está disponible. Actualizá el checkout e intentalo nuevamente.",
  );
}

export async function preparePaymentWithProvider(
  provider,
  order,
  connection = pool,
  options = {},
) {
  const paymentMethod =
    provider?.id ||
    order?.paymentMethod ||
    "";

  if (
    !provider ||
    typeof provider.prepare !== "function"
  ) {
    return buildUnavailablePaymentInstructions(
      paymentMethod,
      "payment_provider_prepare_not_supported",
      false,
    );
  }

  try {
    const prepared =
      await provider.prepare(
        order,
        connection,
        options,
      );

    return normalizePreparedPaymentInstructions(
      provider,
      order,
      prepared,
    );
  } catch (error) {
    console.error(
      "[payments] provider preparation failed",
      {
        paymentMethod:
          provider.id ||
          paymentMethod ||
          null,
        errorName:
          error?.name || "Error",
      },
    );

    return buildUnavailablePaymentInstructions(
      paymentMethod,
      "payment_provider_prepare_failed",
      true,
    );
  }
}

export async function prepareOrderPayment(
  order,
  connection = pool,
  options = {},
) {
  const paymentMethod = String(
    order?.paymentMethod || "",
  ).trim();

  const provider =
    getPaymentProvider(paymentMethod);

  return preparePaymentWithProvider(
    provider,
    order,
    connection,
    options,
  );
}
