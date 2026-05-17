import { formatCurrency } from "./format.js";

export const ARTICLE_SHARE_TITLE = "ESADAR | Tienda de ropa";
export const ARTICLE_OFFER_SHARE_LINE = "ESADAR acepta ofertas sobre este artículo!";
export const SOCIAL_SHARE_IMAGE_PATH = "/social-share-isotipo.png";

// Instagram Direct is not a reliable Web Share target from Chrome/WebView.
// The safe flow copies the full curated message first and only opens the
// native share sheet where it is known to be less problematic.

function normalizeSharePart(value, fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function getNavigatorUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function isAndroidChromeBrowser() {
  const ua = getNavigatorUserAgent();
  return (
    /Android/i.test(ua) &&
    /(Chrome|CriOS)\//i.test(ua) &&
    !/(Edg|EdgA|OPR|Opera|SamsungBrowser|Firefox|FxiOS)\//i.test(ua)
  );
}

export function shouldUseNativeArticleShare() {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }

  // Chrome Android is where Instagram Direct commonly rejects URL/text payloads
  // and can leave the tab waiting for a share promise that never settles cleanly.
  // We keep this path copy-only to avoid locking the browser.
  if (isAndroidChromeBrowser()) return false;

  return true;
}

export function formatArticleSharePrice(value) {
  return formatCurrency(value).replace(/\s+/g, " ").trim();
}

export function buildArticleShareSummary(article, finalPrice) {
  const articleName = normalizeSharePart(article?.title, "Prenda ESADAR");
  const sizeLabel = normalizeSharePart(
    article?.sizeText || article?.sizeCode,
    "Talle sin especificar",
  );

  return `${articleName} · ${sizeLabel} · ${formatArticleSharePrice(finalPrice)}`;
}

export function buildArticleShareDescription(article, finalPrice) {
  const summary = buildArticleShareSummary(article, finalPrice);

  if (Boolean(article?.allowOffers)) {
    return `${ARTICLE_OFFER_SHARE_LINE}\n${summary}`;
  }

  return summary;
}

export function buildArticleShareMessage(article, finalPrice, canonicalUrl) {
  return [buildArticleShareDescription(article, finalPrice), canonicalUrl]
    .filter(Boolean)
    .join("\n");
}

export function buildArticleWebShareData(_article, _finalPrice, canonicalUrl) {
  return {
    title: ARTICLE_SHARE_TITLE,
    url: canonicalUrl,
  };
}
