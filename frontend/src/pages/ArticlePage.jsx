import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { formatCurrency, getDiscountedPrice, hasDiscount } from '../lib/format.js';
import { useCart } from '../contexts/CartContext.jsx';
import ImageGallery from '../components/ImageGallery.jsx';
import ArticleCard from '../components/ArticleCard.jsx';

export default function ArticlePage() {
  const { slugOrId } = useParams();
  const { addItem, isInCart } = useCart();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadArticle() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch(`/api/public/articles/${slugOrId}`);
        if (ignore) return;
        setArticle(response.article);

        if (response.article?.categoryId) {
          const relatedResponse = await apiFetch(
            `/api/public/articles?categoryId=${response.article.categoryId}&sort=intake_desc&page=1`,
          );
          if (!ignore) {
            setRelated((relatedResponse.items || []).filter((item) => item.id !== response.article.id).slice(0, 8));
          }
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar el artículo');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      ignore = true;
    };
  }, [slugOrId]);

  useEffect(() => {
    if (!justAdded) return undefined;
    const timeoutId = window.setTimeout(() => setJustAdded(false), 820);
    return () => window.clearTimeout(timeoutId);
  }, [justAdded]);

  if (loading) {
    return <div className="container section-card centered-card">Cargando artículo…</div>;
  }

  if (error || !article) {
    return <div className="container section-card error-card">{error || 'Artículo no encontrado'}</div>;
  }

  const discounted = hasDiscount(article);
  const finalPrice = getDiscountedPrice(article);

  return (
    <div className="container article-page-shell page-stack">
      <section className="detail-shell detail-shell-article">
        <div className="detail-titlebar">
          <p className="section-kicker">Artículo</p>
          <h1>{article.title}</h1>
        </div>

        <div className="detail-grid detail-grid-article">
          <div className="detail-gallery-column">
            <ImageGallery images={article.images} title={article.title} />
          </div>

          <aside className="detail-sidebar detail-sidebar-article section-card">
            <div className="detail-meta-list">
              <div><span>Categoría</span><strong>{article.categoryName}</strong></div>
              <div><span>Talle</span><strong>{article.sizeText || article.sizeCode || 'No especificado'}</strong></div>
              <div><span>Marca</span><strong>{article.brandName || 'Sin marca'}</strong></div>
              <div><span>Medidas</span><strong>{article.measurementsText || 'A confirmar'}</strong></div>
            </div>

            <div className="detail-pricing">
              {discounted ? <span className="price-old">{formatCurrency(article.salePrice)}</span> : null}
              <strong className="price-current price-current-large">{formatCurrency(finalPrice)}</strong>
            </div>

            {article.description ? <p className="muted-copy">{article.description}</p> : null}
            {feedback ? <p className="success-copy">{feedback}</p> : null}

            <div className="detail-actions detail-actions-article">
              <button
                type="button"
                className={`button button-primary button-compact${justAdded ? ' button-cart-added' : ''}`}
                onClick={() => {
                  addItem(article);
                  setFeedback(isInCart(article.id) ? 'El artículo ya estaba en el carro.' : 'Artículo agregado al carro.');
                  setJustAdded(true);
                }}
              >
                Lo quiero
              </button>

              {article.allowOffers ? (
                <Link to={`/articles/${article.slug || article.id}/offer`} className="button button-secondary button-compact">
                  Ofertar
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <section className="page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Relacionados</p>
            <h2>Más prendas con el mismo pulso</h2>
          </div>
        </div>

        <div className="article-grid">
          {related.map((item) => (
            <ArticleCard key={item.id} article={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
