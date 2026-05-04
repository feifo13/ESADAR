import { Link } from "react-router-dom";
import SmartImage from "./SmartImage.jsx";
import { formatCurrency } from "../lib/format.js";

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

export default function SummaryItemCard({ item, onQuantityChange, onRemove }) {
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
