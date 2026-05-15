import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { normalizePublicAssetPath, sanitizePublicUrl } from "../../utils/assets.js";
import { resolveMailSiteUrl } from "./mail.url-context.js";

function getAssetBaseUrl(options = {}) {
  return resolveMailSiteUrl(options.publicSiteUrl, options.siteBaseUrl, options.origin, options.baseUrl);
}

export function absoluteEmailUrl(pathname, options = {}) {
  if (!pathname) return "";
  const raw = String(pathname || "").trim();
  if (/^https?:/i.test(raw)) return sanitizePublicUrl(raw);
  const normalized = normalizePublicAssetPath(raw);
  if (!normalized) return "";
  return `${getAssetBaseUrl(options)}${normalized}`;
}

export function getEmailLogoUrl(options = {}) {
  const configuredLogo =
    process.env.EMAIL_LOGO_URL || process.env.PUBLIC_LOGO_URL;
  if (configuredLogo) return absoluteEmailUrl(configuredLogo, options);

  const baseUrl = getAssetBaseUrl(options) || sanitizePublicUrl(env.publicSiteUrl);
  return baseUrl ? `${baseUrl}/assets/esadar-logo.png` : "/assets/esadar-logo.png";
}

export function getArticleEmailImageUrl(articleOrImageOrPath, options = {}) {
  const fallbackUrl = absoluteEmailUrl("/assets/article-image-fallback.png", options);
  if (!articleOrImageOrPath) return fallbackUrl;
  if (typeof articleOrImageOrPath === "string") {
    return absoluteEmailUrl(articleOrImageOrPath, options) || fallbackUrl;
  }

  const candidate =
    articleOrImageOrPath.thumbFilePath ||
    articleOrImageOrPath.thumb_file_path ||
    articleOrImageOrPath.cardFilePath ||
    articleOrImageOrPath.card_file_path ||
    articleOrImageOrPath.detailFilePath ||
    articleOrImageOrPath.detail_file_path ||
    articleOrImageOrPath.filePath ||
    articleOrImageOrPath.file_path ||
    articleOrImageOrPath.image ||
    articleOrImageOrPath.imageSnapshot ||
    articleOrImageOrPath.previewImage ||
    "";

  return candidate ? absoluteEmailUrl(candidate, options) || fallbackUrl : fallbackUrl;
}

export function getEmailBrandGradientUrl(options = {}) {
  const configuredGradient =
    process.env.EMAIL_BRAND_GRADIENT_URL ||
    process.env.PUBLIC_BRAND_GRADIENT_URL;

  if (configuredGradient) return absoluteEmailUrl(configuredGradient, options);

  const baseUrl = getAssetBaseUrl(options) || sanitizePublicUrl(env.publicSiteUrl);
  return baseUrl ? `${baseUrl}/assets/email-brand-gradient.png` : "/assets/email-brand-gradient.png";
}


const EMAIL_LOGO_CID = "esadar-email-logo";
const EMAIL_BRAND_GRADIENT_CID = "esadar-email-brand-gradient";

function resolvePublicAssetFile(filename) {
  const candidates = [
    path.resolve(process.cwd(), "public", "assets", filename),
    path.resolve(process.cwd(), "backend", "public", "assets", filename),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function shouldEmbedEmailAssets() {
  return String(process.env.EMAIL_ASSETS_MODE || "cid").toLowerCase() !== "external";
}

export function getEmailLogoSrc(options = {}) {
  const logoPath = resolvePublicAssetFile("esadar-logo.png");
  if (shouldEmbedEmailAssets() && logoPath) return `cid:${EMAIL_LOGO_CID}`;
  return getEmailLogoUrl(options);
}

export function getEmailBrandGradientSrc(options = {}) {
  const gradientPath = resolvePublicAssetFile("email-brand-gradient.png");
  if (shouldEmbedEmailAssets() && gradientPath) {
    return `cid:${EMAIL_BRAND_GRADIENT_CID}`;
  }
  return getEmailBrandGradientUrl(options);
}

export function getDefaultEmailAttachments() {
  if (!shouldEmbedEmailAssets()) return [];

  const attachments = [];
  const logoPath = resolvePublicAssetFile("esadar-logo.png");
  const gradientPath = resolvePublicAssetFile("email-brand-gradient.png");

  if (logoPath) {
    attachments.push({
      filename: "esadar-logo.png",
      path: logoPath,
      cid: EMAIL_LOGO_CID,
      contentType: "image/png",
      contentDisposition: "inline",
    });
  }

  if (gradientPath) {
    attachments.push({
      filename: "email-brand-gradient.png",
      path: gradientPath,
      cid: EMAIL_BRAND_GRADIENT_CID,
      contentType: "image/png",
      contentDisposition: "inline",
    });
  }

  return attachments;
}
