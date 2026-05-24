import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { apiFetch, cachedApiFetch, listenPublicCacheInvalidation, resolveAssetUrl } from "../lib/api.js";
import { runWhenIdle } from "../lib/performance.js";
import { useLookups } from "../contexts/LookupsContext.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  toAbsoluteUrl,
} from "../lib/seo.js";
import { scrollElementIntoViewWithSiteChromeOffset } from "../lib/siteChromeOffset.js";
import ArticleCard from "../components/ArticleCard.jsx";
import ArticleFilters from "../components/ArticleFilters.jsx";
import FeaturedMotionCards from "../components/FeaturedMotionCards.jsx";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import esadarWordmark from "../assets/esadar-wordmark.webp";
import baller1 from "../assets/baller-1.jpg";
import baller2 from "../assets/baller-2.jpg";
import baller3 from "../assets/baller-3.jpg";
import AppLoader from "../components/AppLoader.jsx";
import LeadCaptureCta from "../components/LeadCaptureCta.jsx";

const HERO_IMAGES = [baller1, baller2, baller3];
const CATALOG_PAGE_SIZE = 20;
const HERO_HEIGHT_MODES = new Set(["HALF_SCREEN", "TABLET_LAPTOP", "FULL_SCREEN", "CUSTOM"]);
const HERO_DISPLAY_MODES = new Set(["SINGLE_IMAGE", "CAROUSEL"]);
function mergeAcceptedOffers(items, acceptedOffersByArticle) {
  return items.map((item) => {
    const acceptedOffer = acceptedOffersByArticle[Number(item.id)];

    if (acceptedOffer) {
      return { ...item, acceptedOffer };
    }

    if (!item.acceptedOffer) return item;
    const { acceptedOffer: _acceptedOffer, ...rest } = item;
    return rest;
  });
}

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

const CATALOG_BOOLEAN_FILTERS = ["discounted", "offerable", "featured"];
const CATALOG_STRING_FILTERS = [
  "search",
  "sort",
  "categoryId",
  "brandId",
  "sizeId",
];
const CATALOG_SECTION_FILTERS = new Set(["catalog", "offers", "featured", "latest"]);

function normalizeCatalogFilters(value = {}) {
  return {
    ...initialFilters,
    ...value,
    discounted: Boolean(value.discounted),
    offerable: Boolean(value.offerable),
    featured: Boolean(value.featured),
  };
}

function areCatalogFiltersEqual(left, right) {
  return Object.keys(initialFilters).every(
    (key) => left?.[key] === right?.[key],
  );
}

function readCatalogFiltersFromSearch(search) {
  const params = new URLSearchParams(search);
  const nextFilters = { ...initialFilters };

  CATALOG_STRING_FILTERS.forEach((key) => {
    const value = params.get(key);
    if (value != null) nextFilters[key] = value;
  });

  CATALOG_BOOLEAN_FILTERS.forEach((key) => {
    nextFilters[key] = params.get(key) === "true";
  });

  const section = String(params.get("section") || "").trim().toLowerCase();
  if (section === "offers") nextFilters.offerable = true;
  if (section === "featured") nextFilters.featured = true;
  if (section === "latest") nextFilters.sort = "intake_desc";

  return normalizeCatalogFilters(nextFilters);
}

function hasCatalogSearchIntent(search) {
  const params = new URLSearchParams(search);

  return (
    (CATALOG_SECTION_FILTERS.has(String(params.get("section") || "").trim().toLowerCase())) ||
    CATALOG_STRING_FILTERS.some((key) => {
      const value = params.get(key);
      if (!value) return false;
      if (key === "sort") return value !== initialFilters.sort;
      return true;
    }) || CATALOG_BOOLEAN_FILTERS.some((key) => params.get(key) === "true")
  );
}

function shouldScrollToCatalogForLocation(location) {
  const state = location.state || {};
  return Boolean(
    state.scrollToCatalog ||
    state.source === "header-search" ||
    state.source === "catalog-action" ||
    hasCatalogSearchIntent(location.search),
  );
}

function buildCatalogSearch(filters) {
  const params = new URLSearchParams();
  const normalizedFilters = normalizeCatalogFilters(filters);

  CATALOG_STRING_FILTERS.forEach((key) => {
    const value = normalizedFilters[key];
    if (!value) return;
    if (key === "sort" && value === initialFilters.sort) return;
    params.set(key, value);
  });

  CATALOG_BOOLEAN_FILTERS.forEach((key) => {
    if (normalizedFilters[key]) params.set(key, "true");
  });

  return params.toString();
}

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
  intake_desc: "Más reciente",
  intake_asc: "Más antiguo",
  price_asc: "Precio ↑",
  price_desc: "Precio ↓",
};

const CATALOG_PROGRAMMATIC_SCROLL_SUPPRESS_MS = 1600;

function suppressFooterRevealForCatalogScroll(
  duration = CATALOG_PROGRAMMATIC_SCROLL_SUPPRESS_MS,
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("esadar:suppress-footer-reveal", {
      detail: { duration, untilManual: true },
    }),
  );
}

function getLabel(options, id, fallback) {
  return (
    options.find((option) => String(option.id) === String(id))?.label ||
    fallback
  );
}

function getConfiguredHeroImageSources(hero) {
  const images = Array.isArray(hero?.images) ? hero.images : [];
  const normalizedImages = images
    .filter((image) => image?.imageUrl && image?.isActive !== false)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((image) => ({
      ...image,
      viewportTarget: image.viewportTarget || image.viewport_target || "DESKTOP_TABLET",
      imageUrl: resolveAssetUrl(image.imageUrl),
    }))
    .filter((image) => image.imageUrl);

  const legacyImageUrl = resolveAssetUrl(hero?.imageUrl);
  const legacyImage = legacyImageUrl
    ? {
        id: "legacy",
        imageUrl: legacyImageUrl,
        imageAlt: hero?.imageAlt || "",
        viewportTarget: "DESKTOP_TABLET",
        sortOrder: 0,
      }
    : null;

  const desktopImage =
    normalizedImages.find((image) => image.viewportTarget === "DESKTOP_TABLET") ||
    legacyImage ||
    normalizedImages[0] ||
    null;
  const tabletLaptopImage =
    normalizedImages.find((image) => image.viewportTarget === "TABLET_LAPTOP") ||
    desktopImage ||
    legacyImage ||
    null;
  const mobileImage =
    normalizedImages.find((image) => image.viewportTarget === "MOBILE") ||
    tabletLaptopImage ||
    desktopImage ||
    legacyImage ||
    null;

  return { desktop: desktopImage, tabletLaptop: tabletLaptopImage, mobile: mobileImage };
}

function normalizeHeroHeightMode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return HERO_HEIGHT_MODES.has(normalized) ? normalized : "HALF_SCREEN";
}

function normalizeHeroDisplayMode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return HERO_DISPLAY_MODES.has(normalized) ? normalized : "SINGLE_IMAGE";
}

function getConfiguredHeroImages(hero, viewportTarget = "DESKTOP_TABLET") {
  const images = Array.isArray(hero?.images) ? hero.images : [];
  const activeImages = images
    .filter((image) => image?.imageUrl && image?.isActive !== false)
    .map((image) => ({
      ...image,
      viewportTarget: image.viewportTarget || image.viewport_target || "DESKTOP_TABLET",
      imageUrl: resolveAssetUrl(image.imageUrl),
    }))
    .filter((image) => image.imageUrl);
  const targetImages = activeImages.filter(
    (image) => image.viewportTarget === viewportTarget,
  );
  const carouselImages = (targetImages.length ? targetImages : activeImages)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));

  if (carouselImages.length) return carouselImages;

  return HERO_IMAGES.map((imageUrl, index) => ({
    id: `fallback-${index}`,
    imageUrl,
    imageAlt: hero?.imageAlt || "ESADAR",
    sortOrder: index,
  }));
}

function CatalogSortControl({ value, onChange, onApplied }) {
  const [draftSort, setDraftSort] = useState(value || initialFilters.sort);

  useEffect(() => {
    setDraftSort(value || initialFilters.sort);
  }, [value]);

  function applySort(nextSort = draftSort) {
    onChange(nextSort || initialFilters.sort);
    onApplied?.(nextSort || initialFilters.sort);
  }

  return (
    <>
      <label
        className="field-group mobile-sort-panel__field"
        htmlFor="mobile-sort-control"
      >
        <span>Ordenar prendas</span>
        <select
          id="mobile-sort-control"
          className="input"
          value={draftSort}
          onChange={(event) => setDraftSort(event.target.value)}
        >
          <option value="intake_desc">Ingreso más reciente</option>
          <option value="intake_asc">Ingreso más antiguo</option>
          <option value="price_asc">Precio menor a mayor</option>
          <option value="price_desc">Precio mayor a menor</option>
        </select>
      </label>
      <div className="filters-sidebar-actions mobile-sort-panel__actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => applySort()}
        >
          Aplicar orden
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => applySort(initialFilters.sort)}
        >
          Limpiar orden
        </button>
      </div>
    </>
  );
}

export default function HomePage() {
  const heroRef = useRef(null);
  const featuredSectionRef = useRef(null);
  const catalogSectionRef = useRef(null);
  const loadMoreRef = useRef(null);
  const lastAutoLoadPageRef = useRef(1);
  const pendingCatalogScrollRef = useRef(false);

  const { setHeroLogoVisible } = useOutletContext();
  const {
    setCatalogFiltersContent,
    setCatalogFiltersMeta,
    setCatalogSortContent,
    setCatalogSortMeta,
    notifyMobileStatus,
  } = useMobileMenu();

  const location = useLocation();
  const navigate = useNavigate();
  const { categoryOptions, brandOptions, sizeOptions, lookupError } =
    useLookups();
  const { site, pagesByRoute } = useSiteSeo();
  const { isAuthenticated } = useAuth();

  const [filters, setFilters] = useState(initialFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [featuredItems, setFeaturedItems] = useState([]);
  const [items, setItems] = useState([]);
  const [acceptedOffersByArticle, setAcceptedOffersByArticle] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: CATALOG_PAGE_SIZE,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [catalogReloadNonce, setCatalogReloadNonce] = useState(0);
  const [articlesExhausted, setArticlesExhausted] = useState(false);
  const [catalogTransitioning, setCatalogTransitioning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [leadForm, setLeadForm] = useState(initialLeadForm);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadSuccess, setLeadSuccess] = useState("");
  const [siteHero, setSiteHero] = useState(null);
  const [siteHeroLoaded, setSiteHeroLoaded] = useState(false);

  const pageSeo =
    location.pathname === "/articles"
      ? pagesByRoute["/articles"] || null
      : pagesByRoute["/"] || null;
  const currentSeoPath = location.pathname === "/articles" ? "/articles" : "/";

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
    params.set("pageSize", String(CATALOG_PAGE_SIZE));
    return params.toString();
  }, [filters, page]);

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (filters.search) {
      chips.push({ key: "search", label: `Búsqueda: ${filters.search}` });
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
        label: `Categoría: ${getLabel(categoryOptions, filters.categoryId, "Seleccionada")}`,
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
    if (filters.offerable) chips.push({ key: "offerable", label: "¡Ofertá!" });
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
        showSort={false}
      />
    ),
    [filters],
  );

  const mobileCatalogSortContent = useMemo(
    () => (
      <CatalogSortControl
        value={filters.sort}
        onChange={applyMobileSort}
        onApplied={() => setMobileFiltersOpen(false)}
      />
    ),
    [filters.sort],
  );

  const activeMobileFilterCount = activeFilterChips.filter(
    (chip) => chip.key !== "sort",
  ).length;
  const activeMobileSort = filters.sort !== initialFilters.sort;
  const configuredHeroSources = useMemo(
    () => getConfiguredHeroImageSources(siteHero),
    [siteHero],
  );
  const configuredHeroImages = useMemo(
    () => getConfiguredHeroImages(siteHero),
    [siteHero],
  );
  const heroHeightMode = normalizeHeroHeightMode(siteHero?.heroHeightMode);
  const heroDisplayMode = normalizeHeroDisplayMode(siteHero?.heroDisplayMode);
  const customHeroHeightVh =
    heroHeightMode === "CUSTOM"
      ? Math.min(100, Math.max(30, Number(siteHero?.customHeightVh || 70)))
      : null;
  const heroHeightClass =
    heroHeightMode === "FULL_SCREEN"
      ? "site-hero--full-screen"
      : heroHeightMode === "CUSTOM"
        ? "site-hero--custom"
        : heroHeightMode === "TABLET_LAPTOP"
          ? "site-hero--tablet-laptop"
          : "site-hero--half-screen";
  const shouldRenderSiteHero = siteHeroLoaded;
  const shouldRenderHeroCarousel =
    heroDisplayMode === "CAROUSEL" && configuredHeroImages.length > 1;
  const desktopHeroImage = configuredHeroSources.desktop || {
    imageUrl: HERO_IMAGES[0],
    imageAlt: siteHero?.imageAlt || "ESADAR",
  };
  const tabletLaptopHeroImage = configuredHeroSources.tabletLaptop || desktopHeroImage;
  const mobileHeroImage = configuredHeroSources.mobile || tabletLaptopHeroImage || desktopHeroImage;
  const selectedHeroImageUrl = desktopHeroImage.imageUrl;
  const selectedHeroImageAlt = desktopHeroImage.imageAlt || siteHero?.imageAlt || "ESADAR";
  const tabletLaptopHeroImageUrl = tabletLaptopHeroImage?.imageUrl || selectedHeroImageUrl;
  const mobileHeroImageUrl = mobileHeroImage?.imageUrl || tabletLaptopHeroImageUrl || selectedHeroImageUrl;
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);

  useEffect(() => {
    setHeroSlideIndex(0);
  }, [configuredHeroImages.length, heroDisplayMode]);

  useEffect(() => {
    if (!shouldRenderHeroCarousel) return undefined;
    const intervalId = window.setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % configuredHeroImages.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [configuredHeroImages.length, shouldRenderHeroCarousel]);

  useEffect(() => {
    let ignore = false;

    async function loadSiteHero(force = false) {
      try {
        const response = await cachedApiFetch("/api/site/hero", {
          ttlMs: 120000,
          force,
        });
        if (!ignore) setSiteHero(response.hero || null);
      } catch {
        if (!ignore) setSiteHero(null);
      } finally {
        if (!ignore) setSiteHeroLoaded(true);
      }
    }

    void loadSiteHero();
    const stopListening = listenPublicCacheInvalidation((detail = {}) => {
      const match = String(detail.match || "");
      if (match && !match.startsWith("/api/site")) return;
      void loadSiteHero(true);
    });

    return () => {
      ignore = true;
      stopListening();
    };
  }, []);

  useEffect(() => {
    const isCatalogView =
      location.pathname === "/" || location.pathname === "/articles";

    setCatalogFiltersContent(
      isCatalogView ? mobileCatalogFiltersContent : null,
    );
    setCatalogSortContent(isCatalogView ? mobileCatalogSortContent : null);

    return () => {
      setCatalogFiltersContent(null);
      setCatalogSortContent(null);
    };
  }, [
    location.pathname,
    mobileCatalogFiltersContent,
    mobileCatalogSortContent,
    setCatalogFiltersContent,
    setCatalogSortContent,
  ]);

  useEffect(() => {
    const isCatalogView =
      location.pathname === "/" || location.pathname === "/articles";

    setCatalogFiltersMeta({
      count: isCatalogView ? activeMobileFilterCount : 0,
      onClear: isCatalogView ? () => resetCatalogFilters() : null,
    });
    setCatalogSortMeta({
      active: isCatalogView ? activeMobileSort : false,
      onClear: isCatalogView ? () => resetSort() : null,
    });

    return () => {
      setCatalogFiltersMeta({ count: 0, onClear: null });
      setCatalogSortMeta({ active: false, onClear: null });
    };
  }, [
    activeMobileFilterCount,
    activeMobileSort,
    filters.brandId,
    filters.categoryId,
    filters.discounted,
    filters.featured,
    filters.offerable,
    filters.search,
    filters.sizeId,
    filters.sort,
    location.pathname,
    setCatalogFiltersMeta,
    setCatalogSortMeta,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(pagination.total || 0) /
        Math.max(1, Number(pagination.pageSize || CATALOG_PAGE_SIZE)),
    ),
  );

  const canLoadMore =
    !articlesExhausted &&
    items.length < Number(pagination.total || 0) &&
    page < totalPages;
  const showCatalogLoadingSplash =
    catalogTransitioning || (loading && page === 1 && items.length > 0);
  const showCatalogInitialLoading =
    loading && !items.length && !showCatalogLoadingSplash;

  function scrollCatalogToStart({
    behavior = "smooth",
    suppressFooterReveal = true,
  } = {}) {
    const section = catalogSectionRef.current;
    if (!section || typeof window === "undefined") return;

    if (suppressFooterReveal) {
      suppressFooterRevealForCatalogScroll();
    }

    scrollElementIntoViewWithSiteChromeOffset(section, {
      behavior,
      includeTicker: true,
      extra: window.matchMedia("(max-width: 960px)").matches ? 18 : 16,
      focus: true,
    });
  }

  function scheduleCatalogScroll(options = {}) {
    const { suppressFooterReveal = true } = options;

    if (suppressFooterReveal) {
      suppressFooterRevealForCatalogScroll();
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() =>
        scrollCatalogToStart({
          ...options,
          suppressFooterReveal: false,
        }),
      );
    });
  }

  useEffect(() => {
    const sentinel = loadMoreRef.current;

    if (
      !sentinel ||
      !canLoadMore ||
      loading ||
      loadingMore ||
      catalogTransitioning
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        setPage((current) => {
          const nextPage = current + 1;

          if (nextPage > totalPages) return current;
          if (lastAutoLoadPageRef.current >= nextPage) return current;

          lastAutoLoadPageRef.current = nextPage;
          return nextPage;
        });
      },
      { root: null, rootMargin: "220px 0px", threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, catalogTransitioning, loading, loadingMore, totalPages]);

  useEffect(() => {
    setHeroLogoVisible(false);
    return () => setHeroLogoVisible(false);
  }, [setHeroLogoVisible]);

  useEffect(() => {
    const isCatalogView =
      location.pathname === "/" || location.pathname === "/articles";

    if (!isCatalogView || typeof window === "undefined") return undefined;

    const shouldScrollToCatalog = shouldScrollToCatalogForLocation(location);

    if (!shouldScrollToCatalog) {
      pendingCatalogScrollRef.current = false;
      let secondTopFrame = 0;
      const topFrame = window.requestAnimationFrame(() => {
        secondTopFrame = window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        });
      });

      return () => {
        window.cancelAnimationFrame(topFrame);
        if (secondTopFrame) window.cancelAnimationFrame(secondTopFrame);
      };
    }

    pendingCatalogScrollRef.current = true;
    suppressFooterRevealForCatalogScroll();
    let secondScrollFrame = 0;
    const scrollFrame = window.requestAnimationFrame(() => {
      secondScrollFrame = window.requestAnimationFrame(() => {
        scrollCatalogToStart({ behavior: "auto", suppressFooterReveal: false });
      });
    });

    return () => {
      window.cancelAnimationFrame(scrollFrame);
      if (secondScrollFrame) window.cancelAnimationFrame(secondScrollFrame);
    };
  }, [location.key, location.pathname, location.search, location.state]);

  useEffect(() => {
    if (location.pathname !== "/articles") return;

    const nextFilters = readCatalogFiltersFromSearch(location.search);

    setFilters((current) =>
      areCatalogFiltersEqual(current, nextFilters) ? current : nextFilters,
    );

    lastAutoLoadPageRef.current = 1;
    setArticlesExhausted(false);
    setPage(1);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let ignore = false;

    async function loadFeatured() {
      try {
        const response = await cachedApiFetch(
          "/api/public/articles?featured=true&sort=intake_desc&page=1&pageSize=100",
          { ttlMs: 120000 },
        );
        if (!ignore) setFeaturedItems(response.items || []);
      } catch {
        if (!ignore) setFeaturedItems([]);
      }
    }

    const cancelIdleLoad = runWhenIdle(() => {
      void loadFeatured();
    });

    return () => {
      ignore = true;
      cancelIdleLoad();
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadAcceptedOffers() {
      if (!isAuthenticated) {
        setAcceptedOffersByArticle({});
        return;
      }
      try {
        const response = await apiFetch("/api/public/offers/accepted");
        if (ignore) return;
        const nextMap = {};
        (response.items || []).forEach((offer) => {
          if (offer.article?.id) {
            nextMap[Number(offer.article.id)] = {
              id: offer.id,
              price: Number(offer.offeredAmount || 0),
              offeredAmount: Number(offer.offeredAmount || 0),
              quantity: 1,
            };
          }
        });
        setAcceptedOffersByArticle(nextMap);
      } catch {
        if (!ignore) setAcceptedOffersByArticle({});
      }
    }

    const cancelIdleLoad = runWhenIdle(() => {
      void loadAcceptedOffers();
    });

    return () => {
      ignore = true;
      cancelIdleLoad();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    setItems((current) => mergeAcceptedOffers(current, acceptedOffersByArticle));
  }, [acceptedOffersByArticle]);

  useEffect(() => {
    return listenPublicCacheInvalidation((detail = {}) => {
      const match = String(detail.match || '');
      if (match && !match.startsWith('/api/public/articles')) return;
      lastAutoLoadPageRef.current = 1;
      setArticlesExhausted(false);
      setPage(1);
      setCatalogReloadNonce((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadArticles() {
      try {
        setError("");
        if (page === 1) setLoading(true);
        if (page > 1) setLoadingMore(true);

        const response = await cachedApiFetch(`/api/public/articles?${queryString}`, { ttlMs: 30000 });
        if (ignore) return;

        const nextItems = mergeAcceptedOffers(
          response.items || [],
          acceptedOffersByArticle,
        );
        const nextPagination = response.pagination || {
          page: 1,
          pageSize: CATALOG_PAGE_SIZE,
          total: 0,
        };

        setPagination(nextPagination);

        if (page === 1) {
          setArticlesExhausted(false);
          setItems(nextItems);
          return;
        }

        if (!nextItems.length) {
          setArticlesExhausted(true);
          return;
        }

        setItems((current) => [...current, ...nextItems]);
      } catch (err) {
        if (!ignore) {
          const message = err.message || "No se pudo cargar el catálogo";
          setError(message);
          notifyMobileStatus({ type: "error", icon: "error", message });
        }
      } finally {
        if (!ignore) {
          setCatalogTransitioning(false);
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    loadArticles();
    return () => {
      ignore = true;
    };
  }, [catalogReloadNonce, page, queryString]);

  useEffect(() => {
    if (location.pathname !== "/articles") return;
    if (!pendingCatalogScrollRef.current) return;
    if (loading || catalogTransitioning) return;

    pendingCatalogScrollRef.current = false;
    scheduleCatalogScroll({ behavior: "auto" });
  }, [
    catalogTransitioning,
    items.length,
    loading,
    location.pathname,
    location.search,
    pagination.total,
  ]);

  function resetPaginationState({ clearItems = true } = {}) {
    lastAutoLoadPageRef.current = 1;
    setArticlesExhausted(false);
    setCatalogTransitioning(true);
    if (clearItems) setItems([]);
    setPage(1);
    setCatalogReloadNonce((current) => current + 1);
  }

  function syncCatalogUrl(normalizedFilters, { catalogAction = false } = {}) {
    if (location.pathname !== "/articles") return;

    const nextSearch = buildCatalogSearch(normalizedFilters);
    const nextUrl = nextSearch ? `/articles?${nextSearch}` : "/articles";
    const currentUrl = `${location.pathname}${location.search}`;

    if (currentUrl !== nextUrl) {
      navigate(nextUrl, {
        replace: true,
        state: catalogAction
          ? { scrollToCatalog: true, source: "catalog-action" }
          : null,
      });
    }
  }

  function applyFilters(nextFilters, { scroll = true } = {}) {
    const normalizedFilters = normalizeCatalogFilters(nextFilters);
    const filtersChanged = !areCatalogFiltersEqual(filters, normalizedFilters);
    const shouldReloadEmptyCatalog =
      !filtersChanged && !loading && !items.length;

    syncCatalogUrl(normalizedFilters, { catalogAction: true });

    if (!filtersChanged && !shouldReloadEmptyCatalog) {
      return false;
    }

    resetPaginationState({ clearItems: false });
    setFilters(normalizedFilters);
    if (scroll) scheduleCatalogScroll();
    return true;
  }

  function applyMobileFilters(nextFilters) {
    const applied = applyFilters(nextFilters, { scroll: false });
    setMobileFiltersOpen(false);
    if (applied) {
      scheduleCatalogScroll();
      notifyMobileStatus({
        type: "filters",
        icon: "filters",
        message: "Filtros aplicados",
      });
    }
  }

  function applyMobileSort(nextSort) {
    const safeSort = nextSort || initialFilters.sort;
    const applied = applyFilters(
      { ...filters, sort: safeSort },
      { scroll: false },
    );
    setMobileFiltersOpen(false);

    if (applied) {
      scheduleCatalogScroll();
      notifyMobileStatus({
        type: "sort",
        icon: "sort",
        message:
          safeSort !== initialFilters.sort
            ? "Ordenamiento aplicado sin quitar filtros"
            : "Ordenamiento restablecido",
      });
    }
  }

  function resetCatalogFilters() {
    applyFilters({ ...initialFilters, sort: filters.sort }, { scroll: false });
    setMobileFiltersOpen(false);
    scheduleCatalogScroll();
    notifyMobileStatus({
      type: "filters",
      icon: "filters",
      message: "Filtros restablecidos sin cambiar el orden",
    });
  }

  function resetSort() {
    applyFilters({ ...filters, sort: initialFilters.sort }, { scroll: false });
    setMobileFiltersOpen(false);
    scheduleCatalogScroll();
    notifyMobileStatus({
      type: "sort",
      icon: "sort",
      message: "Ordenamiento restablecido",
    });
  }

  function resetFilters() {
    applyFilters({ ...initialFilters, sort: filters.sort }, { scroll: false });
    scheduleCatalogScroll();
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
  }

  return (
    <div className="home-page page-stack page-stack-wide">
      <SeoHead
        title={pageSeo?.title || `${site.name} | Ropa`}
        description={pageSeo?.description || site.description}
        canonical={pageSeo?.canonicalUrl || toAbsoluteUrl(currentSeoPath, site)}
        url={toAbsoluteUrl(currentSeoPath, site)}
        image={toAbsoluteUrl(selectedHeroImageUrl, site)}
        jsonLd={[
          { id: "organization", data: buildOrganizationJsonLd(site) },
          { id: "website", data: buildWebsiteJsonLd(site) },
        ]}
      />

      {shouldRenderSiteHero ? (
        <section
          ref={heroRef}
          className={[
            "home-hero-section",
            "site-hero",
            "site-hero--configured",
            heroHeightClass,
            shouldRenderHeroCarousel ? "site-hero--carousel" : "site-hero--single",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            customHeroHeightVh
              ? { "--hero-height": `${customHeroHeightVh}vh` }
              : undefined
          }
          aria-label="Imagen destacada"
        >
        {shouldRenderHeroCarousel ? (
          <div className="home-hero-frame home-hero-carousel" aria-roledescription="carousel">
            {configuredHeroImages.map((image, index) => (
              <picture
                className={[
                  "home-hero-picture",
                  "home-hero-carousel__slide",
                  index === heroSlideIndex ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={image.id || image.imageUrl}
                aria-hidden={index === heroSlideIndex ? undefined : "true"}
              >
                <img
                  src={image.imageUrl}
                  alt={image.imageAlt || siteHero?.imageAlt || "ESADAR"}
                  className="home-hero-image"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "auto"}
                />
              </picture>
            ))}
          </div>
        ) : (
          <figure className="home-hero-frame">
            <picture className="home-hero-picture">
              {mobileHeroImageUrl && mobileHeroImageUrl !== selectedHeroImageUrl ? (
                <source media="(max-width: 767px)" srcSet={mobileHeroImageUrl} />
              ) : null}
              {tabletLaptopHeroImageUrl && tabletLaptopHeroImageUrl !== selectedHeroImageUrl ? (
                <source
                  media="(min-width: 768px) and (max-width: 1280px)"
                  srcSet={tabletLaptopHeroImageUrl}
                />
              ) : null}
              <img
                src={selectedHeroImageUrl}
                alt={selectedHeroImageAlt}
                className="home-hero-image"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </picture>
          </figure>
        )}
        </section>
      ) : null}

      {/* <section className="container value-hero-card section-card">
        <div className="value-hero-copy">
          <p className="section-kicker">ESADAR</p>
          <h1>Ropa seleccionada</h1>
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
            Ver catálogo
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
      </section> */}

      <section ref={featuredSectionRef} id="featured">
        <FeaturedMotionCards
          title="Destacados y descuentos"
          items={featuredItems}
          railControlsClassName={
            location.pathname === "/articles"
              ? "scroll-rail-controls--left"
              : ""
          }
        />
      </section>

      {/* <section
        className="mobile-catalog-filter-shell container"
        aria-label="Filtros del catálogo"
      >
        <button
          type="button"
          className="mobile-catalog-filter-trigger"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((current) => !current)}
        >
          <span>Filtros</span>
          <strong>
            {activeFilterChips.length
              ? `${activeFilterChips.length} activos`
              : "Buscar y filtrar"}
          </strong>
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
          <div
            className="active-filters-row active-filters-row--mobile-sticky"
            aria-label="Filtros activos"
          >
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
      </section> */}

      <section
        ref={catalogSectionRef}
        id="catalog"
        className="catalog-wide container"
        tabIndex={-1}
      >
        <ArticleFilters
          value={filters}
          onChange={applyFilters}
          idPrefix="desktop-filter"
        />

        <div
          className={`catalog-content${showCatalogLoadingSplash ? " catalog-content--loading" : ""}`}
        >
          {showCatalogLoadingSplash ? (
            <div
              className="catalog-filter-loading-splash"
              aria-live="polite"
              aria-label="Cargando filtros"
            >
              <div className="catalog-filter-loading-splash__logo-wrap">
                <img
                  src={esadarWordmark}
                  alt=""
                  className="catalog-filter-loading-splash__logo"
                  decoding="async"
                />
                <span className="sr-only">Cargando filtros</span>
              </div>
            </div>
          ) : null}

          <div className="catalog-summary-row">
            <div>
              <p className="section-kicker">Catálogo</p>
              <h2>{pagination.total || items.length} artículos disponibles</h2>
            </div>
          </div>

          {lookupError ? <p className="muted-copy">{lookupError}</p> : null}

          {/* <div
            className="catalog-quick-actions"
            aria-label="Acciones rápidas del catálogo"
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

          {showCatalogInitialLoading ? (
            <div className="centered-card section-card">
              <AppLoader variant="inline" label="Cargando prendas seleccionadas" />
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
                  Prueba quitar alguna selección o volver a mirar lo más
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
            <div
              ref={loadMoreRef}
              className="infinite-scroll-sentinel"
              aria-live="polite"
            >
              {/* <span className="muted-copy">
                {loadingMore
                  ? "Ver mas prendas"
                  : "Desliza para cargar mas prendas"}
              </span> */}
            </div>
          ) : null}
        </div>
      </section>

      <LeadCaptureCta className="container" />
    </div>
  );
}
