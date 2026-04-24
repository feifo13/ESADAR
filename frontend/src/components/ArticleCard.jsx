import { Link } from 'react-router-dom';
import { formatCurrency, getDiscountedPrice, hasDiscount, cn } from '../lib/format.js';
import SmartImage from './SmartImage.jsx';

export default function ArticleCard({ article, view = 'grid' }) {
  const discounted = hasDiscount(article);
  const price = getDiscountedPrice(article);
  const isSoldOut = Number(article.quantityAvailable || 0) <= 0 || article.status === 'SOLD_OUT';
  const categoryName = article.category?.name || article.categoryName || 'Sin categoria';
  const brandName = article.brand?.name || article.brandName || '';
  const sizeLabel = article.sizeText || article.size?.code || article.sizeCode || 'Talle no especificado';

  return (
    <article className={cn('article-card', view === 'list' && 'article-card-list', isSoldOut && 'article-card--sold-out')}>
      <Link className="article-card-media" to={`/articles/${article.slug || article.id}`}>
        {isSoldOut ? <span className="article-card-ribbon">Agotado</span> : null}
        <SmartImage src={article.primaryImage} alt={article.title} fallbackLabel={article.title} loading="lazy" />
      </Link>

      <div className="article-card-body">
        <div className="article-card-tags">
          {article.isFeatured ? <span className="pill pill-featured">Destacado</span> : null}
          {article.allowOffers ? <span className="pill pill-offer">Ofrezco</span> : null}
          {discounted ? <span className="pill pill-discount">Descuento</span> : null}
          {isSoldOut ? <span className="pill pill-soldout">Agotado</span> : null}
        </div>

        <div className="article-card-copy">
          <p className="eyebrow">{categoryName}{brandName ? ` - ${brandName}` : ''}</p>
          <Link to={`/articles/${article.slug || article.id}`} className="article-card-title">
            {article.title}
          </Link>
          <p className="article-card-meta">{sizeLabel}</p>
        </div>

        <div className="article-card-pricebox">
          {discounted ? <span className="price-old">{formatCurrency(article.salePrice)}</span> : null}
          <span className="price-current">{formatCurrency(price)}</span>
        </div>
      </div>
    </article>
  );
}
