import { BRAND_OPTIONS, CATEGORY_OPTIONS, SIZE_OPTIONS } from '../constants/lookups.js';

const defaultFilters = {
  categoryId: '',
  brandId: '',
  sizeId: '',
  discounted: false,
  offerable: false,
  featured: false,
};

export default function ArticleFilters({ value, onChange, onReset }) {
  const filters = { ...defaultFilters, ...value };

  function updateField(name, nextValue) {
    onChange({ ...filters, [name]: nextValue });
  }

  return (
    <aside className="filters-sidebar">
      <div className="filters-sidebar-head">
        <p className="section-kicker">Filtros</p>
        <button type="button" className="ghost-button" onClick={onReset}>Limpiar</button>
      </div>

      <div className="filters-sidebar-group">
        <label className="field-label" htmlFor="filter-category">Categoría</label>
        <select
          id="filter-category"
          className="input"
          value={filters.categoryId}
          onChange={(event) => updateField('categoryId', event.target.value)}
        >
          <option value="">Todas las categorías</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="filters-sidebar-group">
        <label className="field-label" htmlFor="filter-brand">Marca</label>
        <select
          id="filter-brand"
          className="input"
          value={filters.brandId}
          onChange={(event) => updateField('brandId', event.target.value)}
        >
          <option value="">Todas las marcas</option>
          {BRAND_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="filters-sidebar-group">
        <label className="field-label" htmlFor="filter-size">Talle</label>
        <select
          id="filter-size"
          className="input"
          value={filters.sizeId}
          onChange={(event) => updateField('sizeId', event.target.value)}
        >
          <option value="">Todos los talles</option>
          {SIZE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="filters-sidebar-group">
        <span className="field-label">Estados</span>
        <div className="filters-sidebar-checks">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.discounted}
              onChange={(event) => updateField('discounted', event.target.checked)}
            />
            <span>Promociones / descuentos</span>
          </label>
          <label className="checkbox-row checkbox-row-accent">
            <input
              type="checkbox"
              checked={filters.offerable}
              onChange={(event) => updateField('offerable', event.target.checked)}
            />
            <span>Ofrezco</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.featured}
              onChange={(event) => updateField('featured', event.target.checked)}
            />
            <span>Destacados</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
