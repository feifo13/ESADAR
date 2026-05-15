import { useEffect, useMemo, useState } from 'react';
import { resolveAssetUrl } from '../lib/api.js';
import fallbackArticleImage from '../assets/article-image-fallback.png';

function resolveSrcSet(value) {
  if (!value) return '';
  return String(value)
    .split(',')
    .map((entry) => {
      const [path, descriptor] = entry.trim().split(/\s+/, 2);
      const resolvedPath = resolveAssetUrl(path);
      if (!resolvedPath) return '';
      return `${resolvedPath}${descriptor ? ` ${descriptor}` : ''}`;
    })
    .filter(Boolean)
    .join(', ');
}

export default function SmartImage({
  src,
  sources,
  srcSet,
  sizes,
  alt,
  fallbackLabel: _fallbackLabel,
  className,
  onError,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  ...props
}) {
  const resolvedSrc = resolveAssetUrl(src);
  const resolvedSources = useMemo(
    () => (Array.isArray(sources)
      ? sources
        .map((source) => ({
          ...source,
          srcSet: resolveSrcSet(source?.srcSet),
        }))
        .filter((source) => source.srcSet)
      : []),
    [sources],
  );
  const resolvedSrcSet = useMemo(() => resolveSrcSet(srcSet), [srcSet]);
  const placeholderSrc = fallbackArticleImage;
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc || placeholderSrc);
  const [isFallback, setIsFallback] = useState(!resolvedSrc);

  useEffect(() => {
    setCurrentSrc(resolvedSrc || placeholderSrc);
    setIsFallback(!resolvedSrc);
  }, [placeholderSrc, resolvedSrc]);

  const imageNode = (
    <img
      {...props}
      alt={alt}
      className={className}
      data-fallback={isFallback ? 'true' : 'false'}
      src={currentSrc}
      srcSet={currentSrc === placeholderSrc ? undefined : resolvedSrcSet || undefined}
      sizes={currentSrc === placeholderSrc ? undefined : sizes}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
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

  if (!resolvedSources.length || currentSrc === placeholderSrc) {
    return imageNode;
  }

  return (
    <picture>
      {resolvedSources.map((source) => (
        <source
          key={`${source.srcSet}-${source.media || ''}`}
          media={source.media}
          type={source.type}
          srcSet={source.srcSet}
          sizes={source.sizes || sizes}
        />
      ))}
      {imageNode}
    </picture>
  );
}
