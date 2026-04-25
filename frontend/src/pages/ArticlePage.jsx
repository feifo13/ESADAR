import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import { apiFetch } from '../lib/api.js';
import { formatCurrency, getDiscountedPrice, hasDiscount } from '../lib/format.js';
import { useCart } from '../contexts/CartContext.jsx';
import { useSiteSeo } from '../contexts/SiteSeoContext.jsx';
import { buildBreadcrumbJsonLd, buildProductJsonLd, toAbsoluteUrl } from '../lib/seo.js';
import { getPublicSessionToken } from '../lib/publicSession.js';
import ImageGallery from '../components/ImageGallery.jsx';
import ArticleCard from '../components/ArticleCard.jsx';

const initialAlertForm = {
  firstName: '',
  email: '',
  phone: '',
  instagram: '',
};

export default function ArticlePage() {
  const { slugOrId } = useParams();
  const { addItem, getItem, isInCart } = useCart();
  const { site } = useSiteSeo();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const [stockDialog, setStockDialog] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [savedInWishlist, setSavedInWishlist] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertForm, setAlertForm] = useState(initialAlertForm);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState('');
  const [alertSuccess, setAlertSuccess] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [slugOrId]);

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

        await apiFetch('/api/public/article-events', {
          method: 'POST',
          body: {
            articleId: response.article.id,
            eventType: 'VIEW',
            sessionToken: getPublicSessionToken(),
          },
        }).catch(() => undefined);
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar el articulo');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    async function loadWishlistState() {
      try {
        const response = await apiFetch(`/api/public/wishlist?sessionToken=${encodeURIComponent(getPublicSessionToken())}`);
        if (ignore) return;
        const items = response.wishlist?.items || [];
        setSavedInWishlist(items.some((item) => Number(item.articleId) === Number(slugOrId) || item.slug === slugOrId));
      } catch {
        if (!ignore) setSavedInWishlist(false);
      }
    }

    loadArticle();
    loadWishlistState();

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
    return <div className="container section-card centered-card">Cargando articulo…</div>;
  }

  if (error || !article) {
    return <div className="container section-card error-card">{error || 'Articulo no encontrado'}</div>;
  }

  const discounted = hasDiscount(article);
  const finalPrice = getDiscountedPrice(article);
  const isSoldOut = Number(article.quantityAvailable || 0) <= 0 || article.status === 'SOLD_OUT';
  const currentCartItem = getItem(article.id);
  const canonicalUrl = article.canonicalUrl || toAbsoluteUrl(`/articles/${article.slug || article.id}`, site);
  const breadcrumbItems = [
    { name: 'Inicio', url: toAbsoluteUrl('/', site) },
    { name: article.categoryName || article.category?.name || 'Categoria', url: toAbsoluteUrl('/', site) },
    { name: article.title, url: canonicalUrl },
  ];

  function showStockNotice(result) {
    if (!result || result.ok) return;
    if (result.code === 'OUT_OF_STOCK') {
      setStockDialog({
        title: 'Articulo agotado',
        message: 'Este articulo no tiene stock disponible en este momento.',
      });
      return;
    }

    setStockDialog({
      title: 'Stock maximo alcanzado',
      message: `Solo hay ${result.maxQuantity} unidad${result.maxQuantity === 1 ? '' : 'es'} disponible${result.maxQuantity === 1 ? '' : 's'} para este articulo.`,
    });
  }

  async function handleWishlistToggle() {
    if (!article) return;

    try {
      setWishlistLoading(true);

      if (savedInWishlist) {
        await apiFetch(`/api/public/wishlist/items/${article.id}?sessionToken=${encodeURIComponent(getPublicSessionToken())}`, {
          method: 'DELETE',
        });
        setSavedInWishlist(false);
        return;
      }

      await apiFetch('/api/public/wishlist/items', {
        method: 'POST',
        body: {
          articleId: article.id,
          sessionToken: getPublicSessionToken(),
        },
      });
      setSavedInWishlist(true);
    } catch (err) {
      setFeedback(err.message || 'No pudimos actualizar tu lista guardada.');
    } finally {
      setWishlistLoading(false);
    }
  }

  async function handleShare() {
    const shareData = {
      title: article.title,
      text: article.seoDescription || article.description || article.title,
      url: canonicalUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(canonicalUrl);
        setFeedback('Copiamos el enlace para compartir.');
      }

      await apiFetch('/api/public/article-events', {
        method: 'POST',
        body: {
          articleId: article.id,
          eventType: 'SHARE',
          sessionToken: getPublicSessionToken(),
        },
      }).catch(() => undefined);
    } catch {
      setFeedback('No pudimos compartir el enlace ahora.');
    }
  }

  async function handleStockAlertSubmit(event) {
    event.preventDefault();

    try {
      setAlertSubmitting(true);
      setAlertError('');
      setAlertSuccess('');

      await apiFetch('/api/public/leads/stock-alert', {
        method: 'POST',
        body: {
          articleId: article.id,
          alertType: isSoldOut ? 'BACK_IN_STOCK' : 'SIMILAR_ITEMS',
          firstName: alertForm.firstName || null,
          email: alertForm.email || null,
          phone: alertForm.phone || null,
          instagram: alertForm.instagram || null,
          preferredCategories: article.categoryName ? [article.categoryName] : [],
          preferredBrands: article.brandName ? [article.brandName] : [],
          preferredSizes: article.sizeText || article.sizeCode ? [article.sizeText || article.sizeCode] : [],
          preferredColors: article.color ? [article.color] : [],
        },
      });

      setAlertSuccess(isSoldOut
        ? 'Te vamos a avisar si esta prenda vuelve o aparece algo muy parecido.'
        : 'Te vamos a avisar si entra algo similar a esta prenda.');
      setAlertForm(initialAlertForm);
    } catch (err) {
      setAlertError(err.message || 'No pudimos guardar tu alerta.');
    } finally {
      setAlertSubmitting(false);
    }
  }

  return (
    <>
      <SeoHead
        title={article.seoTitle}
        description={article.seoDescription}
        canonical={canonicalUrl}
        url={canonicalUrl}
        image={toAbsoluteUrl(article.primaryImageDetail || article.primaryImage, site)}
        type="product"
        jsonLd={[
          { id: 'product', data: buildProductJsonLd(article, site) },
          { id: 'breadcrumb', data: buildBreadcrumbJsonLd(breadcrumbItems) },
        ]}
      />

      <div className="container article-page-shell page-stack">
        <nav className="breadcrumb-row" aria-label="Breadcrumb">
          <Link to="/">Inicio</Link>
          <span>/</span>
          <span>{article.categoryName || article.category?.name || 'Categoria'}</span>
          <span>/</span>
          <strong>{article.title}</strong>
        </nav>

        <section className="detail-shell detail-shell-article">
          <div className="detail-titlebar">
            <p className="section-kicker">Articulo</p>
            <h1>{article.title}</h1>
          </div>

          <div className="detail-grid detail-grid-article">
            <div className="detail-gallery-column">
              <ImageGallery images={article.images} title={article.title} />
            </div>

            <aside className="detail-sidebar detail-sidebar-article section-card">
              <div className="detail-meta-list">
                <div><span>Categoria</span><strong>{article.categoryName}</strong></div>
                <div><span>Talle</span><strong>{article.sizeText || article.sizeCode || 'No especificado'}</strong></div>
                <div><span>Marca</span><strong>{article.brandName || 'Sin marca'}</strong></div>
                <div><span>Color</span><strong>{article.color || 'No especificado'}</strong></div>
                <div><span>Material</span><strong>{article.material || 'No especificado'}</strong></div>
                <div><span>Stock disponible</span><strong>{article.quantityAvailable}</strong></div>
              </div>

              <div className="detail-pricing">
                {discounted ? <span className="price-old">{formatCurrency(article.salePrice)}</span> : null}
                <strong className="price-current price-current-large">{formatCurrency(finalPrice)}</strong>
              </div>

              {isSoldOut ? <p className="sold-out-banner">Agotado por el momento.</p> : null}
              {article.description ? <p className="muted-copy">{article.description}</p> : null}
              {feedback ? <p className="success-copy">{feedback}</p> : null}

              <div className="detail-actions detail-actions-article">
                <button
                  type="button"
                  className={`button button-primary button-compact${justAdded ? ' button-cart-added' : ''}`}
                  disabled={isSoldOut}
                  onClick={(event) => {
                    const result = addItem(article, 1, { sourceRect: event.currentTarget.getBoundingClientRect() });
                    showStockNotice(result);
                    if (!result?.ok) return;
                    setFeedback(isInCart(article.id) ? 'Se actualizo la cantidad en el carrito.' : 'Articulo agregado al carrito.');
                    setJustAdded(true);
                    void apiFetch('/api/public/article-events', {
                      method: 'POST',
                      body: {
                        articleId: article.id,
                        eventType: 'ADD_TO_CART',
                        sessionToken: getPublicSessionToken(),
                      },
                    }).catch(() => undefined);
                  }}
                >
                  {isSoldOut ? 'Agotado' : 'Lo quiero'}
                </button>

                {article.allowOffers && !isSoldOut ? (
                  <Link
                    to={`/articles/${article.slug || article.id}/offer`}
                    className="button button-secondary button-compact"
                    onClick={() => {
                      void apiFetch('/api/public/article-events', {
                        method: 'POST',
                        body: {
                          articleId: article.id,
                          eventType: 'OFFER_CLICK',
                          sessionToken: getPublicSessionToken(),
                        },
                      }).catch(() => undefined);
                    }}
                  >
                    Ofertar
                  </Link>
                ) : null}
              </div>

              <div className="detail-secondary-actions">
                <button type="button" className="ghost-button" onClick={handleWishlistToggle} disabled={wishlistLoading}>
                  {savedInWishlist ? 'Guardado' : 'Guardar'}
                </button>
                <button type="button" className="ghost-button" onClick={handleShare}>
                  Compartir
                </button>
                <button type="button" className="ghost-button" onClick={() => setAlertModalOpen(true)}>
                  {isSoldOut ? 'Avisame si vuelve o entra algo similar' : 'Avisame si entra algo similar'}
                </button>
              </div>

              {currentCartItem ? (
                <p className="muted-copy">Ya tienes {currentCartItem.quantity} unidad{currentCartItem.quantity === 1 ? '' : 'es'} de esta prenda en el carrito.</p>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="article-info-grid">
          <article className="section-card">
            <p className="section-kicker">Estado de la prenda</p>
            <h2>{article.conditionLabel || 'Segunda mano seleccionada'}</h2>
            <p className="muted-copy">{article.originNotes || 'La pieza fue revisada y curada para el catalogo de ESADAR.'}</p>
          </article>

          <article className="section-card">
            <p className="section-kicker">Medidas reales</p>
            <h2>Tomadas sobre la prenda</h2>
            <p className="muted-copy">{article.measurementsText || 'Si quieres una medida adicional, escribenos por contacto o Instagram.'}</p>
          </article>

          <article className="section-card">
            <p className="section-kicker">Como comprar</p>
            <ol className="article-steps-list">
              <li>Agregas la prenda al carrito.</li>
              <li>Completas tus datos.</li>
              <li>Elegis pago y envio.</li>
              <li>Confirmamos tu orden.</li>
            </ol>
          </article>
        </section>

        <section className="page-stack">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Relacionados</p>
              <h2>Mas prendas con el mismo pulso</h2>
            </div>
          </div>

          <div className="article-grid">
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} />
            ))}
          </div>
        </section>
      </div>

      <div className="article-mobile-cta">
        <div>
          <span className="article-mobile-cta__label">Precio</span>
          <strong>{formatCurrency(finalPrice)}</strong>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={isSoldOut}
          onClick={(event) => {
            const result = addItem(article, 1, { sourceRect: event.currentTarget.getBoundingClientRect() });
            showStockNotice(result);
            if (!result?.ok) return;
            setFeedback('Articulo agregado al carrito.');
          }}
        >
          {isSoldOut ? 'Agotado' : 'Lo quiero'}
        </button>
        {article.allowOffers && !isSoldOut ? (
          <Link to={`/articles/${article.slug || article.id}/offer`} className="button button-secondary">
            Ofertar
          </Link>
        ) : null}
      </div>

      {stockDialog ? (
        <div className="dialog-backdrop" onClick={() => setStockDialog(null)}>
          <div className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <p className="section-kicker">Stock</p>
            <h3>{stockDialog.title}</h3>
            <p className="muted-copy dialog-copy">{stockDialog.message}</p>
            <div className="dialog-actions">
              <button type="button" className="button button-primary" onClick={() => setStockDialog(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {alertModalOpen ? (
        <div className="dialog-backdrop" onClick={() => setAlertModalOpen(false)}>
          <div className="dialog-card dialog-card--success" onClick={(event) => event.stopPropagation()}>
            <p className="section-kicker">Alertas</p>
            <h3>{isSoldOut ? 'Avisame si vuelve o entra algo similar' : 'Avisame si entra algo similar'}</h3>
            <p className="muted-copy dialog-copy">
              Dejanos al menos un contacto y te avisamos si aparece una prenda que encaje con esta busqueda.
            </p>

            <form className="page-stack" onSubmit={handleStockAlertSubmit}>
              <div className="form-grid-two">
                <label className="field-group">
                  <span>Nombre</span>
                  <input className="input" value={alertForm.firstName} onChange={(event) => setAlertForm((current) => ({ ...current, firstName: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Email</span>
                  <input className="input" type="email" value={alertForm.email} onChange={(event) => setAlertForm((current) => ({ ...current, email: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>WhatsApp</span>
                  <input className="input" value={alertForm.phone} onChange={(event) => setAlertForm((current) => ({ ...current, phone: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Instagram</span>
                  <input className="input" value={alertForm.instagram} onChange={(event) => setAlertForm((current) => ({ ...current, instagram: event.target.value }))} />
                </label>
              </div>

              {alertError ? <p className="error-copy">{alertError}</p> : null}
              {alertSuccess ? <p className="success-copy">{alertSuccess}</p> : null}

              <div className="dialog-actions dialog-actions-start">
                <button type="button" className="button button-secondary" onClick={() => setAlertModalOpen(false)}>
                  Cerrar
                </button>
                <button type="submit" className="button button-primary" disabled={alertSubmitting}>
                  {alertSubmitting ? 'Guardando…' : 'Avisarme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
