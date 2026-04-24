import { useLookups } from '../contexts/LookupsContext.jsx';

const defaultFilters = {
  search: '',
  sort: 'intake_desc',
  categoryId: '',
  brandId: '',
  sizeId: '',
  discounted: false,
  offerable: false,
  featured: false,
};

export default function ArticleFilters({ value, onChange }) {
  const filters = { ...defaultFilters, ...value };
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();

  function updateField(name, nextValue) {
    onChange({ ...filters, [name]: nextValue });
  }

  return (
    <aside className="filters-sidebar">
      <div className="filters-sidebar-head">
        <div>
          <p className="section-kicker">Filtros</p>
        </div>
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
          {categoryOptions.map((option) => (
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
          {brandOptions.map((option) => (
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
          {sizeOptions.map((option) => (
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
