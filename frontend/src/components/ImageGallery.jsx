import { useEffect, useMemo, useState } from 'react';
import PreviousNextControls from './PreviousNextControls.jsx';
import SmartImage from './SmartImage.jsx';

export default function ImageGallery({ images = [], title }) {
  const normalized = useMemo(() => {
    if (!images.length) {
      return [{ id: 'fallback', src: '', zoomSrc: '', thumbSrc: '', altText: title, sources: [] }];
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
  const [zoomOpen, setZoomOpen] = useState(false);
  const active = normalized[activeIndex] || normalized[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [normalized.length]);

  function move(delta) {
    setActiveIndex((current) => (current + delta + normalized.length) % normalized.length);
  }

  useEffect(() => {
    if (!zoomOpen) return undefined;

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        setZoomOpen(false);
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [zoomOpen, normalized.length]);

  return (
    <div className="gallery-shell">
      <div className="gallery-main">
        <div className="gallery-count" aria-live="polite">
          {activeIndex + 1} / {normalized.length}
        </div>
        <SmartImage
          src={active.src}
          alt={active.altText || title}
          fallbackLabel={title}
          className="gallery-main-image"
          sources={active.sources}
          loading="eager"
          fetchPriority="high"
        />
        <button
          type="button"
          className="gallery-zoom-button"
          onClick={() => setZoomOpen(true)}
          aria-label="Ampliar imagen"
        >
          Zoom
        </button>
        {normalized.length > 1 ? (
          <PreviousNextControls
            className="gallery-arrows"
            onPrevious={() => move(-1)}
            onNext={() => move(1)}
          />
        ) : null}
      </div>

      {normalized.length > 1 ? (
        <div className="gallery-thumbs">
          {normalized.map((image, index) => (
            <button
              type="button"
              key={image.id}
              className={index === activeIndex ? 'gallery-thumb active' : 'gallery-thumb'}
              onClick={() => setActiveIndex(index)}
            >
              <SmartImage
                src={image.thumbSrc || image.src}
                alt={`${title} ${index + 1}`}
                fallbackLabel={title}
                className="gallery-thumb-image"
              />
            </button>
          ))}
        </div>
      ) : null}

      {zoomOpen ? (
        <div className="gallery-zoom-backdrop" onClick={() => setZoomOpen(false)}>
          <div className="gallery-zoom-dialog" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="gallery-zoom-close"
              onClick={() => setZoomOpen(false)}
              aria-label="Cerrar zoom"
            >
              X
            </button>
            <SmartImage
              src={active.zoomSrc || active.src}
              alt={active.altText || title}
              fallbackLabel={title}
              className="gallery-zoom-image"
              loading="eager"
              fetchPriority="high"
            />
            {normalized.length > 1 ? (
              <PreviousNextControls
                className="gallery-zoom-nav"
                onPrevious={() => move(-1)}
                onNext={() => move(1)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
