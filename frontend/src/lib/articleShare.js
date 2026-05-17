import { formatCurrency } from "./format.js";

export const ARTICLE_SHARE_TITLE = "ESADAR | Tienda de ropa";
export const ARTICLE_OFFER_SHARE_LINE = "ESADAR acepta ofertas sobre este artículo!";
export const SOCIAL_SHARE_IMAGE_PATH = "/social-share-isotipo.png";

// Instagram/Facebook share targets can reject arbitrary text from the Web Share API.
// We copy the full message to clipboard and share only the URL, so the target app
// receives a clean link while the user can paste the curated copy when needed.

function normalizeSharePart(value, fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
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
