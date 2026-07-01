import BulkArticleImageChecklist from "./BulkArticleImageChecklist.jsx";
import { calculateArticleMarginPreview } from "../../lib/articleMargins.js";

const CONDITION_LABEL_OPTIONS = [
  "Nuevo",
  "Excelente",
  "Muy Bueno",
  "Bueno",
  "Con detalles",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function BulkArticleFormBlock({
  index,
  article,
  categoryOptions,
  brandOptions,
  sizeOptions,
  onChange,
  onImageChange,
  costingSettings,
  onToggleExpand,
  onDuplicate,
  onRemove,
}) {
  const isReady = article.title.trim() && Number(article.salePrice) > 0;
  const marginPreview = calculateArticleMarginPreview(article, {
    bankTaxRate: costingSettings?.bankTaxRate,
  });
  const hasConditionWarning =
    /detalle|desgaste|defecto|mancha|rotura/i.test(
      article.conditionLabel || "",
    ) && !article.images.condition?.file;

  return (
    <article className="section-card page-stack bulk-form-block">
      <div className="section-heading section-heading-wrap">
        <div>
          <p className="section-kicker">Carga multiple</p>
          <h2>Artículo {index + 1}</h2>
          <p className="muted-copy">
            {isReady ? "Listo para subir" : "Faltan datos obligatorios"}
          </p>
        </div>
        <div className="inline-action-group">
          <button
            type="button"
            className="button button-secondary button-compact"
            onClick={onToggleExpand}
          >
            {article.expanded ? "Colapsar" : "Expandir"}
          </button>
          <button
            type="button"
            className="button button-secondary button-compact"
            onClick={onDuplicate}
          >
            Duplicar artículo
          </button>
          <button
            type="button"
            className="button button-secondary button-compact"
            onClick={onRemove}
          >
            Eliminar artículo
          </button>
        </div>
      </div>

      {article.expanded ? (
        <>
          <div className="page-stack-sm">
            <h3>Datos básicos</h3>
            <div className="admin-filter-grid">
              <label className="field-group field-group-span-2">
              <span>Título *</span>
                <input
                  className="input"
                  name={`bulk-title-${article.id}`}
                  data-validation-field={`bulk-title-${article.id}`}
                  value={article.title}
                  onChange={(event) => onChange("title", event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Precio de venta *</span>
                <input
                  className="input"
                  name={`bulk-sale-price-${article.id}`}
                  data-validation-field={`bulk-sale-price-${article.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={article.salePrice}
                  onChange={(event) =>
                    onChange("salePrice", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Cantidad</span>
                <input
                  className="input"
                  name={`bulk-quantity-${article.id}`}
                  data-validation-field={`bulk-quantity-${article.id}`}
                  type="number"
                  min="1"
                  step="1"
                  value={article.quantityTotal}
                  onChange={(event) =>
                    onChange("quantityTotal", event.target.value)
                  }
                />
              </label>
            </div>
            <div
              className={[
                "article-margin-preview",
                marginPreview.isNegative ? "article-margin-preview--negative" : "",
              ].filter(Boolean).join(" ")}
              aria-live="polite"
            >
              <p className="summary-line">
                <span>Costo compra</span>
                <strong>{formatCurrency(marginPreview.totalPurchasePrice)}</strong>
              </p>
              <p className="summary-line">
                <span>Base impuestos bancarios</span>
                <strong>{formatCurrency(marginPreview.bankTaxBase)}</strong>
              </p>
              <p className="summary-line">
                <span>Tasa impuestos bancarios</span>
                <strong>{marginPreview.bankTaxPercent.toFixed(2)}%</strong>
              </p>
              <p className="summary-line">
                <span>Impuestos bancarios</span>
                <strong>{formatCurrency(marginPreview.bankTax)}</strong>
              </p>
              <p className="summary-line">
                <span>Costo total / mínimo recomendado de venta</span>
                <strong>{formatCurrency(marginPreview.totalCost)}</strong>
              </p>
              <p className="summary-line article-margin-preview__highlight">
                <span>Ganancia estimada</span>
                <strong>{formatCurrency(marginPreview.estimatedProfit)}</strong>
              </p>
            </div>
          </div>

          <div className="page-stack-sm">
            <h3>Caracteristicas</h3>
            <div className="admin-filter-grid">
              <label className="field-group field-group--quick-lookup">
                <span>Categoría</span>
                <input
                  className="input"
                  list={`bulk-category-${index}`}
                  value={article.categoryName}
                  onChange={(event) =>
                    onChange("categoryName", event.target.value)
                  }
                />
                <datalist id={`bulk-category-${index}`}>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </label>
              <label className="field-group field-group--quick-lookup">
                <span>Marca</span>
                <input
                  className="input"
                  list={`bulk-brand-${index}`}
                  value={article.brandName}
                  onChange={(event) =>
                    onChange("brandName", event.target.value)
                  }
                />
                <datalist id={`bulk-brand-${index}`}>
                  {brandOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </label>
              <label className="field-group field-group--quick-lookup">
                <span>Talle</span>
                <input
                  className="input"
                  list={`bulk-size-${index}`}
                  value={article.sizeText}
                  onChange={(event) => onChange("sizeText", event.target.value)}
                />
                <datalist id={`bulk-size-${index}`}>
                  {sizeOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </label>
              <label className="field-group">
                <span>Estado de la prenda</span>
                <select
                  className="input"
                  value={article.conditionLabel}
                  onChange={(event) =>
                    onChange("conditionLabel", event.target.value)
                  }
                >
                  <option value="">Sin definir</option>
                  {CONDITION_LABEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {article.conditionLabel &&
                  !CONDITION_LABEL_OPTIONS.includes(article.conditionLabel) ? (
                    <option value={article.conditionLabel}>
                      {article.conditionLabel}
                    </option>
                  ) : null}
                </select>
              </label>
              <label className="field-group">
                <span>Color</span>
                <input
                  className="input"
                  value={article.color}
                  onChange={(event) => onChange("color", event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Material</span>
                <input
                  className="input"
                  value={article.material}
                  onChange={(event) => onChange("material", event.target.value)}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={article.allowOffers}
                  onChange={(event) =>
                    onChange("allowOffers", event.target.checked)
                  }
                />
                <span>¡Ofertá!</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={article.isFeatured}
                  onChange={(event) =>
                    onChange("isFeatured", event.target.checked)
                  }
                />
                <span>Destacado</span>
              </label>
            </div>
          </div>

          <div className="page-stack-sm">
          <h3>Descripción y medidas</h3>
            <div className="admin-filter-grid">
              <label className="field-group field-group-span-2">
              <span>Descripción visible</span>
                <textarea
                  className="input textarea"
                  rows="4"
                  value={article.description}
                  onChange={(event) =>
                    onChange("description", event.target.value)
                  }
                />
              </label>
              <label className="field-group field-group-span-2">
                <span>Medidas reales</span>
                <textarea
                  className="input textarea"
                  rows="3"
                  value={article.measurementsText}
                  onChange={(event) =>
                    onChange("measurementsText", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
              <span>Costo artículo</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={article.purchasePriceItem}
                  onChange={(event) =>
                    onChange("purchasePriceItem", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Costo envío USA</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={article.purchasePriceShipping}
                  onChange={(event) =>
                    onChange("purchasePriceShipping", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Costo envío MVD</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={article.purchasePriceCourier}
                  onChange={(event) =>
                    onChange("purchasePriceCourier", event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="page-stack-sm">
            <h3>Imagenes</h3>
            <p className="field-helper">
              Foto frontal, fondo neutro, sin texto ni marca de agua. Agregar
              espalda, etiqueta y detalles.
            </p>
            <BulkArticleImageChecklist
              value={article.images}
              title={article.title}
              onChange={onImageChange}
              hasConditionWarning={hasConditionWarning}
            />
          </div>

          <details className="section-card bulk-advanced-panel">
            <summary>Avanzado</summary>
            <p className="field-helper">
              Campos técnicos generados automáticamente.
            </p>
            <div className="admin-filter-grid">
              <label className="field-group">
              <span>Código interno manual</span>
                <input
                  className="input"
                  value={article.internalCode}
                  onChange={(event) =>
                    onChange("internalCode", event.target.value)
                  }
                />
              </label>
              <label className="field-group field-group-span-2">
                <span>SEO title</span>
                <input
                  className="input"
                  value={article.seoTitle}
                  onChange={(event) => onChange("seoTitle", event.target.value)}
                />
              </label>
              <label className="field-group field-group-span-2">
                <span>SEO description</span>
                <textarea
                  className="input textarea"
                  rows="3"
                  value={article.seoDescription}
                  onChange={(event) =>
                    onChange("seoDescription", event.target.value)
                  }
                />
              </label>
            </div>
          </details>
        </>
      ) : null}
    </article>
  );
}
