import { useEffect, useMemo, useState } from 'react';
import { resolveAssetUrl } from '../lib/api.js';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildPlaceholderDataUrl(label) {
  const safeLabel = String(label || 'ESADAR').trim().slice(0, 28) || 'ESADAR';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="Placeholder">
      <defs>
        <linearGradient id="esadarPlaceholderBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a2432" />
          <stop offset="100%" stop-color="#06131d" />
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#esadarPlaceholderBg)" />
      <rect x="42" y="42" width="716" height="916" fill="none" stroke="rgba(158,180,188,0.34)" stroke-width="4" />
      <path d="M180 690l122-144 96 96 150-174 148 222H180z" fill="rgba(0,167,179,0.18)" stroke="rgba(0,167,179,0.45)" stroke-width="10" />
      <circle cx="542" cy="318" r="52" fill="rgba(252,76,2,0.85)" />
      <text x="400" y="182" text-anchor="middle" fill="#fc4c02" font-family="Georgia, serif" font-size="48" font-weight="700">ESADAR</text>
      <text x="400" y="790" text-anchor="middle" fill="#f3f8fa" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(safeLabel.toUpperCase())}</text>
      <text x="400" y="838" text-anchor="middle" fill="#9eb4bc" font-family="Arial, sans-serif" font-size="22">Imagen no disponible</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function SmartImage({
  src,
  alt,
  fallbackLabel,
  className,
  onError,
  ...props
}) {
  const resolvedSrc = resolveAssetUrl(src);
  const placeholderSrc = useMemo(
    () => buildPlaceholderDataUrl(fallbackLabel || alt || 'ESADAR'),
    [alt, fallbackLabel],
  );
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc || placeholderSrc);
  const [isFallback, setIsFallback] = useState(!resolvedSrc);

  useEffect(() => {
    setCurrentSrc(resolvedSrc || placeholderSrc);
    setIsFallback(!resolvedSrc);
  }, [placeholderSrc, resolvedSrc]);

  return (
    <img
      {...props}
      alt={alt}
      className={className}
      data-fallback={isFallback ? 'true' : 'false'}
      src={currentSrc}
      onError={(event) => {
        onError?.(event);

        if (currentSrc === placeholderSrc) {
          return;
        }

        setCurrentSrc(placeholderSrc);
        setIsFallback(true);
      }}
    />
  );
}
