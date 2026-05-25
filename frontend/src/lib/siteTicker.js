export const DEFAULT_SITE_TICKER = {
  isEnabled: true,
  text: "ACEPTAMOS OFERTAS EN ARTÍCULOS SELECCIONADOS",
  targetUrl: "/articles",
  targetSection: "",
  backgroundColor: "#ec672b",
  isSticky: false,
};

const TICKER_COLOR_TOKENS = {
  orange: "var(--orange)",
  navy: "var(--navy)",
  aqua: "var(--aqua)",
  surface: "var(--surface)",
  text: "var(--text)",
};

function sanitizeInternalPath(value) {
  const normalized = String(value || "").trim().replace(/\\/g, "/");
  if (!normalized) return DEFAULT_SITE_TICKER.targetUrl;
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return DEFAULT_SITE_TICKER.targetUrl;
  }
  if (/[\u0000-\u001f]/.test(normalized) || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return DEFAULT_SITE_TICKER.targetUrl;
  }
  return normalized;
}

function normalizeTickerSection(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  return /^[a-z0-9_-]{1,80}$/.test(normalized) ? normalized : "";
}

function mergeTickerQuery(targetUrl, entries) {
  const [pathAndSearch, hash = ""] = targetUrl.split("#");
  const [pathname, search = ""] = pathAndSearch.split("?");
  const params = new URLSearchParams(search);

  Object.entries(entries).forEach(([key, value]) => {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  });

  const nextSearch = params.toString();
  const nextHash = hash ? `#${hash}` : "";
  return `${pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash}`;
}

export function buildTickerTargetUrl(ticker = DEFAULT_SITE_TICKER) {
  const targetUrl = sanitizeInternalPath(ticker.targetUrl);
  const targetSection = normalizeTickerSection(ticker.targetSection);

  switch (targetSection) {
    case "":
      return targetUrl;
    case "catalog":
      return mergeTickerQuery(targetUrl, { section: "catalog" });
    case "offers":
      return mergeTickerQuery(targetUrl, { offerable: "true" });
    case "featured":
      return mergeTickerQuery(targetUrl, { featured: "true" });
    case "latest":
      return mergeTickerQuery(targetUrl, { sort: "intake_desc" });
    default:
      return mergeTickerQuery(targetUrl, { section: targetSection });
  }
}

export function resolveTickerBackgroundColor(value) {
  const normalized = String(value || "").trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) return normalized;
  return TICKER_COLOR_TOKENS[normalized.toLowerCase()] || DEFAULT_SITE_TICKER.backgroundColor;
}

function normalizeTickerBackgroundValue(value) {
  const normalized = String(value || "").trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) return normalized;
  return TICKER_COLOR_TOKENS[normalized.toLowerCase()]
    ? normalized.toLowerCase()
    : DEFAULT_SITE_TICKER.backgroundColor;
}

export function normalizeTickerMessages(value, fallbackText = "") {
  const source = Array.isArray(value) ? value : [];
  const messages = source
    .map((message) => String(message || "").trim())
    .filter(Boolean)
    .map((message) => message.slice(0, 180));

  if (messages.length) return messages.slice(0, 12);

  const legacyText = String(fallbackText || "").trim();
  return legacyText ? [legacyText.slice(0, 180)] : [];
}

export function normalizeSiteTicker(rawTicker) {
  const source = rawTicker && typeof rawTicker === "object" ? rawTicker : {};
  const hasSource = Boolean(rawTicker && typeof rawTicker === "object");
  const fallbackText = hasSource
    ? String(source.text ?? "").trim()
    : DEFAULT_SITE_TICKER.text;
  const rawMessages = Array.isArray(source.messages) && source.messages.length
    ? source.messages
    : source.tickerMessages || source.messages;
  const messages = normalizeTickerMessages(rawMessages, fallbackText);
  const text = messages[0] || fallbackText;

  return {
    isEnabled: source.isEnabled == null ? DEFAULT_SITE_TICKER.isEnabled : Boolean(source.isEnabled),
    text,
    messages,
    tickerMessages: messages,
    targetUrl: sanitizeInternalPath(source.targetUrl),
    targetSection: normalizeTickerSection(source.targetSection),
    backgroundColor: normalizeTickerBackgroundValue(source.backgroundColor),
    isSticky: source.isSticky == null ? DEFAULT_SITE_TICKER.isSticky : Boolean(source.isSticky),
  };
}
