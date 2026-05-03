import { useMemo, useState } from 'react';
import SmartImage from './SmartImage.jsx';
import { resolveAssetUrl } from '../lib/api.js';

const LENS_SIZE = 138;
const ZOOM_SCALE = 2.7;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function ProductImageZoom({ image, title, onOpen }) {
  const [hoverState, setHoverState] = useState({
    active: false,
    xPercent: 50,
    yPercent: 50,
    lensLeft: 0,
    lensTop: 0,
  });
  const zoomImage = image?.zoomSrc || image?.src || '';
  const backgroundImage = useMemo(() => resolveAssetUrl(zoomImage), [zoomImage]);

  function handlePointerMove(event) {
    if (window.innerWidth < 960 || !backgroundImage) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
    const localY = clamp(event.clientY - rect.top, 0, rect.height);
    const xPercent = rect.width ? (localX / rect.width) * 100 : 50;
    const yPercent = rect.height ? (localY / rect.height) * 100 : 50;

    setHoverState({
      active: true,
      xPercent,
      yPercent,
      lensLeft: clamp(localX - LENS_SIZE / 2, 0, Math.max(0, rect.width - LENS_SIZE)),
      lensTop: clamp(localY - LENS_SIZE / 2, 0, Math.max(0, rect.height - LENS_SIZE)),
    });
  }

  return (
    <div
      className="product-zoom-shell"
      onMouseMove={handlePointerMove}
      onMouseEnter={() => {
        if (window.innerWidth >= 960 && backgroundImage) {
          setHoverState((current) => ({ ...current, active: true }));
        }
      }}
      onMouseLeave={() => setHoverState((current) => ({ ...current, active: false }))}
    >
      <button
        type="button"
        className="product-zoom-main"
        onClick={onOpen}
        aria-label="Abrir imagen ampliada"
      >
        <SmartImage
          src={image?.src}
          alt={image?.altText || title}
          fallbackLabel={title}
          className="product-zoom-main__image"
          sources={image?.sources || []}
          loading="eager"
          fetchPriority="high"
        />

        {hoverState.active && backgroundImage ? (
          <>
            <span
              className="product-zoom-main__lens"
              style={{
                width: `${LENS_SIZE}px`,
                height: `${LENS_SIZE}px`,
                left: `${hoverState.lensLeft}px`,
                top: `${hoverState.lensTop}px`,
                backgroundImage: `url(${backgroundImage})`,
                backgroundPosition: `${hoverState.xPercent}% ${hoverState.yPercent}%`,
                backgroundSize: `${ZOOM_SCALE * 100}%`,
              }}
            >
              <span className="product-zoom-main__lens-core" />
            </span>

            <span
              className="product-zoom-pane"
              aria-hidden="true"
              style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundPosition: `${hoverState.xPercent}% ${hoverState.yPercent}%`,
                backgroundSize: `${ZOOM_SCALE * 100}%`,
              }}
            />
          </>
        ) : null}
      </button>
    </div>
  );
}
