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

function CheckoutSummaryItemCard({ item, onQuantityChange, onRemove }) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const maxQuantity = Math.max(quantity, Number(item.maxQuantity || quantity));
  const unitPrice = Number(item.discountedPrice || 0);
  const originalPrice = Number(item.salePrice || 0);
  const hasDiscount = originalPrice > unitPrice;
  const articlePath = `/articles/${encodeURIComponent(String(item.slug || item.articleId))}`;

  function handleQuantityInput(event) {
    onQuantityChange(item.articleId, Number(event.target.value || 1));
  }

  return (
    <article className="summary-item-card">
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
        {/* <span className="summary-item-card__badge">En carrito</span> */}
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
          <strong> {formatCurrency(unitPrice)}</strong>
        </div>

        <p className="summary-item-card__price-row">
          Total: <strong>{formatCurrency(unitPrice * quantity)}</strong>
        </p>
      </div>

      <div
        className="summary-item-card__quantity"
        aria-label={`Cantidad de ${item.title}`}
      >
        <button
          type="button"
          className="summary-item-card__qty-button"
          onClick={() => onRemove(item.articleId)}
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
          onClick={() => onQuantityChange(item.articleId, quantity + 1)}
          aria-label={`Agregar una unidad de ${item.title}`}
          title="Agregar una unidad"
        >
          <PlusIcon />
        </button>
      </div>
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
          {badge ? <div className="summary-item-card__badge-row">{badge}</div> : null}

          <TitleTag
            {...titleProps}
            className={cn(
              "summary-item-card__title",
              titleTo ? "summary-item-card__title-link" : "",
            )}
          >
            {title}
          </TitleTag>

          {subtitle ? <p className="summary-item-card__subtitle">{subtitle}</p> : null}

          {meta.length ? (
            <div className="summary-item-card__meta-list">
              {meta.map((item, index) => (
                <div key={`${title}-meta-${index}`} className="summary-item-card__meta-line">
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          {price != null || comparePrice != null ? (
            <div className="summary-item-card__price-block">
              {price != null ? <strong className="summary-item-card__price-current">{price}</strong> : null}
              {comparePrice != null ? (
                <span className="summary-item-card__price-compare">{comparePrice}</span>
              ) : null}
            </div>
          ) : null}

          {footer ? <div className="summary-item-card__footer">{footer}</div> : null}
        </div>
      </div>

      {actions.length ? (
        <div className="summary-item-card__actions">
          {actions.map((action, index) => (
            <div key={`${title}-action-${index}`} className="summary-item-card__action-slot">
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

