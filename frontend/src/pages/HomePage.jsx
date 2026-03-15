import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api.js";
import ArticleCard from "../components/ArticleCard.jsx";
import ArticleFilters from "../components/ArticleFilters.jsx";
import FeaturedRail from "../components/FeaturedRail.jsx";

const initialFilters = {
  search: "",
  sort: "intake_desc",
  categoryId: "",
  brandId: "",
  sizeId: "",
  discounted: false,
  offerable: false,
  featured: false,
};

export default function HomePage() {
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState("grid");
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
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.brandId) params.set("brandId", filters.brandId);
    if (filters.sizeId) params.set("sizeId", filters.sizeId);
    if (filters.discounted) params.set("discounted", "true");
    if (filters.offerable) params.set("offerable", "true");
    if (filters.featured) params.set("featured", "true");
    params.set("page", String(page));
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    let ignore = false;

    async function loadFeatured() {
      try {
        const response = await apiFetch(
          "/api/public/articles?featured=true&sort=intake_desc&page=1",
        );
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
        setError("");
        if (page === 1) setLoading(true);
        if (page > 1) setLoadingMore(true);
        const response = await apiFetch(`/api/public/articles?${queryString}`);
        if (ignore) return;
        setPagination(response.pagination);
        setItems((current) =>
          page === 1
            ? response.items || []
            : [...current, ...(response.items || [])],
        );
      } catch (err) {
        if (!ignore) setError(err.message || "No se pudo cargar el catálogo");
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

  function applyFilters(nextFilters) {
    setItems([]);
    setPage(1);
    setFilters(nextFilters);
  }

  const canLoadMore = items.length < Number(pagination.total || 0);

  return (
    <div className="container page-stack">
      <section className="hero-panel">
        <div>
          <p className="section-kicker">Curated second hand</p>
          <h1>Sportswear y ropa moderna seleccionada en Estados Unidos.</h1>
          <p className="hero-copy">
            Sin modelos. Sin ruido. Solo prendas elegidas una a una para que la
            ropa hable por sí misma.
          </p>
        </div>
        {/* <div className="hero-stats">
          <div className="stat-card"><span>Catálogo vivo</span><strong>{pagination.total || items.length}</strong></div>
          <div className="stat-card"><span>Ofertas activas</span><strong>{items.filter((item) => item.allowOffers).length}</strong></div>
          <div className="stat-card"><span>Descuentos</span><strong>{items.filter((item) => item.discountType !== 'NONE').length}</strong></div>
        </div> */}
      </section>

      <section className="catalog-shell">
        <div className="catalog-toolbar sticky-panel">
          <ArticleFilters
            value={filters}
            onChange={applyFilters}
            onReset={() => applyFilters(initialFilters)}
          />
          <div className="view-toggle">
            <button
              type="button"
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              Grilla
            </button>
            <button
              type="button"
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              Lista
            </button>
          </div>
        </div>
      </section>

      <FeaturedRail
        title="Destacados y descuentos"
        items={featuredItems.slice(0, 8)}
      />

      <section className="catalog-shell">
        {error ? <div className="section-card error-card">{error}</div> : null}

        {loading ? (
          <div className="section-card centered-card">Cargando artículos…</div>
        ) : (
          <>
            <div className={view === "grid" ? "article-grid" : "article-list"}>
              {items.map((article) => (
                <ArticleCard key={article.id} article={article} view={view} />
              ))}
            </div>

            {!items.length ? (
              <div className="section-card centered-card">
                No encontramos artículos con esos filtros.
              </div>
            ) : null}

            {canLoadMore ? (
              <div className="load-more-row">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Cargando…" : "Ver más artículos"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
