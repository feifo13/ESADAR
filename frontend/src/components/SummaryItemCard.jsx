import { Link } from "react-router-dom";
import SmartImage from "./SmartImage.jsx";
import { cn, formatCurrency } from "../lib/format.js";

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 15H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function CheckoutSummaryItemCard({
  item,
  onQuantityChange,
  onRemove,
  readOnly = false,
  isUnavailable = false,
}) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const maxQuantity = Math.max(quantity, Number(item.maxQuantity || quantity));
  const unitPrice = Number(item.discountedPrice || 0);
  const originalPrice = Number(item.salePrice || 0);
  const lineTotal = Number(item.lineTotal ?? unitPrice * quantity);
  const hasAcceptedOffer = Boolean(item.acceptedOffer);
  const lineKey = String(item.cartLineKey ?? item.id ?? item.articleId);
  const offerPrice = hasAcceptedOffer
    ? Number(item.acceptedOffer.price || unitPrice)
    : unitPrice;
  const offerSavings = hasAcceptedOffer
    ? Math.max(0, originalPrice - offerPrice)
    : 0;
  const offerQuantity = hasAcceptedOffer
    ? Math.max(1, Number(item.acceptedOffer.quantity || item.acceptedOffer.appliedQuantity || 1))
    : 1;
  const displayUnitPrice = hasAcceptedOffer ? offerPrice : unitPrice;
  const hasDiscount = originalPrice > displayUnitPrice;
  const articlePath = `/articles/${encodeURIComponent(String(item.slug || item.articleId))}`;

  function handleQuantityInput(event) {
    onQuantityChange(lineKey, Number(event.target.value || 1));
  }

  return (
    <article
      className={cn(
        "summary-item-card",
        hasAcceptedOffer ? "summary-item-card--accepted-offer" : "",
        isUnavailable ? "summary-item-card--unavailable" : "",
      )}
    >
      <Link
        to={articlePath}
        className="summary-item-card__media"
        aria-label={`Ver ${item.title}`}
      >
        <SmartImage
          src={item.image}
          alt={item.title}
          fallbackLabel={item.title}
          className="summary-item-card__image"
        />
      </Link>

      <div className="summary-item-card__body">
        {isUnavailable ? (
          <span className="summary-item-card__badge status-badge status-unavailable">
            No disponible
          </span>
        ) : hasAcceptedOffer ? (
          <span className="summary-item-card__badge pill pill-offer">
            Oferta aceptada
          </span>
        ) : null}
        <Link to={articlePath} className="summary-item-card__title">
          {item.title}
        </Link>
        <p className="summary-item-card__meta">
          {item.brandName || "Sin marca"} · {item.sizeLabel || "Sin talle"}
        </p>

        <div className="summary-item-card__total" aria-label="Precio unitario">
          <p className="summary-item-card__meta">Precio unitario: </p>
          {hasDiscount ? (
            <span className="price-old">{formatCurrency(originalPrice)}</span>
          ) : null}
          <strong> {formatCurrency(displayUnitPrice)}</strong>
          {/* {hasAcceptedOffer ? <span className="summary-item-card__meta"> oferta x1 · ahorro {formatCurrency(offerSavings)}</span> : null} */}
        </div>

        {isUnavailable ? (
          <p className="summary-item-card__price-row summary-item-card__price-row--unavailable">
            Fuera del total de la orden.
          </p>
        ) : (
          <p className="summary-item-card__price-row">
            Total: <strong>{formatCurrency(lineTotal)}</strong>
          </p>
        )}
        {hasAcceptedOffer ? (
          <p className="summary-item-card__meta">
            La oferta aplica a <strong>{offerQuantity}</strong> unidad{offerQuantity === 1 ? "" : "es"}.
          </p>
        ) : null}
      </div>

      {isUnavailable ? (
        readOnly ? null : (
          <div
            className="summary-item-card__quantity summary-item-card__quantity--unavailable"
            aria-label={`Quitar ${item.title}`}
          >
            <button
              type="button"
              className="summary-item-card__qty-button"
              onClick={() => onRemove(lineKey)}
              aria-label={`Quitar ${item.title}`}
              title="Quitar"
            >
              <TrashIcon />
            </button>
          </div>
        )
      ) : readOnly ? (
        <div className="summary-item-card__quantity summary-item-card__quantity--readonly">
          <span>Cant.</span>
          <strong>{quantity}</strong>
        </div>
      ) : (
        <div
          className="summary-item-card__quantity"
          aria-label={`Cantidad de ${item.title}`}
        >
          <button
            type="button"
            className="summary-item-card__qty-button"
            onClick={() => onRemove(lineKey)}
            aria-label={`Quitar ${item.title}`}
            title="Quitar"
          >
            <TrashIcon />
          </button>
          <input
            className="summary-item-card__qty-input"
            type="number"
            min="1"
            max={maxQuantity}
            value={quantity}
            onChange={handleQuantityInput}
            aria-label={`Cantidad de ${item.title}`}
          />
          <button
            type="button"
            className="summary-item-card__qty-button"
            onClick={() => onQuantityChange(lineKey, quantity + 1)}
            aria-label={`Agregar una unidad de ${item.title}`}
            title="Agregar una unidad"
          >
            <PlusIcon />
          </button>
        </div>
      )}
    </article>
  );
}

function GenericSummaryItemCard({
  className = "",
  image,
  imageAlt,
  imageFallbackLabel,
  imageTo,
  badge = null,
  title,
  titleTo,
  subtitle = null,
  meta = [],
  price = null,
  comparePrice = null,
  footer = null,
  actions = [],
}) {
  const MediaTag = imageTo ? Link : "div";
  const mediaProps = imageTo ? { to: imageTo } : {};
  const TitleTag = titleTo ? Link : "div";
  const titleProps = titleTo ? { to: titleTo } : {};

  return (
    <article
      className={cn(
        "summary-item-card",
        "summary-item-card--account",
        !image ? "summary-item-card--no-media" : "",
        className,
      )}
    >
      <div className="summary-item-card__main">
        {image ? (
          <MediaTag
            {...mediaProps}
            className={cn(
              "summary-item-card__media",
              imageTo ? "summary-item-card__media-link" : "",
            )}
            aria-label={imageTo ? `Ver ${title}` : undefined}
          >
            <SmartImage
              src={image}
              alt={imageAlt || title}
              fallbackLabel={imageFallbackLabel || title}
              className="summary-item-card__image"
            />
          </MediaTag>
        ) : null}

        <div className="summary-item-card__body">
          {badge ? (
            <div className="summary-item-card__badge-row">{badge}</div>
          ) : null}

          <TitleTag
            {...titleProps}
            className={cn(
              "summary-item-card__title",
              titleTo ? "summary-item-card__title-link" : "",
            )}
          >
            {title}
          </TitleTag>

          {subtitle ? (
            <p className="summary-item-card__subtitle">{subtitle}</p>
          ) : null}

          {meta.length ? (
            <div className="summary-item-card__meta-list">
              {meta.map((item, index) => (
                <div
                  key={`${title}-meta-${index}`}
                  className="summary-item-card__meta-line"
                >
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          {price != null || comparePrice != null ? (
            <div className="summary-item-card__price-block">
              {price != null ? (
                <strong className="summary-item-card__price-current">
                  {price}
                </strong>
              ) : null}
              {comparePrice != null ? (
                <span className="summary-item-card__price-compare">
                  {comparePrice}
                </span>
              ) : null}
            </div>
          ) : null}

          {footer ? (
            <div className="summary-item-card__footer">{footer}</div>
          ) : null}
        </div>
      </div>

      {actions.length ? (
        <div className="summary-item-card__actions">
          {actions.map((action, index) => (
            <div
              key={`${title}-action-${index}`}
              className="summary-item-card__action-slot"
            >
              {action}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function SummaryItemCard(props) {
  if (props.item) {
    return <CheckoutSummaryItemCard {...props} />;
  }

  return <GenericSummaryItemCard {...props} />;
}
