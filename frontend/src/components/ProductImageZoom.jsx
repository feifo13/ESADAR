import { useMemo, useState } from 'react';
import SmartImage from './SmartImage.jsx';
import { resolveAssetUrl } from '../lib/api.js';

export default function ProductImageZoom({ image, title, onOpen }) {
  const [hoverState, setHoverState] = useState({ active: false, x: 50, y: 50 });
  const zoomImage = image?.zoomSrc || image?.src || '';
  const backgroundImage = useMemo(() => resolveAssetUrl(zoomImage), [zoomImage]);

  function handlePointerMove(event) {
    if (window.innerWidth < 960) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    setHoverState({ active: true, x, y });
  }

  return (
    <div
      className="product-zoom-shell"
      onMouseMove={handlePointerMove}
      onMouseEnter={() => setHoverState((current) => ({ ...current, active: window.innerWidth >= 960 }))}
      onMouseLeave={() => setHoverState({ active: false, x: 50, y: 50 })}
    >
      <button type="button" className="product-zoom-main" onClick={onOpen} aria-label="Abrir imagen ampliada">
        <SmartImage
          src={image?.src}
          alt={image?.altText || title}
          fallbackLabel={title}
          className="product-zoom-main__image"
          sources={image?.sources || []}
          loading="eager"
          fetchPriority="high"
        />
        {hoverState.active ? (
          <span
            className="product-zoom-main__lens"
            style={{
              left: `calc(${hoverState.x}% - 46px)`,
              top: `calc(${hoverState.y}% - 46px)`,
            }}
          />
        ) : null}
      </button>

      {hoverState.active && backgroundImage ? (
        <div
          className="product-zoom-pane"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundPosition: `${hoverState.x}% ${hoverState.y}%`,
          }}
        />
      ) : null}
    </div>
  );
}
