import { useMemo, useState } from 'react';
import { resolveAssetUrl } from '../lib/api.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=80';

export default function ImageGallery({ images = [], title }) {
  const normalized = useMemo(() => {
    if (!images.length) return [{ id: 'fallback', src: FALLBACK_IMAGE }];
    return images.map((image, index) => ({
      id: image.id || index,
      src: resolveAssetUrl(image.filePath || image.file_path || image.src) || FALLBACK_IMAGE,
    }));
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const active = normalized[activeIndex] || normalized[0];

  function move(delta) {
    setActiveIndex((current) => (current + delta + normalized.length) % normalized.length);
  }

  return (
    <div className="gallery-shell">
      <div className="gallery-main">
        <img src={active.src} alt={title} />
        {normalized.length > 1 ? (
          <div className="gallery-arrows">
            <button type="button" onClick={() => move(-1)}>←</button>
            <button type="button" onClick={() => move(1)}>→</button>
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
              <img src={image.src} alt={`${title} ${index + 1}`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
