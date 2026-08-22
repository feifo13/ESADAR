import { bankTransferProvider } from "./providers/bank-transfer.provider.js";
import { mercadoPagoProvider } from "./providers/mercado-pago.provider.js";

const providerList = Object.freeze([
  bankTransferProvider,
  mercadoPagoProvider,
]);

const providerRegistry = new Map(
  providerList.map((provider) => [provider.id, provider]),
);

if (providerRegistry.size !== providerList.length) {
  throw new Error("Duplicate payment provider id.");
}

export function getPaymentProvider(paymentMethod) {
  const key = String(paymentMethod || "").trim();
  if (!key) return null;

  return providerRegistry.get(key) || null;
}

export function listPaymentProviders() {
  return [...providerList];
}
