import { formatCurrency } from "./format.js";

export const ARTICLE_SHARE_TITLE = "ESADAR | Tienda de ropa";
export const ARTICLE_OFFER_SHARE_LINE = "ESADAR acepta ofertas sobre este artículo!";

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
export function buildArticleWebShareData(article, finalPrice, canonicalUrl) {
  const description = buildArticleShareDescription(article, finalPrice);

  return {
    title: ARTICLE_SHARE_TITLE,
    text: description,
    url: canonicalUrl,
  };
}

