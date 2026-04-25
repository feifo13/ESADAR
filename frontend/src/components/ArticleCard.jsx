import { Link } from 'react-router-dom';
import { formatCurrency, getDiscountedPrice, hasDiscount, cn } from '../lib/format.js';
import { useCart } from '../contexts/CartContext.jsx';
import { useWishlist } from '../contexts/WishlistContext.jsx';
import SmartImage from './SmartImage.jsx';

function HeartIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={active ? 'wishlist-heart-icon is-active' : 'wishlist-heart-icon'}>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function ArticleCard({ article, view = 'grid' }) {
  const { addItem } = useCart();
  const { isSaved, toggleItem, pendingIds } = useWishlist();
  const discounted = hasDiscount(article);
  const price = getDiscountedPrice(article);
  const isSoldOut = Number(article.quantityAvailable || 0) <= 0 || article.status === 'SOLD_OUT';
  const categoryName = article.category?.name || article.categoryName || 'Sin categoria';
  const brandName = article.brand?.name || article.brandName || '';
  const sizeLabel = article.sizeText || article.size?.code || article.sizeCode || 'Talle no especificado';
  const conditionLabel = article.conditionLabel || '';
  const colorLabel = article.color || '';
  const materialLabel = article.material || '';
  const isUniquePiece = Number(article.quantityTotal || 0) <= 1;
  const saved = isSaved(article.id);
  const pending = pendingIds.includes(Number(article.id));
  const imageSources = article.primaryImageDetail || article.primaryImageThumb ? [
    article.primaryImageDetail ? { srcSet: `${article.primaryImageDetail} 900w`, media: '(min-width: 720px)', type: 'image/webp' } : null,
    article.primaryImage ? { srcSet: `${article.primaryImage} 560w`, type: 'image/webp' } : null,
  ].filter(Boolean) : [];

  const optimisticWishlistItem = {
    articleId: article.id,
    slug: article.slug,
    title: article.title,
    salePrice: article.salePrice,
    discountType: article.discountType,
    discountValue: article.discountValue,
    discountedPrice: article.discountedPrice,
    status: article.status,
    conditionLabel: article.conditionLabel,
    color: article.color,
    material: article.material,
    quantityAvailable: article.quantityAvailable,
    brandName: article.brandName,
    sizeLabel,
    image: article.primaryImage || '',
  };

  return (
    <article className={cn('article-card', view === 'list' && 'article-card-list', isSoldOut && 'article-card--sold-out')}>
      <div className="article-card-media-wrap">
        <Link className="article-card-media" to={`/articles/${article.slug || article.id}`}>
          {isSoldOut ? <span className="article-card-ribbon">Agotado</span> : null}
          <SmartImage
            src={article.primaryImage}
            alt={article.primaryImageAlt || article.title}
            fallbackLabel={article.title}
            loading="lazy"
            sources={imageSources}
          />
        </Link>

        <button
          type="button"
          className={saved ? 'article-card-heart is-active' : 'article-card-heart'}
          aria-label={saved ? 'Quitar de guardados' : 'Guardar prenda'}
          aria-pressed={saved}
          disabled={pending}
          onClick={() => void toggleItem(article, optimisticWishlistItem)}
        >
          <HeartIcon active={saved} />
        </button>
      </div>

      <div className="article-card-body">
        <div className="article-card-tags">
          {article.isFeatured ? <span className="pill pill-featured">Destacado</span> : null}
          {article.allowOffers ? <span className="pill pill-offer">Acepta ofertas</span> : null}
          {discounted ? <span className="pill pill-discount">Descuento</span> : null}
          {isUniquePiece ? <span className="pill pill-unique">Pieza unica</span> : null}
          {isSoldOut ? <span className="pill pill-soldout">Agotado</span> : null}
        </div>

        <div className="article-card-copy">
          <p className="eyebrow">{categoryName}{brandName ? ` · ${brandName}` : ''}</p>
          <Link to={`/articles/${article.slug || article.id}`} className="article-card-title">
            {article.title}
          </Link>
          <div className="article-card-details">
            <p className="article-card-meta">Talle: {sizeLabel}</p>
            {conditionLabel ? <p className="article-card-detail-line">Estado: {conditionLabel}</p> : null}
            {colorLabel ? <p className="article-card-detail-line">Color: {colorLabel}</p> : null}
            {materialLabel ? <p className="article-card-detail-line">Material: {materialLabel}</p> : null}
            <p className="article-card-detail-line">{isSoldOut ? 'Sin stock' : `${Number(article.quantityAvailable || 0)} disponibles`}</p>
          </div>
        </div>

        <div className="article-card-pricebox">
          {discounted ? <span className="price-old">{formatCurrency(article.salePrice)}</span> : null}
          <span className="price-current">{formatCurrency(price)}</span>
        </div>

        <div className="article-card-actions">
          <Link to={`/articles/${article.slug || article.id}`} className="button button-secondary button-compact">
            Ver prenda
          </Link>
          <button
            type="button"
            className={saved ? 'button button-secondary button-compact is-active' : 'button button-secondary button-compact'}
            onClick={() => void toggleItem(article, optimisticWishlistItem)}
            disabled={pending}
          >
            {saved ? 'Guardado' : 'Guardar'}
          </button>
          {!isSoldOut ? (
            <button
              type="button"
              className="button button-primary button-compact"
              onClick={(event) => {
                addItem(article, 1, { sourceRect: event.currentTarget.getBoundingClientRect() });
              }}
            >
              Agregar al carrito
            </button>
          ) : null}
          {article.allowOffers && !isSoldOut ? (
            <Link to={`/articles/${article.slug || article.id}/offer`} className="button button-secondary button-compact">
              Ofertar
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
