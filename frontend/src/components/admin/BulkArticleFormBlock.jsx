import BulkArticleImageChecklist from "./BulkArticleImageChecklist.jsx";

export default function BulkArticleFormBlock({
  index,
  article,
  categoryOptions,
  brandOptions,
  sizeOptions,
  onChange,
  onImageChange,
  onToggleExpand,
  onDuplicate,
  onRemove,
}) {
  const isReady = article.title.trim() && Number(article.salePrice) > 0;
  const hasConditionWarning =
    /detalle|desgaste|defecto|mancha|rotura/i.test(
      article.conditionLabel || "",
    ) && !article.images.condition?.file;

  return (
    <article className="section-card page-stack bulk-form-block">
      <div className="section-heading section-heading-wrap">
        <div>
          <p className="section-kicker">Carga multiple</p>
          <h2>Articulo {index + 1}</h2>
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
            Duplicar articulo
          </button>
          <button
            type="button"
            className="button button-secondary button-compact"
            onClick={onRemove}
          >
            Eliminar articulo
          </button>
        </div>
      </div>

      {article.expanded ? (
        <>
          <div className="page-stack-sm">
            <h3>Datos basicos</h3>
            <div className="admin-filter-grid">
              <label className="field-group field-group-span-2">
                <span>Titulo *</span>
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
          </div>

          <div className="page-stack-sm">
            <h3>Caracteristicas</h3>
            <div className="admin-filter-grid">
              <label className="field-group">
                <span>Categoria</span>
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
              <label className="field-group">
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
              <label className="field-group">
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
                <input
                  className="input"
                  value={article.conditionLabel}
                  onChange={(event) =>
                    onChange("conditionLabel", event.target.value)
                  }
                />
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
            <h3>Descripcion y medidas</h3>
            <div className="admin-filter-grid">
              <label className="field-group field-group-span-2">
                <span>Descripcion visible</span>
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
                <span>Precio compra articulo</span>
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
                <span>Precio compra envio</span>
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
                <span>Precio compra courier</span>
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
              Campos tecnicos generados automaticamente.
            </p>
            <div className="admin-filter-grid">
              <label className="field-group">
                <span>Codigo interno manual</span>
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
