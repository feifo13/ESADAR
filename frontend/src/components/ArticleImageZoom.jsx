import InnerImageZoom from "react-inner-image-zoom";
import "react-inner-image-zoom/lib/styles.min.css";
import SmartImage from "./SmartImage.jsx";
import { resolveAssetUrl } from "../lib/api.js";
import { getArticleImageSizes } from "../lib/article-images.js";

function resolveSrcSet(value) {
  if (!value) return "";
  return String(value)
    .split(",")
    .map((entry) => {
      const [src, descriptor] = entry.trim().split(/\s+/, 2);
      return `${resolveAssetUrl(src)}${descriptor ? ` ${descriptor}` : ""}`;
    })
    .join(", ");
}

export default function ArticleImageZoom({ image, title }) {
  const baseSrc = image?.src || image?.zoomSrc || image?.thumbSrc || "";
  const zoomSrc = image?.zoomSrc || image?.src || image?.thumbSrc || baseSrc;
  const displaySrc = baseSrc || zoomSrc;
  const resolvedSrc = resolveAssetUrl(displaySrc);
  const resolvedZoomSrc = resolveAssetUrl(zoomSrc || displaySrc) || resolvedSrc;
  const resolvedSrcSet = resolveSrcSet(image?.srcSet);
  const alt = image?.altText || title || "Imagen de articulo";

  if (!resolvedSrc) {
    return (
      <div className="article-image-zoom article-image-zoom--fallback">
        <SmartImage
          src={displaySrc}
          alt={alt}
          fallbackLabel={title}
          className="article-image-zoom__fallback-image"
          loading="eager"
          fetchPriority="high"
        />
      </div>
    );
  }

  return (
    <div className="article-image-zoom" aria-label="Imagen principal con zoom">
      <InnerImageZoom
        src={resolvedSrc}
        zoomSrc={resolvedZoomSrc}
        zoomType="hover"
        moveType="pan"
        zoomScale={1.65}
        zoomPreload={false}
        fullscreenOnMobile={true}
        mobileBreakpoint={960}
        hideHint={true}
        imgAttributes={{
          alt,
          className: "article-image-zoom__image",
          loading: "eager",
          fetchPriority: "high",
          srcSet: resolvedSrcSet || undefined,
          sizes: getArticleImageSizes("detail"),
        }}
      />
    </div>
  );
}
