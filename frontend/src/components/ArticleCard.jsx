import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  formatCurrency,
  getDiscountedPrice,
  hasDiscount,
  cn,
} from "../lib/format.js";
import { articleOfferPath, articlePath } from "../lib/routes.js";
import { useCart } from "../contexts/CartContext.jsx";
import { useWishlist } from "../contexts/WishlistContext.jsx";
import { useNotification } from "../contexts/NotificationContext.jsx";
import SmartImage from "./SmartImage.jsx";
import WishlistHeartButton from "./WishlistHeartButton.jsx";

const SHOW_CARD_BADGES = false;
const SHOW_TEXT_WISHLIST_ACTION = false;
const SHOW_CARD_OFFER_ACTION = false;
const SHOW_EDITORIAL_STATUS_BADGE = false;

export default function ArticleCard({
  article,
  view = "grid",
  variant = "default",
}) {
  const shouldReduceMotion = useReducedMotion();
  const { addItem } = useCart();
  const { isSaved, toggleItem, pendingIds } = useWishlist();
  const { notifySuccess, notifyError } = useNotification();
  const discounted = hasDiscount(article);
  const price = getDiscountedPrice(article);
  const isSoldOut =
    Number(article.quantityAvailable || 0) <= 0 ||
    article.status === "SOLD_OUT";
  const categoryName =
    article.category?.name || article.categoryName || "Sin categoria";
  const brandName = article.brand?.name || article.brandName || "";
  const sizeLabel =
    article.sizeText ||
    article.size?.code ||
    article.sizeCode ||
    "Talle no especificado";
  const conditionLabel = article.conditionLabel || "";
  const colorLabel = article.color || "";
  const materialLabel = article.material || "";
  const isUniquePiece = Number(article.quantityTotal || 0) <= 1;
  const saved = isSaved(article.id);
  const pending = pendingIds.includes(Number(article.id));
  const showOfferRibbon = article.allowOffers && !isSoldOut;
  const detailPath = articlePath(article);
  const offerPath = articleOfferPath(article);
  const imageThumb = article.imageThumbUrl || article.primaryImageThumb || "";
  const imageCard = article.imageCardUrl || article.primaryImageCard || article.primaryImage || "";
  const imageDetail = article.imageDetailUrl || article.primaryImageDetail || "";
  const imageOriginal = article.imageOriginalUrl || article.primaryImageOriginal || "";
  const cardImageSrc = imageDetail || imageCard || imageThumb || imageOriginal;
  const cardImageSrcSet = [
    imageThumb ? `${imageThumb} 320w` : null,
    imageCard ? `${imageCard} 640w` : null,
    imageDetail ? `${imageDetail} 1600w` : null,
    imageOriginal ? `${imageOriginal} 2400w` : null,
  ]
    .filter(Boolean)
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .join(", ");

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
    image: cardImageSrc || "",
    allowOffers: article.allowOffers,
  };

  async function handleWishlistToggle() {
    const wasSaved = saved;
    const result = await toggleItem(article, optimisticWishlistItem);

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

  function getCartErrorMessage(result) {
    if (result?.code === "OUT_OF_STOCK") return "Esta prenda está agotada.";
    if (result?.code === "LIMITED") {
      return "No hay stock suficiente para esa prenda.";
    }
    return result?.message || "No pudimos agregar la prenda al carrito.";
  }

  function handleAddToCart(event) {
    if (isSoldOut) {
      notifyError("Esta prenda está agotada.");
      return;
    }

    const result = addItem(article, 1, {
      sourceRect: event.currentTarget.getBoundingClientRect(),
    });

    if (!result?.ok) {
      notifyError(getCartErrorMessage(result));
      return;
    }

    notifySuccess("Articulo agregado al carrito.");
  }

  if (variant === "editorial" && view === "grid") {
    return (
      <motion.article
        className={cn(
          "article-card",
          "article-card--editorial",
          "featured-motion-card",
          isSoldOut && "article-card--sold-out",
        )}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ type: "spring", stiffness: 180, damping: 24 }}
        whileHover={shouldReduceMotion ? undefined : { y: -8, scale: 1.01 }}
      >
        <Link
          className="article-card-media--editorial featured-motion-card__link"
          to={detailPath}
        >
          {isSoldOut ? (
            <span className="article-card-ribbon">Agotado</span>
          ) : null}
          {!isSoldOut && showOfferRibbon ? (
            <span className="article-card-ribbon article-card-ribbon--offerable">
              ¡Ofertá!
            </span>
          ) : null}
          <div className="featured-motion-card__media">
            <SmartImage
              src={cardImageSrc}
              srcSet={cardImageSrcSet}
              alt={article.primaryImageAlt || article.title}
              fallbackLabel={article.title}
              loading="lazy"
              fetchPriority="low"
              sizes="(max-width: 719px) 92vw, (max-width: 1180px) 48vw, 36vw"
              className="article-card-editorial-image featured-motion-card__image"
            />
          </div>
          <span
            className="article-card-editorial-overlay featured-motion-card__overlay"
            aria-hidden="true"
          />
          <div className="article-card-editorial-copy featured-motion-card__copy">
            <p className="section-kicker">{categoryName}</p>
            <h3 className="article-card-editorial-title">{article.title}</h3>
            <div className="article-card-editorial-meta featured-motion-card__meta">
              <span>{conditionLabel || "Muy bueno"}</span>
              <strong>{formatCurrency(price)}</strong>
            </div>
            {SHOW_EDITORIAL_STATUS_BADGE && isSoldOut ? (
              <span className="article-card-editorial-status featured-motion-card__status">
                Agotado
              </span>
            ) : null}
          </div>
        </Link>

        <WishlistHeartButton
          active={saved}
          pending={pending}
          className="article-card-heart article-card-heart--editorial article-card-heart--bare"
          labelActive="Quitar de guardados"
          labelInactive="Guardar articulo"
          onToggle={() => void handleWishlistToggle()}
        />
      </motion.article>
    );
  }

  return (
    <article
      className={cn(
        "article-card",
        "article-card--catalog",
        view === "list" && "article-card-list",
        isSoldOut && "article-card--sold-out",
      )}
    >
      <div className="article-card-media-wrap">
        <Link
          className="article-card-media article-card-media--catalog"
          to={detailPath}
          aria-label={`Ver ${article.title}`}
        >
          {isSoldOut ? (
            <span className="article-card-ribbon">Agotado</span>
          ) : null}
          {!isSoldOut && showOfferRibbon ? (
            <span className="article-card-ribbon article-card-ribbon--offerable">
              ¡Ofertá!
            </span>
          ) : null}
          <SmartImage
            src={cardImageSrc}
            srcSet={cardImageSrcSet}
            alt={article.primaryImageAlt || article.title}
            fallbackLabel={article.title}
            loading="lazy"
            fetchPriority="low"
            sizes="(max-width: 719px) 48vw, (max-width: 1180px) 34vw, 360px"
          />
        </Link>

        <WishlistHeartButton
          active={saved}
          pending={pending}
          className="article-card-heart"
          labelActive="Quitar de guardados"
          labelInactive="Guardar articulo"
          onToggle={() => void handleWishlistToggle()}
        />
      </div>

      <div className="article-card-body article-card-body--catalog">
        <div
          className={
            SHOW_CARD_BADGES
              ? "article-card-tags"
              : "article-card-tags article-card-tags--hidden"
          }
          aria-hidden={!SHOW_CARD_BADGES}
        >
          {article.isFeatured ? (
            <span className="pill pill-featured">Destacado</span>
          ) : null}
          {article.acceptedOffer ? (
            <span className="pill pill-offer">Oferta aceptada</span>
          ) : article.allowOffers ? (
            <span className="pill pill-offer">¡Ofertá!</span>
          ) : null}
          {discounted ? (
            <span className="pill pill-discount">Descuento</span>
          ) : null}
          {isUniquePiece ? (
            <span className="pill pill-unique">Pieza unica</span>
          ) : null}
          {isSoldOut ? (
            <span className="pill pill-soldout">Agotado</span>
          ) : null}
        </div>

        <div className="article-card-copy article-card-copy--minimal">
          <h3 className="article-card-title article-card-title--plain">
            {article.title}
          </h3>
        </div>

        <div className="article-card-pricebox">
          <span className="price-current">
            {article.acceptedOffer
              ? formatCurrency(
                  article.acceptedOffer.price ||
                    article.acceptedOffer.offeredAmount,
                )
              : formatCurrency(price)}
          </span>
          {article.acceptedOffer || discounted ? (
            <span className="price-old">
              {formatCurrency(article.salePrice)}
            </span>
          ) : null}
          {article.acceptedOffer ? (
            <span className="muted-copy">
              Tenes una oferta aceptada - aplica a 1 unidad
            </span>
          ) : null}
        </div>

        <div className="article-card-actions article-card-actions--catalog">
          {!isSoldOut ? (
            <button
              type="button"
              className="button button-primary button-compact"
              onClick={handleAddToCart}
            >
              Agregar al carrito
            </button>
          ) : (
            <button
              type="button"
              className="button button-secondary button-compact article-card-soldout-button"
              disabled
            >
              Agotado
            </button>
          )}
          {SHOW_TEXT_WISHLIST_ACTION ? (
            <button
              type="button"
              className={
                saved
                  ? "button button-secondary button-compact is-active"
                  : "button button-secondary button-compact"
              }
              onClick={() => void handleWishlistToggle()}
              disabled={pending}
            >
              {saved ? "Guardado" : "Guardar"}
            </button>
          ) : null}
          {SHOW_CARD_OFFER_ACTION && article.allowOffers && !isSoldOut ? (
            <Link
              to={offerPath}
              className="button button-secondary button-compact"
            >
              Ofertar
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
