const IMAGE_WIDTHS = {
  thumb: 360,
  card: 1200,
  detail: 1800,
  zoom: 2600,
};

function compactUnique(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry?.src) return false;
    const key = `${entry.src} ${entry.width || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getArticleImageSources(article = {}) {
  const thumb = article.imageThumbUrl || article.primaryImageThumb || article.thumbFilePath || article.thumb_file_path || '';
  const card = article.imageCardUrl || article.primaryImageCard || article.cardFilePath || article.card_file_path || article.primaryImage || '';
  const detail = article.imageDetailUrl || article.primaryImageDetail || article.detailFilePath || article.detail_file_path || '';
  const zoom = article.imageZoomUrl || article.primaryImageZoom || article.zoomFilePath || article.zoom_file_path || '';
  const original = article.imageOriginalUrl || article.primaryImageOriginal || article.originalFilePath || article.original_file_path || '';
  const fallback = article.primaryImage || article.filePath || article.file_path || article.src || '';

  return {
    thumb: thumb || card || detail || zoom || original || fallback,
    card: card || detail || thumb || zoom || original || fallback,
    detail: detail || zoom || card || original || thumb || fallback,
    zoom: zoom || detail || original || card || thumb || fallback,
    original: original || zoom || detail || card || thumb || fallback,
    fallback,
  };
}

export function getArticleImageSrc(article = {}, preferred = 'card') {
  const sources = getArticleImageSources(article);
  return sources[preferred] || sources.card || sources.detail || sources.thumb || sources.zoom || sources.original || sources.fallback || '';
}

export function buildArticleImageSrcSet(article = {}, profile = 'card') {
  const sources = getArticleImageSources(article);
  const includeOriginal = profile === 'detail' || profile === 'zoom';
  const candidates = compactUnique([
    { src: sources.thumb, width: IMAGE_WIDTHS.thumb },
    { src: sources.card, width: IMAGE_WIDTHS.card },
    { src: sources.detail, width: IMAGE_WIDTHS.detail },
    { src: sources.zoom, width: IMAGE_WIDTHS.zoom },
    includeOriginal ? { src: sources.original, width: IMAGE_WIDTHS.zoom } : null,
  ].filter(Boolean));

  return candidates.map((candidate) => `${candidate.src} ${candidate.width}w`).join(', ');
}

export function getArticleImageSizes(profile = 'card') {
  if (profile === 'featured') {
    return '(max-width: 720px) 78vw, (max-width: 1180px) 56vw, 520px';
  }

  if (profile === 'related') {
    return '(max-width: 720px) 78vw, (max-width: 1180px) 320px, 340px';
  }

  if (profile === 'detail') {
    return '(max-width: 960px) 100vw, min(1080px, calc(100vw - 520px))';
  }

  return '(max-width: 720px) 48vw, (max-width: 1180px) 32vw, 320px';
}

export { IMAGE_WIDTHS as ARTICLE_IMAGE_WIDTHS };
