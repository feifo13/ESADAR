export function formatCurrency(value) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getDiscountedPrice(article) {
  if (article.discountedPrice != null) return Number(article.discountedPrice);
  const salePrice = Number(article.salePrice || 0);
  const discountValue = Number(article.discountValue || 0);
  if (!article.discountType || article.discountType === 'NONE' || discountValue <= 0) {
    return salePrice;
  }
  if (article.discountType === 'PERCENT') {
    return Math.max(0, salePrice - salePrice * (discountValue / 100));
  }
  return Math.max(0, salePrice - discountValue);
}

export function hasDiscount(article) {
  return article && article.discountType && article.discountType !== 'NONE' && Number(article.discountValue || 0) > 0;
}

export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
