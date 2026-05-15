import { useEffect, useMemo, useState } from "react";
import { useLookups } from "../contexts/LookupsContext.jsx";

const defaultFilters = {
  search: "",
  sort: "intake_desc",
  categoryId: "",
  brandId: "",
  sizeId: "",
  discounted: false,
  offerable: false,
  featured: false,
};

const FILTER_KEYS = Object.keys(defaultFilters);

function normalizeFilters(value = {}) {
  return {
    ...defaultFilters,
    ...value,
    discounted: Boolean(value.discounted),
    offerable: Boolean(value.offerable),
    featured: Boolean(value.featured),
  };
}

function areFiltersEqual(left, right) {
  return FILTER_KEYS.every((key) => left?.[key] === right?.[key]);
}

export default function ArticleFilters({
  value,
  onChange,
  onApplied,
  idPrefix = "filter",
  showSort = true,
}) {
  const filters = useMemo(
    () => normalizeFilters(value),
    [
      value?.search,
      value?.sort,
      value?.categoryId,
      value?.brandId,
      value?.sizeId,
      value?.discounted,
      value?.offerable,
      value?.featured,
    ],
  );
  const [draftFilters, setDraftFilters] = useState(() =>
    normalizeFilters(value),
  );
  const { categoryOptions, catalogBrandOptions, sizeOptions } = useLookups();
  const brandOptions = catalogBrandOptions || [];
  const hasClearableFilters = Boolean(
    draftFilters.search ||
      draftFilters.categoryId ||
      draftFilters.brandId ||
      draftFilters.sizeId ||
      draftFilters.discounted ||
      draftFilters.offerable ||
      draftFilters.featured,
  );
  const hasClearableSort = showSort && filters.sort !== defaultFilters.sort;

  useEffect(() => {
    setDraftFilters((current) =>
      areFiltersEqual(current, filters) ? current : filters,
    );
  }, [filters]);

  function updateField(name, nextValue) {
    setDraftFilters((current) => ({ ...current, [name]: nextValue }));
  }

  function applySort(nextSort = draftFilters.sort) {
    const normalizedSort = nextSort || defaultFilters.sort;
    const nextFilters = { ...filters, sort: normalizedSort };
    setDraftFilters((current) => ({ ...current, sort: normalizedSort }));
    onChange(nextFilters);
    onApplied?.(nextFilters);
  }

  function applyFilters() {
    const nextFilters = {
      ...draftFilters,
      sort: filters.sort || defaultFilters.sort,
    };
    setDraftFilters(nextFilters);
    onChange(nextFilters);
    onApplied?.(nextFilters);
  }

  function clearFilters() {
    const nextFilters = { ...defaultFilters, sort: filters.sort || defaultFilters.sort };
    setDraftFilters(nextFilters);
    onChange(nextFilters);
    onApplied?.(nextFilters);
  }

  return (
    <aside className="filters-sidebar" aria-label="Filtros y ordenamiento del catálogo">
      {showSort ? (
        <div className="filters-sidebar-section filters-sidebar-section--sort">
          <p className="section-kicker">Ordenamiento</p>
          <div className="filters-sidebar-group filters-sidebar-group--sort">
            <select
              id={`${idPrefix}-sort`}
              className="input"
              value={draftFilters.sort}
              onChange={(event) => updateField("sort", event.target.value)}
              aria-label="Ordenar catálogo"
            >
              <option value="intake_desc">Ingreso más reciente</option>
              <option value="intake_asc">Ingreso más antiguo</option>
              <option value="price_asc">Precio menor a mayor</option>
              <option value="price_desc">Precio mayor a menor</option>
            </select>
          </div>
          <div className="filters-sidebar-actions filters-sidebar-actions--sort">
            <button
              type="button"
              className="button button-primary"
              onClick={() => applySort()}
            >
              Aplicar orden
            </button>
            {hasClearableSort ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => applySort(defaultFilters.sort)}
              >
                Limpiar orden
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="filters-sidebar-head filters-sidebar-head--filters">
        <div className="page-stack-sm">
          <p className="section-kicker">Filtros</p>
        </div>
      </div>

      <div className="filters-sidebar-group">
        {/* <label className="field-label" htmlFor={`${idPrefix}-category`}>
          Categoría
        </label> */}
        <select
          id={`${idPrefix}-category`}
          className="input"
          value={draftFilters.categoryId}
          onChange={(event) => updateField("categoryId", event.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filters-sidebar-group">
        {/* <label className="field-label" htmlFor={`${idPrefix}-brand`}>
          Marca
        </label> */}
        <select
          id={`${idPrefix}-brand`}
          className="input"
          value={draftFilters.brandId}
          onChange={(event) => updateField("brandId", event.target.value)}
        >
          <option value="">Todas las marcas</option>
          {brandOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filters-sidebar-group">
        {/* <label className="field-label" htmlFor={`${idPrefix}-size`}>
          Talle
        </label> */}
        <select
          id={`${idPrefix}-size`}
          className="input"
          value={draftFilters.sizeId}
          onChange={(event) => updateField("sizeId", event.target.value)}
        >
          <option value="">Todos los talles</option>
          {sizeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filters-sidebar-group">
        <span className="field-label">Estados</span>
        <div className="filters-sidebar-checks">
          <label className="checkbox-row">
            <span>Promociones / descuentos</span>
            <input
              type="checkbox"
              checked={draftFilters.discounted}
              onChange={(event) =>
                updateField("discounted", event.target.checked)
              }
            />
          </label>
          <label className="checkbox-row checkbox-row-accent">
            <span>¡Ofertá!</span>
            <input
              type="checkbox"
              checked={draftFilters.offerable}
              onChange={(event) =>
                updateField("offerable", event.target.checked)
              }
            />
          </label>
          <label className="checkbox-row">
            <span>Destacados</span>
            <input
              type="checkbox"
              checked={draftFilters.featured}
              onChange={(event) =>
                updateField("featured", event.target.checked)
              }
            />
          </label>
        </div>
      </div>

      <div className="filters-sidebar-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={applyFilters}
        >
          Aplicar filtros
        </button>
        {hasClearableFilters ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </aside>
  );
}
