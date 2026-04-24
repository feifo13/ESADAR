import { useMemo, useState } from 'react';
import SmartImage from './SmartImage.jsx';

export default function ImageGallery({ images = [], title }) {
  const normalized = useMemo(() => {
    if (!images.length) return [{ id: 'fallback', src: '' }];

    return images.map((image, index) => ({
      id: image.id || index,
      src: image.filePath || image.file_path || image.src || '',
    }));
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const active = normalized[activeIndex] || normalized[0];

  function move(delta) {
    setActiveIndex((current) => (current + delta + normalized.length) % normalized.length);
  }

  return (
    <div className="gallery-shell">
      <div className="gallery-main">
        <SmartImage src={active.src} alt={title} fallbackLabel={title} />
        <button
          type="button"
          className="gallery-zoom-button"
          onClick={() => setZoomOpen(true)}
          aria-label="Ampliar imagen"
        >
          Zoom
        </button>
        {normalized.length > 1 ? (
          <div className="gallery-arrows">
            <button type="button" onClick={() => move(-1)}>Prev</button>
            <button type="button" onClick={() => move(1)}>Next</button>
          </div>
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
              <SmartImage src={image.src} alt={`${title} ${index + 1}`} fallbackLabel={title} />
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
            <SmartImage src={active.src} alt={title} fallbackLabel={title} className="gallery-zoom-image" />
            {normalized.length > 1 ? (
              <div className="gallery-zoom-nav">
                <button type="button" onClick={() => move(-1)}>Anterior</button>
                <button type="button" onClick={() => move(1)}>Siguiente</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
