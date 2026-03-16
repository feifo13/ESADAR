import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import ImageGallery from '../components/ImageGallery.jsx';
import ArticleCard from '../components/ArticleCard.jsx';

export default function OfferPage() {
  const { slugOrId } = useParams();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [offer, setOffer] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [slugOrId]);

  useEffect(() => {
    let ignore = false;

    async function loadArticle() {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/public/articles/${slugOrId}`);
        if (ignore) return;
        setArticle(response.article);
        const relatedResponse = await apiFetch('/api/public/articles?offerable=true&sort=intake_desc&page=1');
        if (!ignore) setRelated((relatedResponse.items || []).filter((item) => item.id !== response.article.id).slice(0, 8));
      } catch {
        if (!ignore) setArticle(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      ignore = true;
    };
  }, [slugOrId]);

  if (loading) {
    return <div className="container section-card centered-card">Cargando artículo…</div>;
  }

  if (!article) {
    return <div className="container section-card error-card">No se pudo cargar este artículo para ofertar.</div>;
  }

  return (
    <div className="container article-page-shell page-stack offer-page">
      <section className="detail-shell detail-shell-article">
        <div className="detail-titlebar detail-titlebar-offer">
          <p className="section-kicker">Ofertar artículo</p>
          <h1>Estás ofertando por: {article.title}</h1>
        </div>

        <div className="detail-grid detail-grid-article">
          <div className="detail-gallery-column">
            <ImageGallery images={article.images} title={article.title} />
          </div>

          <aside className="detail-sidebar detail-sidebar-article section-card offer-sidebar-flat">
            <div className="detail-meta-list">
              <div><span>Categoría</span><strong>{article.categoryName}</strong></div>
              <div><span>Talle</span><strong>{article.sizeText || article.sizeCode || 'No especificado'}</strong></div>
              <div><span>Marca</span><strong>{article.brandName || 'Sin marca'}</strong></div>
              <div><span>Medidas</span><strong>{article.measurementsText || 'A confirmar'}</strong></div>
            </div>

            <div className="detail-pricing">
              <strong className="price-current price-current-large">{formatCurrency(article.salePrice)}</strong>
            </div>

            {article.description ? <p className="muted-copy">{article.description}</p> : null}

            <label className="field-group">
              <span>Tu oferta</span>
              <input
                type="number"
                min="0"
                className="input"
                value={offer}
                onChange={(event) => setOffer(event.target.value)}
                placeholder="Ej: 1200"
              />
            </label>

            <div className="detail-actions detail-actions-article">
              <button
                type="button"
                className="button button-primary button-compact"
                onClick={() => setMessage('La pantalla quedó preparada. El endpoint de ofertas se conecta en el siguiente paso.')}
              >
                Ofertar
              </button>

              <Link to={`/articles/${article.slug || article.id}`} className="button button-secondary button-compact">
                Volver al artículo
              </Link>
            </div>

            {message ? <p className="success-copy">{message}</p> : null}
            <p className="muted-copy">Esta vista ya tiene identidad propia, pero ahora quedó alineada con el resto del catálogo.</p>
          </aside>
        </div>
      </section>

      <section className="page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">También permiten oferta</p>
            <h2>Más prendas abiertas a negociación</h2>
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
