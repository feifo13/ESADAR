export function formatCurrencyUYU(value, currencyCode = "UYU") {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: currencyCode || "UYU",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `$ ${Number.isFinite(amount) ? amount.toLocaleString("es-UY") : "0"}`;
  }
}

export function formatDateTimeEsUy(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function buildCustomerName(customerOrUser) {
  const firstName = customerOrUser?.firstName || customerOrUser?.first_name || "";
  const lastName = customerOrUser?.lastName || customerOrUser?.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return fullName || customerOrUser?.name || customerOrUser?.email || "cliente";
}
