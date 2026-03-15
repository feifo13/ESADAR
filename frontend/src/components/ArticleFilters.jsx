import { BRAND_OPTIONS, CATEGORY_OPTIONS, SIZE_OPTIONS } from '../constants/lookups.js';

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

export default function ArticleFilters({ value, onChange, onReset }) {
  const filters = { ...defaultFilters, ...value };

  function updateField(name, nextValue) {
    onChange({ ...filters, [name]: nextValue });
  }

  return (
    <div className="filters-bar">
      <div className="filters-topline">
        <input
          type="search"
          className="input"
          placeholder="Buscar por título, marca o categoría"
          value={filters.search}
          onChange={(event) => updateField('search', event.target.value)}
        />
        <select className="input" value={filters.sort} onChange={(event) => updateField('sort', event.target.value)}>
          <option value="intake_desc">Ingreso más reciente</option>
          <option value="intake_asc">Ingreso más antiguo</option>
          <option value="price_asc">Precio menor a mayor</option>
          <option value="price_desc">Precio mayor a menor</option>
        </select>
      </div>

      <div className="filters-grid">
        <select className="input" value={filters.categoryId} onChange={(event) => updateField('categoryId', event.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>

        <select className="input" value={filters.brandId} onChange={(event) => updateField('brandId', event.target.value)}>
          <option value="">Todas las marcas</option>
          {BRAND_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>

        <select className="input" value={filters.sizeId} onChange={(event) => updateField('sizeId', event.target.value)}>
          <option value="">Todos los talles</option>
          {SIZE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>

        <div className="filters-inline-toggles">
          <label className="checkbox-chip">
            <input type="checkbox" checked={filters.discounted} onChange={(event) => updateField('discounted', event.target.checked)} />
            <span>Promociones</span>
          </label>
          <label className="checkbox-chip checkbox-chip-accent">
            <input type="checkbox" checked={filters.offerable} onChange={(event) => updateField('offerable', event.target.checked)} />
            <span>Ofrezco</span>
          </label>
          <label className="checkbox-chip">
            <input type="checkbox" checked={filters.featured} onChange={(event) => updateField('featured', event.target.checked)} />
            <span>Destacados</span>
          </label>
        </div>
      </div>

      <div className="filters-actions">
        <button type="button" className="ghost-button" onClick={onReset}>Limpiar filtros</button>
      </div>
    </div>
  );
}
