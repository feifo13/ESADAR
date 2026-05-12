import InnerImageZoom from "react-inner-image-zoom";
import "react-inner-image-zoom/lib/styles.min.css";
import SmartImage from "./SmartImage.jsx";
import { resolveAssetUrl } from "../lib/api.js";

export default function ArticleImageZoom({ image, title }) {
  const src = image?.src || image?.zoomSrc || image?.thumbSrc || "";
  const zoomSrc = image?.zoomSrc || image?.src || image?.thumbSrc || src;
  const resolvedSrc = resolveAssetUrl(src);
  const resolvedZoomSrc = resolveAssetUrl(zoomSrc || src) || resolvedSrc;
  const alt = image?.altText || title || "Imagen de articulo";

  if (!resolvedSrc) {
    return (
      <div className="article-image-zoom article-image-zoom--fallback">
        <SmartImage
          src={src}
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
        }}
      />
    </div>
  );
}
