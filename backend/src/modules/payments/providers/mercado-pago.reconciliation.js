function clean(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeOrderId(value) {
  const numeric = Number(value);

  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : null;
}

function normalizeOrderNumber(value) {
  return clean(value).slice(0, 150);
}

function normalizeMoney(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Number(numeric.toFixed(2));
}

export function getMercadoPagoOrderIdentity(payment = {}) {
  const metadata =
    payment.metadata
    && typeof payment.metadata === "object"
      ? payment.metadata
      : {};

  const orderId =
    normalizeOrderId(
      metadata.order_id
      ?? metadata.orderId,
    );

  const metadataOrderNumber =
    normalizeOrderNumber(
      metadata.order_number
      ?? metadata.orderNumber,
    );

  const externalReference =
    normalizeOrderNumber(
      payment.external_reference,
    );

  const complete =
    Boolean(
      orderId
      && metadataOrderNumber
      && externalReference,
    );

  const referencesMatch =
    complete
    && metadataOrderNumber === externalReference;

  return {
    orderId,
    metadataOrderNumber,
    externalReference,
    complete,
    referencesMatch,
  };
}

export function getMercadoPagoTransactionAmount(
  payment = {},
) {
  return normalizeMoney(
    payment.transaction_amount,
  );
}

export function getMercadoPagoCurrencyCode(
  payment = {},
) {
  const value =
    clean(payment.currency_id).toUpperCase();

  return /^[A-Z]{3}$/.test(value)
    ? value
    : "XXX";
}

export function evaluateMercadoPagoReconciliation(
  payment,
  order,
) {
  const identity =
    getMercadoPagoOrderIdentity(payment);

  const amount =
    getMercadoPagoTransactionAmount(payment);

  const currencyCode =
    getMercadoPagoCurrencyCode(payment);

  const orderId =
    normalizeOrderId(order?.id);

  const orderNumber =
    normalizeOrderNumber(
      order?.orderNumber,
    );

  const identityMatches =
    identity.complete
    && identity.referencesMatch
    && identity.orderId === orderId
    && identity.metadataOrderNumber === orderNumber
    && identity.externalReference === orderNumber;

  const expectedAmount =
    normalizeMoney(order?.total);

  const amountMatches =
    amount > 0
    && expectedAmount > 0
    && amount === expectedAmount;

  const currencyMatches =
    currencyCode === "UYU";

  return {
    identity,
    identityMatches,
    amount,
    expectedAmount,
    amountMatches,
    currencyCode,
    currencyMatches,
    automaticApprovalAllowed:
      identityMatches
      && amountMatches
      && currencyMatches,
  };
}
