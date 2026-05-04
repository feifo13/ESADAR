import InnerImageZoom from 'react-inner-image-zoom';
import 'react-inner-image-zoom/lib/styles.min.css';
import SmartImage from './SmartImage.jsx';
import { resolveAssetUrl } from '../lib/api.js';

export default function ArticleImageZoom({ image, title }) {
  const src = image?.src || image?.zoomSrc || image?.thumbSrc || '';
  const zoomSrc = image?.zoomSrc || image?.src || image?.thumbSrc || src;
  const resolvedSrc = resolveAssetUrl(src);
  const resolvedZoomSrc = resolveAssetUrl(zoomSrc || src);
  const alt = image?.altText || title || 'Imagen de articulo';

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
        zoomSrc={resolvedZoomSrc || resolvedSrc}
        sources={image?.sources || []}
        zoomType="hover"
        zoomScale={2.8}
        zoomPreload={true}
        fullscreenOnMobile={true}
        hideHint={true}
        fadeDuration={0}
        className="article-inner-image-zoom"
        imgAttributes={{
          alt,
          className: 'article-image-zoom__image',
          loading: 'eager',
          fetchPriority: 'high',
        }}
      />
    </div>
  );
}
