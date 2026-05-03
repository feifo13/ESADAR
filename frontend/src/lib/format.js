export function formatCurrency(value) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

export function formatDate(value, options = {}) {
  const { withTime = true } = options;
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = date.getFullYear();
  const dateLabel = `${day}-${month}-${year}`;

  if (!withTime) return dateLabel;

  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  return `${dateLabel} ${hours}:${minutes}`;
}

export function formatDateOnly(value) {
  return formatDate(value, { withTime: false });
}

export function formatDateTime(value) {
  return formatDate(value, { withTime: true });
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
