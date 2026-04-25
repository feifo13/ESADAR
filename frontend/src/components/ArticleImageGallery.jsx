import { useEffect, useMemo, useState } from 'react';
import ProductImageZoom from './ProductImageZoom.jsx';
import SmartImage from './SmartImage.jsx';

export default function ArticleImageGallery({ images = [], title }) {
  const normalized = useMemo(() => {
    if (!images.length) {
      return [{
        id: 'fallback',
        src: '',
        zoomSrc: '',
        thumbSrc: '',
        altText: title,
        sources: [],
      }];
    }

    return images.map((image, index) => ({
      id: image.id || index,
      src: image.detailFilePath || image.detail_file_path || image.filePath || image.file_path || image.src || '',
      zoomSrc: image.zoomFilePath || image.zoom_file_path || image.detailFilePath || image.filePath || image.src || '',
      thumbSrc: image.thumbFilePath || image.thumb_file_path || image.cardFilePath || image.filePath || image.src || '',
      altText: image.altText || title,
      sources: [
        image.zoomFilePath ? { srcSet: `${image.zoomFilePath} 1600w`, media: '(min-width: 1280px)', type: 'image/webp' } : null,
        image.detailFilePath ? { srcSet: `${image.detailFilePath} 1100w`, media: '(min-width: 720px)', type: 'image/webp' } : null,
        image.cardFilePath ? { srcSet: `${image.cardFilePath} 700w`, type: 'image/webp' } : null,
      ].filter(Boolean),
    }));
  }, [images, title]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const active = normalized[activeIndex] || normalized[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [normalized.length]);

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
      }

      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) => (current - 1 + normalized.length) % normalized.length);
      }

      if (event.key === 'ArrowRight') {
        setActiveIndex((current) => (current + 1) % normalized.length);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [normalized.length]);

  return (
    <div className={normalized.length > 1 ? 'article-gallery-layout' : 'article-gallery-layout article-gallery-layout--single'}>
      {normalized.length > 1 ? (
        <div className="article-gallery-thumbs" tabIndex={0} aria-label="Miniaturas del articulo">
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
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="article-gallery-main">
        <div className="gallery-count" aria-live="polite">{activeIndex + 1} / {normalized.length}</div>
        <ProductImageZoom image={active} title={title} onOpen={() => setLightboxOpen(true)} />
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
              loading="eager"
              fetchPriority="high"
            />
            {normalized.length > 1 ? (
              <div className="gallery-zoom-nav">
                <button type="button" onClick={() => setActiveIndex((current) => (current - 1 + normalized.length) % normalized.length)}>Anterior</button>
                <button type="button" onClick={() => setActiveIndex((current) => (current + 1) % normalized.length)}>Siguiente</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
