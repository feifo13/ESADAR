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

export default function ArticleFilters({ value, onChange, onApplied, idPrefix = "filter" }) {
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
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();

  useEffect(() => {
    setDraftFilters((current) =>
      areFiltersEqual(current, filters) ? current : filters,
    );
  }, [filters]);

  function updateField(name, nextValue) {
    setDraftFilters((current) => ({ ...current, [name]: nextValue }));
  }

  function clearFilters() {
    const nextFilters = { ...defaultFilters };
    setDraftFilters(nextFilters);
    onChange(nextFilters);
    onApplied?.(nextFilters);
  }

  return (
    <aside className="filters-sidebar" aria-label="Filtros del catalogo">
      <div className="filters-sidebar-head">
        <div className="page-stack-sm">
          <p className="section-kicker">Filtros</p>
        </div>
      </div>

      <div className="filters-sidebar-group">
        <label className="field-label" htmlFor={`${idPrefix}-search`}>
          Busqueda
        </label>
        <input
          id={`${idPrefix}-search`}
          className="input"
          type="search"
          value={draftFilters.search}
          onChange={(event) => updateField("search", event.target.value)}
          placeholder="Titulo, marca o categoria"
        />
      </div>

      <div className="filters-sidebar-group">
        <label className="field-label" htmlFor={`${idPrefix}-sort`}>
          Orden
        </label>
        <select
          id={`${idPrefix}-sort`}
          className="input"
          value={draftFilters.sort}
          onChange={(event) => updateField("sort", event.target.value)}
        >
          <option value="intake_desc">Ingreso mas reciente</option>
          <option value="intake_asc">Ingreso mas antiguo</option>
          <option value="price_asc">Precio menor a mayor</option>
          <option value="price_desc">Precio mayor a menor</option>
        </select>
      </div>

      <div className="filters-sidebar-group">
        <label className="field-label" htmlFor={`${idPrefix}-category`}>
          Categoria
        </label>
        <select
          id={`${idPrefix}-category`}
          className="input"
          value={draftFilters.categoryId}
          onChange={(event) => updateField("categoryId", event.target.value)}
        >
          <option value="">Todas las categorias</option>
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filters-sidebar-group">
        <label className="field-label" htmlFor={`${idPrefix}-brand`}>
          Marca
        </label>
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
        <label className="field-label" htmlFor={`${idPrefix}-size`}>
          Talle
        </label>
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
            <input
              type="checkbox"
              checked={draftFilters.discounted}
              onChange={(event) =>
                updateField("discounted", event.target.checked)
              }
            />
            <span>Promociones / descuentos</span>
          </label>
          <label className="checkbox-row checkbox-row-accent">
            <input
              type="checkbox"
              checked={draftFilters.offerable}
              onChange={(event) =>
                updateField("offerable", event.target.checked)
              }
            />
            <span>Acepta ofertas</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draftFilters.featured}
              onChange={(event) =>
                updateField("featured", event.target.checked)
              }
            />
            <span>Destacados</span>
          </label>
        </div>
      </div>

      <div className="filters-sidebar-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            onChange(draftFilters);
            onApplied?.(draftFilters);
          }}
        >
          Aplicar filtros
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={clearFilters}
        >
          Limpiar
        </button>
      </div>
    </aside>
  );
}
