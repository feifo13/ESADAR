import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { toAbsoluteSiteUrl, joinPublicSiteUrl } from "../../utils/assets.js";

export function absoluteEmailUrl(pathname) {
  if (!pathname) return "";
  return toAbsoluteSiteUrl(pathname);
}

export function getEmailLogoUrl() {
  const configuredLogo =
    process.env.EMAIL_LOGO_URL || process.env.PUBLIC_LOGO_URL;
  if (configuredLogo) return absoluteEmailUrl(configuredLogo);

  return (
    joinPublicSiteUrl("/assets/esadar-logo.png") ||
    `${env.publicSiteUrl}/assets/esadar-logo.png`
  );
}

export function getArticleEmailImageUrl(articleOrImageOrPath) {
  if (!articleOrImageOrPath) return "";
  if (typeof articleOrImageOrPath === "string") {
    return absoluteEmailUrl(articleOrImageOrPath);
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

  return candidate ? absoluteEmailUrl(candidate) : "";
}

export function getEmailBrandGradientUrl() {
  const configuredGradient =
    process.env.EMAIL_BRAND_GRADIENT_URL ||
    process.env.PUBLIC_BRAND_GRADIENT_URL;

  if (configuredGradient) return absoluteEmailUrl(configuredGradient);

  return (
    joinPublicSiteUrl("/assets/email-brand-gradient.png") ||
    `${env.publicSiteUrl}/assets/email-brand-gradient.png`
  );
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

export function getEmailLogoSrc() {
  const logoPath = resolvePublicAssetFile("esadar-logo.png");
  if (shouldEmbedEmailAssets() && logoPath) return `cid:${EMAIL_LOGO_CID}`;
  return getEmailLogoUrl();
}

export function getEmailBrandGradientSrc() {
  const gradientPath = resolvePublicAssetFile("email-brand-gradient.png");
  if (shouldEmbedEmailAssets() && gradientPath) {
    return `cid:${EMAIL_BRAND_GRADIENT_CID}`;
  }
  return getEmailBrandGradientUrl();
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
