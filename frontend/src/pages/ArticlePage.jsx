import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useOutletContext,
  useParams,
} from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import ArticleCard from "../components/ArticleCard.jsx";
import ArticleImageGallery from "../components/ArticleImageGallery.jsx";
import ScrollRailControls from "../components/ScrollRailControls.jsx";
import { EditIcon } from "../components/ActionIcons.jsx";
import { apiFetch } from "../lib/api.js";
import {
  formatCurrency,
  getDiscountedPrice,
  hasDiscount,
} from "../lib/format.js";
import { articleOfferPath } from "../lib/routes.js";
import { useCart } from "../contexts/CartContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { useWishlist } from "../contexts/WishlistContext.jsx";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import { useNotification } from "../contexts/NotificationContext.jsx";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  sanitizePublicUrl,
  toAbsoluteUrl,
} from "../lib/seo.js";
import { getPublicSessionToken } from "../lib/publicSession.js";
import { trackPublicPageVisit } from "../lib/pageVisits.js";
import {
  focusValidationTarget,
  getEmailValidationMessage,
  notifyFormStatus,
} from "../lib/validation.js";
import WishlistHeartButton from "../components/WishlistHeartButton.jsx";
import AppLoader from "../components/AppLoader.jsx";

const ARTICLE_SHARE_TITLE = "ESADAR | Tienda de ropa";

const initialAlertForm = {
  firstName: "",
  email: "",
  phone: "",
  instagram: "",
};

function normalizeSharePart(value, fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function formatSharePrice(value) {
  return formatCurrency(value).replace(/\s+/g, " ").trim();
}

function buildArticleShareSummary(article, finalPrice) {
  const articleName = normalizeSharePart(article?.title, "Prenda ESADAR");
  const sizeLabel = normalizeSharePart(
    article?.sizeText || article?.sizeCode,
    "Talle sin especificar",
  );
  return `${articleName} · ${sizeLabel} · ${formatSharePrice(finalPrice)}`;
}

function buildArticleShareText(article, finalPrice) {
  const summary = buildArticleShareSummary(article, finalPrice);

  if (Boolean(article?.allowOffers)) {
    return `ESADAR acepta ofertas sobre este artículo!\n${summary}`;
  }

  return summary;
}

function buildArticleShareClipboardText(article, finalPrice, canonicalUrl) {
  return `${buildArticleShareText(article, finalPrice)}\n${canonicalUrl}`;
}

export default function ArticlePage() {
  const { slugOrId } = useParams();
  const location = useLocation();
  const { setBreadcrumbLabelOverrides } = useOutletContext();
  const relatedTrackRef = useRef(null);
  const stockAlertPanelRef = useRef(null);
  const stockAlertFirstFieldRef = useRef(null);
  const { addItem, getItem } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { site } = useSiteSeo();
  const { isSaved, toggleItem, pendingIds } = useWishlist();
  const { notifyMobileStatus } = useMobileMenu();
  const { notifySuccess, notifyError, notifyInfo } = useNotification();
  const [article, setArticle] = useState(null);
  const [relatedState, setRelatedState] = useState({
    mode: "empty",
    categoryName: "",
    items: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [alertInlineOpen, setAlertInlineOpen] = useState(false);
  const [alertForm, setAlertForm] = useState(initialAlertForm);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState("");
  const [alertSuccess, setAlertSuccess] = useState("");
  const [acceptedOffer, setAcceptedOffer] = useState(null);
  const canEditArticle = user?.roles?.some((role) =>
    ["SUPER_ADMIN", "ADMIN", "OPERATOR"].includes(role),
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slugOrId]);

  useEffect(() => {
    if (!article?.title || !setBreadcrumbLabelOverrides) return undefined;

    const currentPath = location.pathname;
    const canonicalPath = `/articles/${article.slug || slugOrId}`;

    setBreadcrumbLabelOverrides((current) => ({
      ...current,
      [currentPath]: article.title,
      [canonicalPath]: article.title,
    }));

    return () => {
      setBreadcrumbLabelOverrides((current) => {
        const next = { ...current };
        delete next[currentPath];
        delete next[canonicalPath];
        return next;
      });
    };
  }, [
    article?.slug,
    article?.title,
    location.pathname,
    setBreadcrumbLabelOverrides,
    slugOrId,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadArticle() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/public/articles/${slugOrId}`);
        if (ignore) return;
        setArticle(response.article);
        setAcceptedOffer(null);
        trackPublicPageVisit({
          pageType: "ARTICLE_DETAIL",
          route: `/articles/${response.article.slug || response.article.id}`,
          articleId: response.article.id,
        });

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

  useEffect(() => {
    let ignore = false;

    async function loadAcceptedOffer() {
      if (!isAuthenticated || !article?.id) {
        setAcceptedOffer(null);
        return;
      }

      try {
        const response = await apiFetch("/api/public/offers/accepted");
        if (ignore) return;
        const match = (response.items || []).find(
          (item) => Number(item.article?.id) === Number(article.id),
        );
        setAcceptedOffer(match || null);
      } catch {
        if (!ignore) setAcceptedOffer(null);
      }
    }

    loadAcceptedOffer();
    return () => {
      ignore = true;
    };
  }, [article?.id, isAuthenticated]);

  useEffect(() => {
    if (!alertInlineOpen) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      stockAlertPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      stockAlertFirstFieldRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [alertInlineOpen]);

  if (loading) {
    return (
      <div className="container section-card centered-card">
        <AppLoader variant="page" label="Cargando prenda" />
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
  const articleStatus = String(article.status || "ACTIVE").toUpperCase();
  const isSoldOut =
    Number(article.quantityAvailable || 0) <= 0 ||
    articleStatus === "SOLD_OUT";
  const isUnavailable =
    Boolean(article.isUnavailable) ||
    !["ACTIVE", "SOLD_OUT"].includes(articleStatus);
  const currentCartItem = getItem(article.id);
  const articleForCart = acceptedOffer
    ? {
        ...article,
        acceptedOffer: {
          id: acceptedOffer.id,
          price: Number(acceptedOffer.offeredAmount),
          quantity: 1,
        },
      }
    : article;
  const savedInWishlist = isSaved(article.id);
  const wishlistPending = pendingIds.includes(Number(article.id));
  const canonicalUrl =
    sanitizePublicUrl(article.canonicalUrl) ||
    toAbsoluteUrl(`/articles/${article.slug || article.id}`, site);
  const breadcrumbItems = [
    { name: "Inicio", url: toAbsoluteUrl("/", site) },
    {
      name: article.categoryName || article.category?.name || "Categoría",
      url: toAbsoluteUrl("/", site),
    },
    { name: article.title, url: canonicalUrl },
  ];

  if (isUnavailable) {
    const unavailableMessage =
      articleStatus === "RESERVED"
        ? "Esta prenda ya está reservada y no se puede comprar en este momento."
        : "Esta prenda ya no está publicada o no se encuentra disponible para compra.";

    return (
      <>
        <SeoHead
          title={`${article.title} no disponible`}
          ogTitle={ARTICLE_SHARE_TITLE}
          description={unavailableMessage}
          canonical={canonicalUrl}
          url={canonicalUrl}
          image={toAbsoluteUrl(
            article.primaryImageDetail || article.primaryImage,
            site,
          )}
          type="product"
          jsonLd={[
            { id: "breadcrumb", data: buildBreadcrumbJsonLd(breadcrumbItems) },
          ]}
        />

        <div className="container article-unavailable-page page-stack">
          <section className="section-card article-unavailable-card">
            <div className="article-unavailable-card__media">
              <ArticleImageGallery
                images={article.images}
                title={article.title}
                fallbackImage={article}
              />
            </div>

            <div className="article-unavailable-card__content page-stack-sm">
              <p className="section-kicker">Artículo no disponible</p>
              <h1>{article.title}</h1>
              <p className="muted-copy">{unavailableMessage}</p>

              <div className="detail-meta-list article-unavailable-meta">
                <div>
                  <span>Estado</span>
                  <strong>No disponible</strong>
                </div>
                <div>
                  <span>Marca</span>
                  <strong>{article.brandName || "Sin marca"}</strong>
                </div>
                <div>
                  <span>Talle</span>
                  <strong>
                    {article.sizeText || article.sizeCode || "No especificado"}
                  </strong>
                </div>
              </div>

              <div className="detail-actions detail-actions--stacked">
                <Link to="/" className="button button-primary">
                  Ver catálogo disponible
                </Link>
                <button
                  type="button"
                  className="button button-secondary article-stock-alert-button"
                  onClick={openStockAlertForm}
                >
                  Avisame si entra algo similar
                </button>
              </div>

              {alertInlineOpen ? (
                <section
                  ref={stockAlertPanelRef}
                  className="section-card page-stack-sm stock-alert-inline-panel"
                >
                  <div>
                    <p className="section-kicker">Seguimiento</p>
                    <h3>Avisame si entra algo similar</h3>
                  </div>
                  {renderStockAlertForm({ inline: true })}
                </section>
              ) : null}
            </div>
          </section>

          {relatedState.items.length ? (
            <section className="page-stack article-related-scroll-section">
              <div className="section-heading section-heading-wrap">
                <div>
                  <p className="section-kicker">Alternativas</p>
                  <h2>Prendas similares disponibles</h2>
                </div>
                <ScrollRailControls
                  targetRef={relatedTrackRef}
                  className="scroll-rail-controls--left"
                />
              </div>

              <div
                ref={relatedTrackRef}
                className="related-articles-track article-horizontal-card-track"
              >
                {relatedState.items.map((item) => (
                  <div key={item.id} className="related-articles-track__item">
                    <ArticleCard article={item} view="grid" variant="default" />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </>
    );
  }

  function isMobileViewport() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 780px)").matches
    );
  }

  function openStockAlertForm() {
    setAlertError("");
    setAlertSuccess("");
    setAlertInlineOpen((current) => !current);
  }

  function showStockNotice(result) {
    if (!result || result.ok) return;

    const nextDialog =
      result.code === "OUT_OF_STOCK"
        ? {
            title: "Articulo agotado",
            message: "Esta prenda no tiene stock disponible ahora.",
          }
        : {
            title: "Stock maximo alcanzado",
            message: `Solo hay ${result.maxQuantity} unidad${result.maxQuantity === 1 ? "" : "es"} disponible${result.maxQuantity === 1 ? "" : "s"} para esta prenda.`,
          };

    notifyError(nextDialog.message);
  }

  async function handleWishlistToggle() {
    const wasSaved = savedInWishlist;
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

    if (!result.ok) {
      notifyError(
        result.error?.message || "No pudimos actualizar tus guardados.",
      );
      return;
    }

    notifySuccess(
      wasSaved
        ? "Quitamos la prenda de tus guardados."
        : "La prenda quedo guardada.",
    );
  }

  async function handleShare() {
    if (!canonicalUrl) {
      notifyError("No pudimos generar un enlace público para compartir.");
      return;
    }

    const shareText = buildArticleShareText(article, finalPrice);
    const shareData = {
      title: ARTICLE_SHARE_TITLE,
      text: `${shareText}\n`,
      url: canonicalUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          buildArticleShareClipboardText(article, finalPrice, canonicalUrl),
        );
        notifyInfo("Copiamos el texto para compartir.");
      } else {
        notifyInfo("Selecciona y copia el enlace desde la barra del navegador.");
      }

      await apiFetch("/api/public/article-events", {
        method: "POST",
        body: {
          articleId: article.id,
          eventType: "SHARE",
          sessionToken: getPublicSessionToken(),
        },
      }).catch(() => undefined);
    } catch (err) {
      if (err?.name === "AbortError") return;
      notifyError("No pudimos compartir el enlace ahora.");
    }
  }

  async function handleStockAlertSubmit(event) {
    event.preventDefault();

    try {
      const validationChecks = [
        {
          target: "stock-alert-first-name",
          message: String(alertForm.firstName || "").trim()
            ? ""
            : "Completa nombre.",
        },
        {
          target: "stock-alert-email",
          message: String(alertForm.email || "").trim()
            ? ""
            : "Completa email.",
        },
        {
          target: "stock-alert-phone",
          message: String(alertForm.phone || "").trim()
            ? ""
            : "Completa WhatsApp.",
        },
        {
          target: "stock-alert-email",
          message: getEmailValidationMessage(alertForm.email),
        },
      ];
      const validationIssue = validationChecks.find((check) =>
        Boolean(check.message),
      );
      if (validationIssue) {
        setAlertError(validationIssue.message);
        focusValidationTarget(validationIssue.target, event.currentTarget);
        if (isMobileViewport()) {
          notifyFormStatus(
            notifyMobileStatus,
            "error",
            validationIssue.message,
          );
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
          email: alertForm.email,
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
        className={
          inline
            ? "page-stack stock-alert-inline-form"
            : "page-stack stock-alert-modal-form"
        }
        onSubmit={handleStockAlertSubmit}
        noValidate
      >
        <div className="admin-filter-grid stock-alert-form-grid">
          <label className="field-group">
            <span>Nombre</span>
            <input
              ref={inline ? stockAlertFirstFieldRef : undefined}
              className="input"
              name="firstName"
              data-validation-field="stock-alert-first-name"
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
              name="email"
              data-validation-field="stock-alert-email"
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
              name="phone"
              data-validation-field="stock-alert-phone"
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
              name="instagram"
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
        ogTitle={ARTICLE_SHARE_TITLE}
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
        {/* <nav className="breadcrumb-row" aria-label="Breadcrumb">
          <Link to="/">Inicio</Link>
          <span>/</span>
          <span>
            {article.categoryName || article.category?.name || "Categoría"}
          </span>
          <span>/</span>
          <strong>{article.title}</strong>
        </nav> */}

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

              {canEditArticle ? (
                <Link
                  to={`/admin/articles/${article.id}/edit`}
                  className="button button-secondary article-admin-edit-button"
                >
                  <EditIcon />
                  <span>Editar artículo</span>
                </Link>
              ) : null}

              <div className="detail-meta-list">
                <div>
                  <span>Estado</span>
                  <strong>
                    <span className="status-badge status-available">
                      {article.conditionLabel || "Muy bueno"}
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

            {acceptedOffer ? (
              <div className="article-status-notice article-status-notice--offer" role="status">
                <span className="article-status-notice__badge">Oferta aceptada</span>
                <span>
                  Precio aceptado: {formatCurrency(acceptedOffer.offeredAmount)}.
                  Aplica a 1 unidad.
                </span>
              </div>
            ) : null}

            {currentCartItem ? (
              <div className="article-status-notice article-status-notice--cart" role="status">
                <span className="article-status-notice__badge">En carrito</span>
                <span>
                  Ya tienes {currentCartItem.quantity} unidad
                  {currentCartItem.quantity === 1 ? "" : "es"} de esta prenda en
                  el carrito.
                </span>
              </div>
            ) : null}

            <div className="detail-actions detail-actions--stacked">
              <button
                type="button"
                className="button button-primary"
                disabled={isSoldOut}
                onClick={(event) => {
                  const result = addItem(articleForCart, 1, {
                    sourceRect: event.currentTarget.getBoundingClientRect(),
                  });
                  showStockNotice(result);
                  if (result?.ok) {
                    notifySuccess("Articulo agregado al carrito.");
                  }
                }}
              >
                {isSoldOut ? "Agotado" : "Agregar al carrito"}
              </button>

              {article.allowOffers && !isSoldOut ? (
                <Link
                  to={isAuthenticated ? articleOfferPath(article) : "/login"}
                  state={
                    !isAuthenticated
                      ? { from: { pathname: articleOfferPath(article) } }
                      : undefined
                  }
                  className="button footer-scroll-scene__copy footer-scroll-scene__copy--about"
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
              <section
                ref={stockAlertPanelRef}
                className="section-card page-stack-sm stock-alert-inline-panel"
              >
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
                  <span className="section-kicker">Cómo comprar</span>
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
                    "La pieza fue revisada y curada para el catálogo de ESADAR."}
                </p>
              </div>
            </div> */}
          </aside>
        </section>

        {relatedState.items.length ? (
          <section className="page-stack article-related-scroll-section">
            <div className="section-heading section-heading-wrap">
              <div>
                <p className="section-kicker">Relacionados</p>
                <h2>Artículos relacionados</h2>
                {/* {relatedState.categoryName ? (
                  <p className="muted-copy">
                    Mas de {relatedState.categoryName}
                  </p>
                ) : null} */}
              </div>
              <ScrollRailControls
                targetRef={relatedTrackRef}
                className="scroll-rail-controls--left"
              />
            </div>

            <div
              ref={relatedTrackRef}
              className="related-articles-track article-horizontal-card-track"
            >
              {relatedState.items.map((item) => (
                <div key={item.id} className="related-articles-track__item">
                  <ArticleCard article={item} view="grid" variant="default" />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
