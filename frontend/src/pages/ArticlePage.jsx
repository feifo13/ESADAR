import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import ArticleCard from "../components/ArticleCard.jsx";
import ArticleImageGallery from "../components/ArticleImageGallery.jsx";
import { apiFetch } from "../lib/api.js";
import {
  formatCurrency,
  getDiscountedPrice,
  hasDiscount,
} from "../lib/format.js";
import { articleOfferPath } from "../lib/routes.js";
import { useCart } from "../contexts/CartContext.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { useWishlist } from "../contexts/WishlistContext.jsx";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  toAbsoluteUrl,
} from "../lib/seo.js";
import { getPublicSessionToken } from "../lib/publicSession.js";
import { firstValidationMessage, getEmailValidationMessage, notifyFormStatus } from "../lib/validation.js";
import WishlistHeartButton from "../components/WishlistHeartButton.jsx";

const initialAlertForm = {
  firstName: "",
  email: "",
  phone: "",
  instagram: "",
};

export default function ArticlePage() {
  const { slugOrId } = useParams();
  const { addItem, getItem } = useCart();
  const { site } = useSiteSeo();
  const { isSaved, toggleItem, pendingIds } = useWishlist();
  const { notifyMobileStatus } = useMobileMenu();
  const [article, setArticle] = useState(null);
  const [relatedState, setRelatedState] = useState({
    mode: "empty",
    categoryName: "",
    items: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [stockDialog, setStockDialog] = useState(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertInlineOpen, setAlertInlineOpen] = useState(false);
  const [alertForm, setAlertForm] = useState(initialAlertForm);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState("");
  const [alertSuccess, setAlertSuccess] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slugOrId]);

  useEffect(() => {
    let ignore = false;

    async function loadArticle() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/public/articles/${slugOrId}`);
        if (ignore) return;
        setArticle(response.article);

        const relatedResponse = await apiFetch(
          `/api/public/articles/${slugOrId}/related?limit=4`,
        );
        if (!ignore) {
          setRelatedState({
            mode: relatedResponse.mode || "empty",
            categoryName:
              relatedResponse.categoryName ||
              response.article.categoryName ||
              "",
            items: relatedResponse.items || [],
          });
        }

        await apiFetch("/api/public/article-events", {
          method: "POST",
          body: {
            articleId: response.article.id,
            eventType: "VIEW",
            sessionToken: getPublicSessionToken(),
          },
        }).catch(() => undefined);
      } catch (err) {
        if (!ignore) setError(err.message || "No se pudo cargar la prenda.");
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
    return (
      <div className="container section-card centered-card">
        Cargando prenda...
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container section-card error-card">
        {error || "Articulo no encontrado"}
      </div>
    );
  }

  const discounted = hasDiscount(article);
  const finalPrice = getDiscountedPrice(article);
  const isSoldOut =
    Number(article.quantityAvailable || 0) <= 0 ||
    article.status === "SOLD_OUT";
  const currentCartItem = getItem(article.id);
  const savedInWishlist = isSaved(article.id);
  const wishlistPending = pendingIds.includes(Number(article.id));
  const canonicalUrl =
    article.canonicalUrl ||
    toAbsoluteUrl(`/articles/${article.slug || article.id}`, site);
  const breadcrumbItems = [
    { name: "Inicio", url: toAbsoluteUrl("/", site) },
    {
      name: article.categoryName || article.category?.name || "Categoria",
      url: toAbsoluteUrl("/", site),
    },
    { name: article.title, url: canonicalUrl },
  ];

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 780px)").matches;
  }

  function openStockAlertForm() {
    setAlertError("");
    setAlertSuccess("");
    if (isMobileViewport()) {
      setAlertInlineOpen((current) => !current);
      setAlertModalOpen(false);
      return;
    }
    setAlertInlineOpen(false);
    setAlertModalOpen(true);
  }

  function showStockNotice(result) {
    if (!result || result.ok) return;

    const nextDialog = result.code === "OUT_OF_STOCK"
      ? {
          title: "Articulo agotado",
          message: "Esta prenda no tiene stock disponible ahora.",
        }
      : {
          title: "Stock maximo alcanzado",
          message: `Solo hay ${result.maxQuantity} unidad${result.maxQuantity === 1 ? "" : "es"} disponible${result.maxQuantity === 1 ? "" : "s"} para esta prenda.`,
        };

    if (isMobileViewport()) {
      setStockDialog(null);
      notifyMobileStatus({ type: "error", icon: "error", message: nextDialog.message });
      return;
    }

    setStockDialog(nextDialog);
  }

  async function handleWishlistToggle() {
    const result = await toggleItem(article, {
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
      sizeLabel: article.sizeText || article.sizeCode || "",
      image: article.primaryImage || "",
      allowOffers: article.allowOffers,
    });

    // if (!result.ok) {
    //   setFeedback("No pudimos actualizar tus guardados.");
    //   return;
    // }

    // setFeedback(
    //   savedInWishlist
    //     ? "Quitamos la prenda de tus guardados."
    //     : "La prenda quedo guardada.",
    // );
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
        setFeedback("Copiamos el enlace para compartir.");
      }

      await apiFetch("/api/public/article-events", {
        method: "POST",
        body: {
          articleId: article.id,
          eventType: "SHARE",
          sessionToken: getPublicSessionToken(),
        },
      }).catch(() => undefined);
    } catch {
      setFeedback("No pudimos compartir el enlace ahora.");
    }
  }

  async function handleStockAlertSubmit(event) {
    event.preventDefault();

    try {
      const validationMessage = firstValidationMessage(
        String(alertForm.firstName || "").trim() ? "" : "Completa nombre.",
        String(alertForm.email || "").trim() ? "" : "Completa email.",
        String(alertForm.phone || "").trim() ? "" : "Completa WhatsApp.",
        getEmailValidationMessage(alertForm.email),
      );
      if (validationMessage) {
        setAlertError(validationMessage);
        if (isMobileViewport()) {
          notifyFormStatus(notifyMobileStatus, "error", validationMessage);
        }
        return;
      }

      setAlertSubmitting(true);
      setAlertError("");
      setAlertSuccess("");

      await apiFetch("/api/public/leads/stock-alert", {
        method: "POST",
        body: {
          articleId: article.id,
          alertType: isSoldOut ? "BACK_IN_STOCK" : "SIMILAR_ITEMS",
          firstName: alertForm.firstName || null,
          email: alertForm.email || null,
          phone: alertForm.phone || null,
          instagram: alertForm.instagram || null,
          preferredCategories: article.categoryName
            ? [article.categoryName]
            : [],
          preferredBrands: article.brandName ? [article.brandName] : [],
          preferredSizes:
            article.sizeText || article.sizeCode
              ? [article.sizeText || article.sizeCode]
              : [],
          preferredColors: article.color ? [article.color] : [],
        },
      });

      const successMessage = isSoldOut
        ? "Alerta guardada: te avisamos si vuelve o entra algo similar."
        : "Alerta guardada: te avisamos si entra algo similar.";
      setAlertSuccess(successMessage);
      setAlertForm(initialAlertForm);
      if (isMobileViewport()) {
        setAlertInlineOpen(false);
        notifyFormStatus(notifyMobileStatus, "success", successMessage);
      }
    } catch (err) {
      const errorMessage = err.message || "No pudimos guardar tu alerta.";
      setAlertError(errorMessage);
      if (isMobileViewport()) {
        notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      }
    } finally {
      setAlertSubmitting(false);
    }
  }

  function renderStockAlertForm({ inline = false } = {}) {
    return (
      <form
        className={inline ? "page-stack stock-alert-inline-form" : "page-stack stock-alert-modal-form"}
        onSubmit={handleStockAlertSubmit}
        noValidate
      >
        <div className="admin-filter-grid stock-alert-form-grid">
          <label className="field-group">
            <span>Nombre</span>
            <input
              className="input"
              value={alertForm.firstName}
              required
              onChange={(event) =>
                setAlertForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
            />
          </label>
          <label className="field-group">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={alertForm.email}
              required
              onChange={(event) =>
                setAlertForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </label>
          <label className="field-group">
            <span>WhatsApp</span>
            <input
              className="input"
              value={alertForm.phone}
              required
              onChange={(event) =>
                setAlertForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </label>
          <label className="field-group">
            <span>Instagram</span>
            <input
              className="input"
              value={alertForm.instagram}
              onChange={(event) =>
                setAlertForm((current) => ({
                  ...current,
                  instagram: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="dialog-actions stock-alert-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setAlertInlineOpen(false);
              setAlertModalOpen(false);
            }}
          >
            Cerrar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={alertSubmitting}
          >
            {alertSubmitting ? "Guardando..." : "Guardar alerta"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <SeoHead
        title={article.seoTitle}
        description={article.seoDescription}
        canonical={canonicalUrl}
        url={canonicalUrl}
        image={toAbsoluteUrl(
          article.primaryImageDetail || article.primaryImage,
          site,
        )}
        type="product"
        jsonLd={[
          { id: "product", data: buildProductJsonLd(article, site) },
          { id: "breadcrumb", data: buildBreadcrumbJsonLd(breadcrumbItems) },
        ]}
      />

      <div className="container article-page-shell page-stack">
        <nav className="breadcrumb-row" aria-label="Breadcrumb">
          <Link to="/">Inicio</Link>
          <span>/</span>
          <span>
            {article.categoryName || article.category?.name || "Categoria"}
          </span>
          <span>/</span>
          <strong>{article.title}</strong>
        </nav>

        <section className="ebay-article-layout">
          <div className="ebay-article-layout__gallery">
            <ArticleImageGallery
              images={article.images}
              title={article.title}
              fallbackImage={article}
            />

            <WishlistHeartButton
              active={savedInWishlist}
              pending={wishlistPending}
              className="article-gallery-favorite wishlist-heart-button--bare"
              size="lg"
              labelActive="Quitar de guardados"
              labelInactive="Guardar articulo"
              onToggle={() => void handleWishlistToggle()}
            />
          </div>

          <aside className="ebay-article-layout__sidebar section-card">
            <div className="page-stack-sm">
              <div className="page-stack-sm">
                <p className="section-kicker">Prenda</p>
                <h1>{article.title}</h1>
              </div>

              <div className="detail-meta-list">
                <div>
                  <span>Estado</span>
                  <strong>
                    <span className="status-badge status-available">
                      {article.conditionLabel || "Second hand seleccionada"}
                    </span>
                  </strong>
                </div>
                <div>
                  <span>Talle</span>
                  <strong>
                    {article.sizeText || article.sizeCode || "No especificado"}
                  </strong>
                </div>
                <div>
                  <span>Color</span>
                  <strong>{article.color || "No especificado"}</strong>
                </div>
                {/* <div>
                  <span>Material</span>
                  <strong>{article.material || "No especificado"}</strong>
                </div> */}
                <div>
                  <span>Marca</span>
                  <strong>{article.brandName || "Sin marca"}</strong>
                </div>
                <div>
                  <span>Stock</span>
                  <strong>
                    {isSoldOut
                      ? "Agotado"
                      : `${article.quantityAvailable} disponibles`}
                  </strong>
                </div>
                <div>
                  <span>Precio</span>
                  <div className="detail-pricing">
                    {discounted ? (
                      <span className="price-old">
                        {formatCurrency(article.salePrice)}
                      </span>
                    ) : null}
                    <strong>{formatCurrency(finalPrice)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* <div className="detail-pricing detail-pricing--hero">
              {discounted ? <span className="price-old">{formatCurrency(article.salePrice)}</span> : null}
              <strong className="price-current price-current-large">{formatCurrency(finalPrice)}</strong>
            </div> */}

            {currentCartItem ? (
              <p className="checkbox-row-accent">
                Ya tienes {currentCartItem.quantity} unidad
                {currentCartItem.quantity === 1 ? "" : "es"} de esta prenda en
                el carrito.
              </p>
            ) : null}

            <div className="detail-actions detail-actions--stacked">
              <button
                type="button"
                className="button button-primary"
                disabled={isSoldOut}
                onClick={(event) => {
                  const result = addItem(article, 1, {
                    sourceRect: event.currentTarget.getBoundingClientRect(),
                  });
                  showStockNotice(result);
                  if (result?.ok) {
                    const successMessage = "Articulo agregado al carrito.";
                    setFeedback(successMessage);
                    if (isMobileViewport()) {
                      notifyFormStatus(notifyMobileStatus, "success", successMessage);
                    }
                  }
                }}
              >
                {isSoldOut ? "Agotado" : "Agregar al carrito"}
              </button>

              {article.allowOffers && !isSoldOut ? (
                <Link
                  to={articleOfferPath(article)}
                  className="button button-secondary"
                  onClick={() => {
                    void apiFetch("/api/public/article-events", {
                      method: "POST",
                      body: {
                        articleId: article.id,
                        eventType: "OFFER_CLICK",
                        sessionToken: getPublicSessionToken(),
                      },
                    }).catch(() => undefined);
                  }}
                >
                  Ofertar
                </Link>
              ) : null}

              <button
                type="button"
                className="button button-secondary"
                onClick={handleShare}
              >
                Compartir
              </button>

              <button
                type="button"
                className="button button-secondary article-stock-alert-button"
                onClick={openStockAlertForm}
              >
                {isSoldOut
                  ? "Avisame si vuelve o entra algo similar"
                  : "Avisame si entra algo similar"}
              </button>
            </div>

            {alertInlineOpen ? (
              <section className="section-card page-stack-sm stock-alert-inline-panel">
                <div>
                  <p className="section-kicker">Seguimiento</p>
                  <h3>
                    {isSoldOut
                      ? "Avisame si vuelve o entra algo similar"
                      : "Avisame si entra algo similar"}
                  </h3>
                </div>
                {renderStockAlertForm({ inline: true })}
              </section>
            ) : null}

            {/* <div className="section-card page-stack-sm article-side-note article-info-accordion">
              <details>
                <summary>
                  <span className="section-kicker">Como comprar</span>
                  <span aria-hidden="true">+</span>
                </summary>
                <ol className="article-steps-list">
                  <li>Agregas la prenda al carrito.</li>
                  <li>Completas tus datos.</li>
                  <li>Elegis pago y envio.</li>
                  <li>Confirmamos tu orden.</li>
                </ol>
              </details>
              <div>
                <p className="section-kicker">Medidas reales</p>
                <p className="muted-copy">
                  {article.measurementsText ||
                    "Si quieres una medida adicional, escribenos por contacto o Instagram."}
                </p>
              </div>
              <div>
                <p className="section-kicker">Estado de la prenda</p>
                <p className="muted-copy">
                  {article.originNotes ||
                    "La pieza fue revisada y curada para el catalogo de ESADAR."}
                </p>
              </div>
            </div> */}
          </aside>
        </section>

        {relatedState.items.length ? (
          <section className="page-stack article-related-scroll-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Relacionados</p>
                <h2>Artículos relacionados</h2>
                {/* {relatedState.categoryName ? (
                  <p className="muted-copy">
                    Mas de {relatedState.categoryName}
                  </p>
                ) : null} */}
              </div>
            </div>

            <div className="related-articles-track article-horizontal-card-track">
              {relatedState.items.map((item) => (
                <div key={item.id} className="related-articles-track__item">
                  <ArticleCard article={item} view="grid" variant="default" />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {stockDialog ? (
        <div className="dialog-backdrop" onClick={() => setStockDialog(null)}>
          <div
            className="dialog-card"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="section-kicker">Stock</p>
            <h3>{stockDialog.title}</h3>
            <p className="muted-copy dialog-copy">{stockDialog.message}</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => setStockDialog(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {alertModalOpen ? (
        <div
          className="dialog-backdrop dialog-backdrop--stock-alert"
          onClick={() => setAlertModalOpen(false)}
        >
          <div
            className="dialog-card dialog-card--wide stock-alert-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="section-kicker">Seguimiento</p>
            <h3>
              {isSoldOut
                ? "Avisame si vuelve o entra algo similar"
                : "Avisame si entra algo similar"}
            </h3>
            {renderStockAlertForm()}
          </div>
        </div>
      ) : null}
    </>
  );
}
