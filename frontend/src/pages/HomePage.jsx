import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { apiFetch } from "../lib/api.js";
import { useLookups } from "../contexts/LookupsContext.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  toAbsoluteUrl,
} from "../lib/seo.js";
import ArticleCard from "../components/ArticleCard.jsx";
import ArticleFilters from "../components/ArticleFilters.jsx";
import FeaturedMotionCards from "../components/FeaturedMotionCards.jsx";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import baller1 from "../assets/baller-1.jpg";
import baller2 from "../assets/baller-2.jpg";
import baller3 from "../assets/baller-3.jpg";

const HERO_IMAGES = [baller1, baller2, baller3];
const HERO_SEQUENCE = [...HERO_IMAGES, ...HERO_IMAGES, ...HERO_IMAGES];

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

const initialLeadForm = {
  firstName: "",
  email: "",
  phone: "",
  instagram: "",
  preferredCategory: "",
  preferredBrand: "",
  preferredSize: "",
  preferredColor: "",
};


const SORT_LABELS = {
  intake_desc: "Mas reciente",
  intake_asc: "Mas antiguo",
  price_asc: "Precio ↑",
  price_desc: "Precio ↓",
};

function getLabel(options, id, fallback) {
  return (
    options.find((option) => String(option.id) === String(id))?.label ||
    fallback
  );
}

export default function HomePage() {
  const heroRef = useRef(null);
  const searchInputRef = useRef(null);
  const featuredSectionRef = useRef(null);
  const catalogSectionRef = useRef(null);
  const { setHeroLogoVisible } = useOutletContext();
  const { setCatalogFiltersContent } = useMobileMenu();
  const location = useLocation();
  const { categoryOptions, brandOptions, sizeOptions, lookupError } =
    useLookups();
  const { site, pagesByRoute } = useSiteSeo();
  const [filters, setFilters] = useState(initialFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
  const [leadForm, setLeadForm] = useState(initialLeadForm);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadSuccess, setLeadSuccess] = useState("");

  const homeSeo = pagesByRoute["/"] || null;

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

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (filters.search) {
      chips.push({ key: "search", label: `Busqueda: ${filters.search}` });
    }
    if (filters.sort && filters.sort !== initialFilters.sort) {
      chips.push({
        key: "sort",
        label: `Orden: ${SORT_LABELS[filters.sort] || filters.sort}`,
      });
    }
    if (filters.categoryId) {
      chips.push({
        key: "categoryId",
        label: `Categoria: ${getLabel(categoryOptions, filters.categoryId, "Seleccionada")}`,
      });
    }
    if (filters.brandId) {
      chips.push({
        key: "brandId",
        label: `Marca: ${getLabel(brandOptions, filters.brandId, "Seleccionada")}`,
      });
    }
    if (filters.sizeId) {
      chips.push({
        key: "sizeId",
        label: `Talle: ${getLabel(sizeOptions, filters.sizeId, "Seleccionado")}`,
      });
    }
    if (filters.discounted)
      chips.push({ key: "discounted", label: "Con descuento" });
    if (filters.offerable)
      chips.push({ key: "offerable", label: "Acepta ofertas" });
    if (filters.featured) chips.push({ key: "featured", label: "Destacados" });

    return chips;
  }, [brandOptions, categoryOptions, filters, sizeOptions]);

  const mobileCatalogFiltersContent = useMemo(
    () => (
      <ArticleFilters
        value={filters}
        onChange={applyMobileFilters}
        onApplied={() => setMobileFiltersOpen(false)}
        idPrefix="mobile-filter"
      />
    ),
    [filters],
  );

  useEffect(() => {
    const isCatalogView = location.pathname === "/" || location.pathname === "/articles";
    setCatalogFiltersContent(isCatalogView ? mobileCatalogFiltersContent : null);
    return () => setCatalogFiltersContent(null);
  }, [location.pathname, mobileCatalogFiltersContent, setCatalogFiltersContent]);

  const canLoadMore = items.length < Number(pagination.total || 0);

  useEffect(() => {
    setHeroLogoVisible(false);
    return () => setHeroLogoVisible(false);
  }, [setHeroLogoVisible]);

  useEffect(() => {
    if (location.pathname !== "/articles") return;

    const scrollFrame = window.requestAnimationFrame(() => {
      catalogSectionRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/articles") return;

    const nextSearch = new URLSearchParams(location.search).get("search") || "";
    setFilters((current) =>
      current.search === nextSearch ? current : { ...current, search: nextSearch },
    );
    setPage(1);
  }, [location.pathname, location.search]);

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
        setPagination(
          response.pagination || { page: 1, pageSize: 20, total: 0 },
        );
        setItems((current) =>
          page === 1
            ? response.items || []
            : [...current, ...(response.items || [])],
        );
      } catch (err) {
        if (!ignore) setError(err.message || "No se pudo cargar el catalogo");
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
  }, [page, queryString]);

  useEffect(() => {
    function handleShortcut(event) {
      const target = event.target;
      const isTypingElement =
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingElement
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function applyFilters(nextFilters) {
    setItems([]);
    setPage(1);
    setFilters(nextFilters);
  }

  function applyMobileFilters(nextFilters) {
    applyFilters(nextFilters);
    setMobileFiltersOpen(false);
  }

  function updateFilterField(name, nextValue) {
    applyFilters({ ...filters, [name]: nextValue });
  }

  function resetFilters() {
    applyFilters({ ...initialFilters });

    window.requestAnimationFrame(() => {
      catalogSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      catalogSectionRef.current?.focus({ preventScroll: true });
    });
  }

  function removeFilterChip(key) {
    const resetValue =
      typeof initialFilters[key] === "boolean"
        ? false
        : initialFilters[key] || "";
    applyFilters({ ...filters, [key]: resetValue });
  }

  function updateLeadField(name, value) {
    setLeadForm((current) => ({ ...current, [name]: value }));
  }

  async function handleLeadSubmit(event) {
    event.preventDefault();

    try {
      setLeadSubmitting(true);
      setLeadError("");
      setLeadSuccess("");

      await apiFetch("/api/public/leads/newsletter", {
        method: "POST",
        body: {
          firstName: leadForm.firstName || null,
          email: leadForm.email || null,
          phone: leadForm.phone || null,
          instagram: leadForm.instagram || null,
          preferredCategories: leadForm.preferredCategory
            ? [leadForm.preferredCategory]
            : [],
          preferredBrands: leadForm.preferredBrand
            ? [leadForm.preferredBrand]
            : [],
          preferredSizes: leadForm.preferredSize
            ? [leadForm.preferredSize]
            : [],
          preferredColors: leadForm.preferredColor
            ? [leadForm.preferredColor]
            : [],
        },
      });

      setLeadSuccess(
        "Te vamos a avisar cuando entren prendas que encajen con tu estilo.",
      );
      setLeadForm(initialLeadForm);
    } catch (err) {
      setLeadError(err.message || "No pudimos guardar tu preferencia ahora.");
    } finally {
      setLeadSubmitting(false);
    }
  }

  function scrollToSection(ref) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showOfferableCatalog() {
    applyFilters({ ...filters, offerable: true });
    window.requestAnimationFrame(() => scrollToSection(catalogSectionRef));
  }

  return (
    <div className="home-page page-stack page-stack-wide">
      <SeoHead
        title={homeSeo?.title || `${site.name} | Ropa second hand seleccionada`}
        description={homeSeo?.description || site.description}
        canonical={homeSeo?.canonicalUrl || toAbsoluteUrl("/", site)}
        url={toAbsoluteUrl("/", site)}
        image={toAbsoluteUrl(HERO_IMAGES[0], site)}
        jsonLd={[
          { id: "organization", data: buildOrganizationJsonLd(site) },
          { id: "website", data: buildWebsiteJsonLd(site) },
        ]}
      />

      <section
        ref={heroRef}
        className="hero-strip hero-strip--carousel"
        aria-label="Galeria destacada"
      >
        <div className="hero-carousel" aria-hidden="true">
          <div className="hero-carousel__track">
            {HERO_SEQUENCE.map((image, index) => (
              <figure
                key={`${image}-${index}`}
                className="hero-carousel__slide"
              >
                <img
                  src={image}
                  alt=""
                  className="hero-carousel__image"
                  loading={index < 3 ? "eager" : "lazy"}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="container value-hero-card section-card">
        <div className="value-hero-copy">
          <p className="section-kicker">ESADAR</p>
          <h1>Ropa second hand seleccionada</h1>
          <p className="hero-copy">
            Sportswear, vintage y prendas modernas elegidas una por una.
          </p>
          <p className="hero-copy hero-copy-compact">
            Stock limitado. Cada pieza es unica.
          </p>
        </div>

        <div className="value-hero-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => scrollToSection(catalogSectionRef)}
          >
            Ver catalogo
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => scrollToSection(featuredSectionRef)}
          >
            Prendas destacadas
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={showOfferableCatalog}
          >
            Ver ofertas
          </button>
        </div>
      </section>

      <section ref={featuredSectionRef}>
        <FeaturedMotionCards
          title="Destacados y descuentos"
          items={featuredItems.slice(0, 8)}
        />
      </section>

      <section className="catalog-topbar-shell">
        <div className="container catalog-topbar-row catalog-topbar-row--fancy">
          <input
            ref={searchInputRef}
            type="search"
            className="input search-input-main"
            placeholder="Buscar por titulo, marca o categoria"
            value={filters.search}
            onChange={(event) =>
              updateFilterField("search", event.target.value)
            }
          />

          <select
            className="input sort-select"
            value={filters.sort}
            onChange={(event) => updateFilterField("sort", event.target.value)}
          >
            <option value="intake_desc">Ingreso mas reciente</option>
            <option value="intake_asc">Ingreso mas antiguo</option>
            <option value="price_asc">Precio menor a mayor</option>
            <option value="price_desc">Precio mayor a menor</option>
          </select>

        </div>
      </section>

      <section className="mobile-catalog-filter-shell container" aria-label="Filtros del catalogo">
        <button
          type="button"
          className="mobile-catalog-filter-trigger"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((current) => !current)}
        >
          <span>Filtros</span>
          <strong>{activeFilterChips.length ? `${activeFilterChips.length} activos` : "Buscar y filtrar"}</strong>
          <span aria-hidden="true">{mobileFiltersOpen ? "−" : "+"}</span>
        </button>

        {mobileFiltersOpen ? (
          <div className="mobile-catalog-filter-body">
            <ArticleFilters
              value={filters}
              onChange={applyMobileFilters}
              onApplied={() => setMobileFiltersOpen(false)}
              idPrefix="mobile-inline-filter"
            />
          </div>
        ) : null}

        {activeFilterChips.length ? (
          <div className="active-filters-row active-filters-row--mobile-sticky" aria-label="Filtros activos">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="active-filter-chip"
                onClick={() => removeFilterChip(chip.key)}
              >
                {chip.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section
        ref={catalogSectionRef}
        className="catalog-wide container"
        tabIndex={-1}
      >
        <ArticleFilters value={filters} onChange={applyFilters} idPrefix="desktop-filter" />

        <div className="catalog-content">
          <div className="catalog-summary-row">
            <div>
              <p className="section-kicker">Catalogo</p>
              <h2>{pagination.total || items.length} articulos disponibles</h2>
            </div>
          </div>

          {lookupError ? <p className="muted-copy">{lookupError}</p> : null}

          {/* <div
            className="catalog-quick-actions"
            aria-label="Acciones rapidas del catalogo"
          >
            <button
              type="button"
              className={`quick-filter-chip${filters.discounted ? ' active' : ''}`}
              onClick={() => updateFilterField('discounted', !filters.discounted)}
            >
              Solo descuentos
            </button>
            <button
              type="button"
              className={`quick-filter-chip${filters.offerable ? ' active' : ''}`}
              onClick={() => updateFilterField('offerable', !filters.offerable)}
            >
              Solo ofertas
            </button>
            <button
              type="button"
              className={`quick-filter-chip${filters.featured ? ' active' : ''}`}
              onClick={() => updateFilterField('featured', !filters.featured)}
            >
              Solo destacados
            </button>
          </div> */}

          {activeFilterChips.length ? (
            <div className="active-filters-row" aria-label="Filtros activos">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="active-filter-chip"
                  onClick={() => removeFilterChip(chip.key)}
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          ) : null}

          {error ? <p className="error-inline">{error}</p> : null}

          {loading ? (
            <div className="centered-card section-card">
              <p className="muted-copy">Cargando prendas seleccionadas…</p>
            </div>
          ) : items.length ? (
            <div className="article-grid">
              {items.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  view="grid"
                  variant="default"
                />
              ))}
            </div>
          ) : (
            <div className="centered-card section-card">
              <div className="stack-gap-sm">
                <p className="section-kicker">Sin resultados</p>
                <h2>No encontramos prendas con esos filtros.</h2>
                <p className="muted-copy">
                  Prueba quitar alguna seleccion o volver a mirar lo mas
                  reciente.
                </p>
                <div>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={resetFilters}
                  >
                    Restablecer filtros
                  </button>
                </div>
              </div>
            </div>
          )}

          {canLoadMore ? (
            <div className="load-more-row load-more-row-left">
              <button
                type="button"
                className="button button-secondary"
                disabled={loadingMore}
                onClick={() => setPage((current) => current + 1)}
              >
                {loadingMore ? "Cargando mas…" : "Ver mas"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="container section-card lead-capture-card lead-capture-card--cta">
        <div className="lead-capture-copy">
          <p className="section-kicker">Captacion</p>
          <h2>¿Queres enterarte cuando entra ropa nueva?</h2>
          <p className="muted-copy">
            Dejanos tus preferencias en una vista dedicada y te avisamos cuando
            aparezcan prendas que encajen con tu estilo.
          </p>
        </div>
        <Link className="button button-primary lead-capture-cta-button" to="/avisos">
          Quiero enterarme
        </Link>
      </section>
    </div>
  );
}
