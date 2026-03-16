import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { storage } from '../lib/storage.js';
import { BRAND_OPTIONS, CATEGORY_OPTIONS, SIZE_OPTIONS } from '../constants/lookups.js';
import ArticleCard from '../components/ArticleCard.jsx';
import ArticleFilters from '../components/ArticleFilters.jsx';
import FeaturedRail from '../components/FeaturedRail.jsx';
import esadarWordmark from '../assets/esadar-wordmark.png';

const initialFilters = {
  search: '',
  sort: 'intake_desc',
  categoryId: '',
  brandId: '',
  sizeId: '',
  discounted: false,
  offerable: false,
  featured: false,
};

const VIEW_STORAGE_KEY = 'esadar-catalog-view';

const SORT_LABELS = {
  intake_desc: 'Más reciente',
  intake_asc: 'Más antiguo',
  price_asc: 'Precio ↑',
  price_desc: 'Precio ↓',
};

function getLabel(options, id, fallback) {
  return options.find((option) => String(option.id) === String(id))?.label || fallback;
}

export default function HomePage() {
  const heroRef = useRef(null);
  const searchInputRef = useRef(null);
  const { setHeroLogoVisible } = useOutletContext();
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState(() => storage.get(VIEW_STORAGE_KEY, 'grid'));
  const [featuredItems, setFeaturedItems] = useState([]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [copyState, setCopyState] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.brandId) params.set('brandId', filters.brandId);
    if (filters.sizeId) params.set('sizeId', filters.sizeId);
    if (filters.discounted) params.set('discounted', 'true');
    if (filters.offerable) params.set('offerable', 'true');
    if (filters.featured) params.set('featured', 'true');
    params.set('page', String(page));
    return params.toString();
  }, [filters, page]);

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (filters.search) chips.push({ key: 'search', label: `Búsqueda: ${filters.search}` });
    if (filters.sort && filters.sort !== initialFilters.sort) chips.push({ key: 'sort', label: `Orden: ${SORT_LABELS[filters.sort] || filters.sort}` });
    if (filters.categoryId) chips.push({ key: 'categoryId', label: `Categoría: ${getLabel(CATEGORY_OPTIONS, filters.categoryId, 'Seleccionada')}` });
    if (filters.brandId) chips.push({ key: 'brandId', label: `Marca: ${getLabel(BRAND_OPTIONS, filters.brandId, 'Seleccionada')}` });
    if (filters.sizeId) chips.push({ key: 'sizeId', label: `Talle: ${getLabel(SIZE_OPTIONS, filters.sizeId, 'Seleccionado')}` });
    if (filters.discounted) chips.push({ key: 'discounted', label: 'Con descuento' });
    if (filters.offerable) chips.push({ key: 'offerable', label: 'Acepta ofertas' });
    if (filters.featured) chips.push({ key: 'featured', label: 'Destacados' });

    return chips;
  }, [filters]);

  const activeFilterCount = activeFilterChips.length;
  const canLoadMore = items.length < Number(pagination.total || 0);

  useEffect(() => {
    storage.set(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    let ignore = false;

    async function loadFeatured() {
      try {
        const response = await apiFetch('/api/public/articles?featured=true&sort=intake_desc&page=1');
        if (!ignore) setFeaturedItems(response.items || []);
      } catch {
        if (!ignore) setFeaturedItems([]);
      }
    }

    loadFeatured();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadArticles() {
      try {
        setError('');
        if (page === 1) setLoading(true);
        if (page > 1) setLoadingMore(true);
        const response = await apiFetch(`/api/public/articles?${queryString}`);
        if (ignore) return;
        setPagination(response.pagination || { page: 1, pageSize: 20, total: 0 });
        setItems((current) => (page === 1 ? response.items || [] : [...current, ...(response.items || [])]));
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar el catálogo');
      } finally {
        if (!ignore) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    loadArticles();
    return () => {
      ignore = true;
    };
  }, [queryString, page]);

  useEffect(() => {
    function handleShortcut(event) {
      const target = event.target;
      const isTypingElement = target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingElement) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const node = heroRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroLogoVisible(entry.isIntersecting);
      },
      {
        threshold: 0.18,
        rootMargin: '-48px 0px 0px 0px',
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      setHeroLogoVisible(false);
    };
  }, [setHeroLogoVisible]);

  function applyFilters(nextFilters) {
    setItems([]);
    setPage(1);
    setFilters(nextFilters);
  }

  function updateFilterField(name, nextValue) {
    applyFilters({ ...filters, [name]: nextValue });
  }

  function resetFilters() {
    setCopyState('');
    applyFilters({ ...initialFilters });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function removeFilterChip(key) {
    const resetValue = typeof initialFilters[key] === 'boolean' ? false : initialFilters[key] || '';
    applyFilters({ ...filters, [key]: resetValue });
  }

  async function copyCurrentSearch() {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.sort && filters.sort !== initialFilters.sort) params.set('sort', filters.sort);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.brandId) params.set('brandId', filters.brandId);
      if (filters.sizeId) params.set('sizeId', filters.sizeId);
      if (filters.discounted) params.set('discounted', 'true');
      if (filters.offerable) params.set('offerable', 'true');
      if (filters.featured) params.set('featured', 'true');
      const shareUrl = `${window.location.origin}/${params.toString() ? `?${params.toString()}` : ''}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('Búsqueda copiada');
      window.setTimeout(() => setCopyState(''), 1800);
    } catch {
      setCopyState('No se pudo copiar');
      window.setTimeout(() => setCopyState(''), 1800);
    }
  }

  return (
    <div className="home-page page-stack page-stack-wide">
      <section ref={heroRef} className="hero-strip hero-strip--logo container">
        <div className="brand-block brand-block--large">
          <img src={esadarWordmark} alt="ESADAR" className="brand-logo brand-logo--large" />
        </div>
      </section>

      <section className="catalog-topbar-shell">
        <div className="container catalog-topbar-row catalog-topbar-row--fancy">
          <input
            ref={searchInputRef}
            type="search"
            className="input search-input-main"
            placeholder="Buscar por título, marca o categoría"
            value={filters.search}
            onChange={(event) => updateFilterField('search', event.target.value)}
          />

          <select
            className="input sort-select"
            value={filters.sort}
            onChange={(event) => updateFilterField('sort', event.target.value)}
          >
            <option value="intake_desc">Ingreso más reciente</option>
            <option value="intake_asc">Ingreso más antiguo</option>
            <option value="price_asc">Precio menor a mayor</option>
            <option value="price_desc">Precio mayor a menor</option>
          </select>

          <div className="view-toggle">
            <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              Grilla
            </button>
            <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              Lista
            </button>
          </div>

          <div className="catalog-topbar-actions">
            <button type="button" className="ghost-button" onClick={copyCurrentSearch}>
              Copiar búsqueda
            </button>
            <button type="button" className="ghost-button" onClick={resetFilters}>
              Limpiar todo
            </button>
          </div>
        </div>
      </section>

      <FeaturedRail title="Destacados y descuentos" items={featuredItems.slice(0, 8)} />

      <section className="catalog-wide container">
        <ArticleFilters value={filters} onChange={applyFilters} onReset={resetFilters} activeCount={activeFilterCount} />

        <div className="catalog-content">
          <div className="catalog-summary-row">
            <div>
              <p className="section-kicker">Catálogo</p>
              <h2>{pagination.total || items.length} artículos disponibles</h2>
            </div>
            <div className="catalog-summary-metrics">
              <span>{items.filter((item) => item.allowOffers).length} con ofertas</span>
              <span>{items.filter((item) => item.discountType !== 'NONE').length} con descuento</span>
              <span>{activeFilterCount} filtros activos</span>
              {copyState ? <span className="catalog-copy-state">{copyState}</span> : null}
            </div>
          </div>

          <div className="catalog-quick-actions" aria-label="Acciones rápidas del catálogo">
            <button type="button" className={filters.discounted ? 'quick-filter-chip active' : 'quick-filter-chip'} onClick={() => updateFilterField('discounted', !filters.discounted)}>
              Solo descuentos
            </button>
            <button type="button" className={filters.offerable ? 'quick-filter-chip active' : 'quick-filter-chip'} onClick={() => updateFilterField('offerable', !filters.offerable)}>
              Solo ofertas
            </button>
            <button type="button" className={filters.featured ? 'quick-filter-chip active' : 'quick-filter-chip'} onClick={() => updateFilterField('featured', !filters.featured)}>
              Solo destacados
            </button>
            <button type="button" className="quick-filter-chip" onClick={() => searchInputRef.current?.focus()}>
              Buscar (/)
            </button>
          </div>

          {activeFilterChips.length ? (
            <div className="active-filters-row">
              {activeFilterChips.map((chip) => (
                <button key={chip.key} type="button" className="active-filter-chip" onClick={() => removeFilterChip(chip.key)}>
                  <span>{chip.label}</span>
                  <strong>×</strong>
                </button>
              ))}
            </div>
          ) : null}

          {error ? <div className="error-inline">{error}</div> : null}

          {loading ? (
            <div className="catalog-status">Cargando artículos…</div>
          ) : (
            <>
              <div className={view === 'grid' ? 'article-grid' : 'article-list'}>
                {items.map((article) => (
                  <ArticleCard key={article.id} article={article} view={view} />
                ))}
              </div>

              {!items.length ? <div className="catalog-status">No encontramos artículos con esos filtros.</div> : null}

              {canLoadMore ? (
                <div className="load-more-row load-more-row-left">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Cargando…' : 'Ver más artículos'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
