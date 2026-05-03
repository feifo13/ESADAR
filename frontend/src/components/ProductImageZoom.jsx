import { useMemo, useState } from 'react';
import SmartImage from './SmartImage.jsx';
import { resolveAssetUrl } from '../lib/api.js';

const ZOOM_SCALE = 1.9;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function ProductImageZoom({ image, title, onOpen }) {
  const [zoomState, setZoomState] = useState({ active: false, xPercent: 50, yPercent: 50 });
  const mainImage = image?.src || image?.zoomSrc || image?.thumbSrc || '';
  const zoomImage = image?.zoomSrc || image?.src || image?.thumbSrc || '';
  const resolvedZoomImage = useMemo(() => resolveAssetUrl(zoomImage), [zoomImage]);

  function handlePointerMove(event) {
    if (window.innerWidth < 960 || !resolvedZoomImage) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
    const localY = clamp(event.clientY - rect.top, 0, rect.height);
    const xPercent = rect.width ? (localX / rect.width) * 100 : 50;
    const yPercent = rect.height ? (localY / rect.height) * 100 : 50;

    setZoomState({ active: true, xPercent, yPercent });
  }

  return (
    <div
      className={zoomState.active ? 'product-zoom-shell is-zooming' : 'product-zoom-shell'}
      onMouseMove={handlePointerMove}
      onMouseEnter={() => {
        if (window.innerWidth >= 960 && resolvedZoomImage) {
          setZoomState((current) => ({ ...current, active: true }));
        }
      }}
      onMouseLeave={() => setZoomState((current) => ({ ...current, active: false }))}
    >
      <button
        type="button"
        className="product-zoom-main"
        onClick={onOpen}
        aria-label="Abrir imagen ampliada"
      >
        <SmartImage
          src={mainImage}
          alt={image?.altText || title}
          fallbackLabel={title}
          className="product-zoom-main__image"
          sources={image?.sources || []}
          loading="eager"
          fetchPriority="high"
          style={zoomState.active ? {
            transform: `scale(${ZOOM_SCALE})`,
            transformOrigin: `${zoomState.xPercent}% ${zoomState.yPercent}%`,
          } : undefined}
        />
      </button>
    </div>
  );
}
