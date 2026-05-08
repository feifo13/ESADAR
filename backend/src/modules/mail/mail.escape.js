export function maybe(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

export function escapeHtml(value) {
  return String(maybe(value, ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function safeText(value) {
  return escapeHtml(value);
}

export function nl2br(value) {
  return safeText(value).replace(/\r\n|\r|\n/g, "<br />");
}
