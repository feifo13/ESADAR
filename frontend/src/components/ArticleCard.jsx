import { Link } from 'react-router-dom';
import { formatCurrency, getDiscountedPrice, hasDiscount, cn } from '../lib/format.js';
import { resolveAssetUrl } from '../lib/api.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80';

export default function ArticleCard({ article, view = 'grid' }) {
  const discounted = hasDiscount(article);
  const price = getDiscountedPrice(article);

  return (
    <article className={cn('article-card', view === 'list' && 'article-card-list')}>
      <Link className="article-card-media" to={`/articles/${article.slug || article.id}`}>
        <img
          src={resolveAssetUrl(article.primaryImage) || FALLBACK_IMAGE}
          alt={article.title}
          loading="lazy"
        />
      </Link>

      <div className="article-card-body">
        <div className="article-card-tags">
          {article.isFeatured ? <span className="pill pill-featured">Destacado</span> : null}
          {article.allowOffers ? <span className="pill pill-offer">Ofrezco</span> : null}
          {discounted ? <span className="pill pill-discount">Descuento</span> : null}
        </div>

        <div className="article-card-copy">
          <p className="eyebrow">{article.categoryName}{article.brandName ? ` · ${article.brandName}` : ''}</p>
          <Link to={`/articles/${article.slug || article.id}`} className="article-card-title">
            {article.title}
          </Link>
          <p className="article-card-meta">
            {article.sizeText || article.sizeCode || 'Talle no especificado'}
          </p>
        </div>

        <div className="article-card-pricebox">
          {discounted ? <span className="price-old">{formatCurrency(article.salePrice)}</span> : null}
          <span className="price-current">{formatCurrency(price)}</span>
        </div>
      </div>
    </article>
  );
}
