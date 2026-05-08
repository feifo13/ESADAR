import { env } from "../../config/env.js";
import { toAbsoluteSiteUrl, joinPublicSiteUrl } from "../../utils/assets.js";

export function absoluteEmailUrl(pathname) {
  if (!pathname) return "";
  return toAbsoluteSiteUrl(pathname);
}

export function getEmailLogoUrl() {
  const configuredLogo = process.env.EMAIL_LOGO_URL || process.env.PUBLIC_LOGO_URL;
  if (configuredLogo) return absoluteEmailUrl(configuredLogo);

  return joinPublicSiteUrl("/assets/esadar-logo.png") || `${env.publicSiteUrl}/assets/esadar-logo.png`;
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
