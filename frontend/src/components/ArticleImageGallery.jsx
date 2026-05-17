import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArticleImageZoom from './ArticleImageZoom.jsx';
import PreviousNextControls from './PreviousNextControls.jsx';
import SmartImage from './SmartImage.jsx';
import { getArticleImageSizes } from '../lib/article-images.js';


function GalleryArrowIcon({ direction }) {
  const path = direction === 'previous' ? 'M15 5 8 12l7 7' : 'M9 5l7 7-7 7';

  return (
    <svg
      className="article-gallery-desktop-arrow-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export default function ArticleImageGallery({ images = [], title, fallbackImage = null }) {
  const normalized = useMemo(() => {
    const fallback = fallbackImage || {};
    const fallbackSrc =
      fallback.detailFilePath ||
      fallback.detail_file_path ||
      fallback.primaryImageDetail ||
      fallback.primaryImage ||
      fallback.filePath ||
      fallback.file_path ||
      fallback.src ||
      fallback.zoomFilePath ||
      fallback.zoom_file_path ||
      fallback.primaryImageZoom ||
      '';
    const fallbackZoomSrc =
      fallback.zoomFilePath ||
      fallback.zoom_file_path ||
      fallback.primaryImageZoom ||
      fallback.imageOriginalUrl ||
      fallback.primaryImageOriginal ||
      fallbackSrc;
    const fallbackThumbSrc =
      fallback.thumbFilePath ||
      fallback.thumb_file_path ||
      fallback.primaryImageThumb ||
      fallback.cardFilePath ||
      fallback.card_file_path ||
      fallbackSrc;

    if (!images.length) {
      return [{
        id: 'fallback',
        src: fallbackSrc,
        zoomSrc: fallbackZoomSrc,
        thumbSrc: fallbackThumbSrc,
        altText: fallback.altText || fallback.primaryImageAlt || title,
        srcSet: [
          fallbackThumbSrc ? `${fallbackThumbSrc} 360w` : null,
          fallbackSrc ? `${fallbackSrc} 1800w` : null,
          fallbackZoomSrc ? `${fallbackZoomSrc} 2600w` : null,
        ].filter(Boolean).join(', '),
        sources: [
          fallbackZoomSrc ? { srcSet: `${fallbackZoomSrc} 2600w`, media: '(min-width: 1280px)' } : null,
          fallbackSrc ? { srcSet: `${fallbackSrc} 1800w`, media: '(min-width: 720px)' } : null,
          fallbackThumbSrc ? { srcSet: `${fallbackThumbSrc} 360w` } : null,
        ].filter(Boolean),
      }];
    }

    return images.map((image, index) => {
      const detailSrc =
        image.detailFilePath ||
        image.detail_file_path ||
        image.filePath ||
        image.file_path ||
        image.src ||
        fallbackSrc;
      const zoomSrc =
        image.zoomFilePath ||
        image.zoom_file_path ||
        image.originalFilePath ||
        image.original_file_path ||
        image.detailFilePath ||
        image.detail_file_path ||
        image.filePath ||
        image.file_path ||
        image.src ||
        fallbackZoomSrc;
      const thumbSrc =
        image.thumbFilePath ||
        image.thumb_file_path ||
        image.cardFilePath ||
        image.card_file_path ||
        image.filePath ||
        image.file_path ||
        image.src ||
        fallbackThumbSrc;

      return {
        id: image.id || index,
        src: detailSrc,
        zoomSrc,
        thumbSrc,
        altText: image.altText || image.alt_text || title,
        srcSet: [
          thumbSrc ? `${thumbSrc} 360w` : null,
          detailSrc ? `${detailSrc} 1800w` : null,
          zoomSrc ? `${zoomSrc} 2600w` : null,
        ].filter(Boolean).join(', '),
        sources: [
          zoomSrc ? { srcSet: `${zoomSrc} 2600w`, media: '(min-width: 1280px)' } : null,
          detailSrc ? { srcSet: `${detailSrc} 1800w`, media: '(min-width: 720px)' } : null,
          thumbSrc ? { srcSet: `${thumbSrc} 360w` } : null,
        ].filter(Boolean),
      };
    });
  }, [fallbackImage, images, title]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const swipeStartRef = useRef(null);
  const active = normalized[activeIndex] || normalized[0];
  const hasMultipleImages = normalized.length > 1;

  const moveImage = useCallback((delta) => {
    if (!normalized.length) return;

    setActiveIndex((current) => (current + delta + normalized.length) % normalized.length);
  }, [normalized.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalized.length]);

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
      }

      if (!hasMultipleImages) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveImage(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveImage(1);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [hasMultipleImages, moveImage]);

  function isTouchNavigationViewport() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 1024px)').matches
    );
  }

  function handleSwipeStart(event) {
    if (!hasMultipleImages || !isTouchNavigationViewport()) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleSwipeEnd(event) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || !hasMultipleImages || !isTouchNavigationViewport()) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (horizontalDistance < 44 || horizontalDistance < verticalDistance * 1.25) {
      return;
    }

    moveImage(deltaX < 0 ? 1 : -1);
  }

  return (
    <div className={normalized.length > 1 ? 'article-gallery-layout' : 'article-gallery-layout article-gallery-layout--single'}>
      {normalized.length >= 1 ? (
        <div className="article-gallery-thumbs" tabIndex={0} aria-label="Miniaturas del artículo">
          {normalized.map((image, index) => (
            <button
              type="button"
              key={image.id}
              className={index === activeIndex ? 'article-gallery-thumb is-active' : 'article-gallery-thumb'}
              aria-label={`Ver imagen ${index + 1} de ${normalized.length}`}
              onClick={() => setActiveIndex(index)}
            >
              <SmartImage
                src={image.thumbSrc || image.src}
                alt={`${title} ${index + 1}`}
                fallbackLabel={title}
                className="article-gallery-thumb__image"
                sizes="88px"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={hasMultipleImages ? 'article-gallery-main article-gallery-main--navigable' : 'article-gallery-main'}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        <div className="gallery-count" aria-live="polite">{activeIndex + 1} / {normalized.length}</div>
        <ArticleImageZoom image={active} title={title} />
        {hasMultipleImages ? (
          <PreviousNextControls
            className="article-gallery-desktop-arrows"
            previousContent={<GalleryArrowIcon direction="previous" />}
            nextContent={<GalleryArrowIcon direction="next" />}
            previousClassName="article-gallery-desktop-arrow article-gallery-desktop-arrow--previous"
            nextClassName="article-gallery-desktop-arrow article-gallery-desktop-arrow--next"
            previousAriaLabel="Imagen anterior"
            nextAriaLabel="Imagen siguiente"
            onPrevious={() => moveImage(-1)}
            onNext={() => moveImage(1)}
          />
        ) : null}
      </div>

      {lightboxOpen ? (
        <div className="gallery-zoom-backdrop" onClick={() => setLightboxOpen(false)}>
          <div className="gallery-zoom-dialog gallery-zoom-dialog--wide" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="gallery-zoom-close" onClick={() => setLightboxOpen(false)} aria-label="Cerrar zoom">X</button>
            <SmartImage
              src={active.zoomSrc || active.src}
              alt={active.altText || title}
              fallbackLabel={title}
              className="gallery-zoom-image"
              sizes={getArticleImageSizes("detail")}
              loading="eager"
              fetchPriority="high"
            />
            {hasMultipleImages ? (
              <PreviousNextControls
                className="gallery-zoom-nav"
                onPrevious={() => moveImage(-1)}
                onNext={() => moveImage(1)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
