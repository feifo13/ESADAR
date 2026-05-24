import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Header from "./Header.jsx";
import AppBreadcrumbs from "./AppBreadcrumbs.jsx";
import ScrollChrome from "./ScrollChrome.jsx";
import Footer from "./Footer.jsx";
import FooterScrollScene from "./FooterScrollScene.jsx";
import SeoHead from "./SeoHead.jsx";
import ResponsiveTableLabels from "./ResponsiveTableLabels.jsx";
import AppSnackbar from "./AppSnackbar.jsx";
import OfferTicker from "./OfferTicker.jsx";
import { MobileMenuProvider } from "../contexts/MobileMenuContext.jsx";
import esadarWordmark from "../assets/esadar-wordmark.webp";
import AppLoader from "./AppLoader.jsx";
import { trackPublicPageVisit } from "../lib/pageVisits.js";
import { cachedApiFetch, listenPublicCacheInvalidation } from "../lib/api.js";
import { DEFAULT_SITE_TICKER, normalizeSiteTicker } from "../lib/siteTicker.js";
import {
  applyMobileDebugClasses,
  getMobileDebugFlags,
  syncMobileDebugFlagsFromUrl,
} from "../lib/mobileDebugFlags.js";

const INTRO_INITIAL_VISIBLE_MS = 3300;
const INTRO_INITIAL_FADE_MS = 650;
const INTRO_REPLAY_VISIBLE_MS = 1700;
const INTRO_REPLAY_FADE_MS = 520;
const CART_REPLAY_VISIBLE_MS = 650;
const CART_REPLAY_FADE_MS = 350;
const MOBILE_DEBUG_BADGE_LABELS = [
  ["disableFooterRevealMobile", "footer off"],
  ["disableVisualViewport", "visualViewport off"],
  ["disableFooterCurtainCover", "curtain off"],
  ["disableCardContentVisibility", "content-visibility off"],
  ["pauseTickerMobile", "ticker paused"],
  ["unifyMobileChrome", "chrome unified"],
  ["disableTickerFixedMobile", "ticker relative"],
];

function isCompactViewport() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 960px)").matches;
  }
  return window.innerWidth <= 960;
}

function useCompactViewport() {
  const [isCompact, setIsCompact] = useState(() => isCompactViewport());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia?.("(max-width: 960px)");
    const syncCompactViewport = () => setIsCompact(isCompactViewport());

    syncCompactViewport();
    window.addEventListener("resize", syncCompactViewport);
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", syncCompactViewport);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(syncCompactViewport);
    }

    return () => {
      window.removeEventListener("resize", syncCompactViewport);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", syncCompactViewport);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(syncCompactViewport);
      }
    };
  }, []);

  return isCompact;
}

function MobileDebugBadge({ flags }) {
  if (!flags.enabled || flags.hideDebugBadge) return null;

  const activeLabels = MOBILE_DEBUG_BADGE_LABELS.filter(
    ([flagName]) => flags[flagName],
  ).map(([, label]) => label);

  return (
    <aside className="mobile-debug-badge" aria-label="ESADAR mobile debug">
      <strong>ESADAR DEBUG MOBILE</strong>
      <span>{activeLabels.length ? activeLabels.join(" | ") : "baseline"}</span>
    </aside>
  );
}

function setWindowScrollTop(top) {
  if (typeof window === "undefined") return;
  window.scrollTo({ top, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
}

function guardFooterRevealDuringNavigation(durationMs) {
  if (typeof window === "undefined") return 0;

  const until = Date.now() + durationMs;
  window.__esadarFooterSuppressUntil = Math.max(
    Number(window.__esadarFooterSuppressUntil || 0),
    until,
  );

  document
    .querySelector(".app-shell")
    ?.classList.add("app-shell--footer-navigation-guard");

  window.dispatchEvent(
    new CustomEvent("esadar:suppress-footer-reveal", {
      detail: { untilManual: true, duration: durationMs },
    }),
  );

  return until;
}

function releaseFooterRevealNavigationGuard() {
  if (typeof window === "undefined") return;

  const suppressUntil = Number(window.__esadarFooterSuppressUntil || 0);
  if (suppressUntil && Date.now() < suppressUntil) return;

  window.__esadarFooterSuppressUntil = 0;
  document
    .querySelector(".app-shell")
    ?.classList.remove("app-shell--footer-navigation-guard");

  window.dispatchEvent(
    new CustomEvent("esadar:suppress-footer-reveal", {
      detail: { release: true },
    }),
  );
}

function getPublicPageVisitForPath(pathname) {
  switch (pathname) {
    case "/":
      return { pageType: "HOME", route: "/" };
    case "/articles":
      return { pageType: "CATALOG", route: "/articles" };
    case "/guia-de-compra":
      return { pageType: "PURCHASE_GUIDE", route: "/guia-de-compra" };
    case "/terminos-y-condiciones":
      return { pageType: "TERMS", route: "/terminos-y-condiciones" };
    case "/contact":
      return { pageType: "CONTACT", route: "/contact" };
    default:
      return null;
  }
}

export default function RootLayout() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isCompact = useCompactViewport();
  const [mobileDebugFlags, setMobileDebugFlags] = useState(() =>
    getMobileDebugFlags(),
  );
  const [heroLogoVisible, setHeroLogoVisible] = useState(false);
  const [introStage, setIntroStage] = useState("visible");
  const [introKey, setIntroKey] = useState(0);
  const [introDuration, setIntroDuration] = useState(INTRO_INITIAL_VISIBLE_MS);
  const [introFadeDuration, setIntroFadeDuration] = useState(
    INTRO_INITIAL_FADE_MS,
  );
  const [breadcrumbLabelOverrides, setBreadcrumbLabelOverrides] = useState({});
  const [contentReadyKey, setContentReadyKey] = useState(null);
  const [offerTickerConfig, setOfferTickerConfig] = useState(null);
  const didInitialIntro = useRef(false);
  const scrollPositionsRef = useRef(new Map());
  const isHome = location.pathname === "/";
  const isHeroView = isHome || location.pathname === "/articles";
  const isCheckoutView = location.pathname.startsWith("/checkout");
  const isAdminView = location.pathname.startsWith("/admin");
  const isAuthView = ["/login", "/register"].includes(location.pathname);
  const isAccountView = location.pathname.startsWith("/cuenta");
  const isPublicArticleView =
    location.pathname === "/articles" ||
    location.pathname.startsWith("/articles/");
  const showOfferTicker =
    Boolean(offerTickerConfig?.isEnabled) && (isHome || isAccountView || isPublicArticleView);
  const offerTicker = offerTickerConfig || DEFAULT_SITE_TICKER;
  const showStickyOfferTicker = showOfferTicker && Boolean(offerTicker.isSticky);
  const isFooterHiddenView = [
    "/guia-de-compra",
    "/terminos-y-condiciones",
  ].includes(location.pathname);
  const shouldNoIndex =
    isCheckoutView || isAdminView || isAuthView || isAccountView;
  const disableFooterRevealForMobile =
    mobileDebugFlags.disableFooterRevealMobile && isCompact;
  const hasFooterReveal =
    !shouldNoIndex && !isFooterHiddenView && !disableFooterRevealForMobile;
  const showBreadcrumbs = true;

  useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;

    const nextFlags = syncMobileDebugFlagsFromUrl();
    applyMobileDebugClasses(document.documentElement, nextFlags);
    setMobileDebugFlags(nextFlags);
    return undefined;
  }, [location.search]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) {
      return undefined;
    }

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    function handlePageShow(event) {
      if (!event.persisted) return;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    const shouldPreserveScroll = Boolean(location.state?.preserveScroll);
    const shouldRouteControlScroll = Boolean(
      location.state?.scrollToCatalog ||
        location.state?.source === "header-search" ||
        location.state?.source === "catalog-action" ||
        (location.pathname === "/articles" && location.search),
    );
    const restoreTop = shouldPreserveScroll
      ? window.scrollY || document.documentElement.scrollTop || 0
      : navigationType === "POP"
        ? scrollPositionsRef.current.get(location.key) || 0
        : 0;
    const guardMs = isCompactViewport() ? 1500 : 900;
    const scheduledFrames = [];
    const scheduledTimers = [];

    if (hasFooterReveal) {
      guardFooterRevealDuringNavigation(guardMs);
    }

    if (!shouldPreserveScroll && !shouldRouteControlScroll) {
      setWindowScrollTop(restoreTop);

      scheduledFrames.push(
        window.requestAnimationFrame(() => {
          setWindowScrollTop(restoreTop);
          scheduledFrames.push(
            window.requestAnimationFrame(() => setWindowScrollTop(restoreTop)),
          );
        }),
      );

      scheduledTimers.push(
        window.setTimeout(
          () => setWindowScrollTop(restoreTop),
          isCompactViewport() ? 360 : 120,
        ),
      );
    }

    return () => {
      scheduledFrames.forEach((frameId) => window.cancelAnimationFrame(frameId));
      scheduledTimers.forEach((timerId) => window.clearTimeout(timerId));

      const appShell = document.querySelector(".app-shell");
      const footerRevealActive = appShell?.classList.contains(
        "app-shell--footer-scroll-active",
      );
      scrollPositionsRef.current.set(
        location.key,
        footerRevealActive
          ? 0
          : window.scrollY || document.documentElement.scrollTop || 0,
      );
    };
  }, [hasFooterReveal, location.key, location.state, navigationType]);

  useEffect(() => {
    const wantsReplay = Boolean(location.state?.replayIntro);
    const shouldShowInitial = !didInitialIntro.current;
    const shouldShowIntro = shouldShowInitial || wantsReplay;

    if (!shouldShowIntro) {
      setIntroStage("hidden");
      return undefined;
    }

    const replayReason = location.state?.replayIntroReason;
    const isCartReplay = replayReason === "cart";

    const visibleMs = shouldShowInitial
      ? INTRO_INITIAL_VISIBLE_MS
      : isCartReplay
        ? CART_REPLAY_VISIBLE_MS
        : INTRO_REPLAY_VISIBLE_MS;
    const fadeMs = shouldShowInitial
      ? INTRO_INITIAL_FADE_MS
      : isCartReplay
        ? CART_REPLAY_FADE_MS
        : INTRO_REPLAY_FADE_MS;

    setIntroDuration(visibleMs);
    setIntroFadeDuration(fadeMs);
    setIntroKey((current) => current + 1);
    setIntroStage("visible");

    const fadeTimer = window.setTimeout(
      () => setIntroStage("fading"),
      visibleMs,
    );
    const hideTimer = window.setTimeout(() => {
      if (shouldShowInitial) {
        didInitialIntro.current = true;
      }
      setIntroStage("hidden");
    }, visibleMs + fadeMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [location.key, location.state]);

  useEffect(() => {
    const visit = getPublicPageVisitForPath(location.pathname);
    if (visit) trackPublicPageVisit(visit);
  }, [location.pathname]);

  useEffect(() => {
    let ignore = false;

    async function loadTicker(force = false) {
      try {
        const response = await cachedApiFetch("/api/site/ticker", {
          ttlMs: 120000,
          force,
        });
        if (!ignore) setOfferTickerConfig(normalizeSiteTicker(response.ticker));
      } catch {
        if (!ignore) setOfferTickerConfig(DEFAULT_SITE_TICKER);
      }
    }

    void loadTicker();
    const stopListening = listenPublicCacheInvalidation((detail = {}) => {
      const match = String(detail.match || "");
      if (match && !match.startsWith("/api/site")) return;
      void loadTicker(true);
    });

    return () => {
      ignore = true;
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setContentReadyKey(location.key);
      return undefined;
    }

    let releaseTimer = 0;
    const readyTimer = window.setTimeout(() => {
      setContentReadyKey(location.key);

      const suppressUntil = Number(window.__esadarFooterSuppressUntil || 0);
      const releaseDelay = Math.max(220, suppressUntil - Date.now() + 48);
      releaseTimer = window.setTimeout(() => {
        releaseFooterRevealNavigationGuard();
      }, releaseDelay);
    }, 160);

    return () => {
      window.clearTimeout(readyTimer);
      if (releaseTimer) window.clearTimeout(releaseTimer);
    };
  }, [location.key]);

  const showIntro = introStage !== "hidden";
  const contentReady = contentReadyKey === location.key;
  const showStaticDebugFooter =
    disableFooterRevealForMobile && !shouldNoIndex && !isFooterHiddenView && contentReady && !showIntro;
  const appShellClassName = [
    "app-shell",
    hasFooterReveal ? "app-shell--has-footer-reveal" : "",
    showIntro ? "app-shell--intro-active" : "",
    contentReady && !showIntro ? "app-shell--content-ready" : "app-shell--route-loading",
    isCheckoutView ? "app-shell--checkout-view" : "",
    isAdminView ? "app-shell--admin-view" : "",
    isAccountView ? "app-shell--account-view" : "",
    showOfferTicker ? "app-shell--has-offer-ticker" : "",
    showStickyOfferTicker ? "app-shell--offer-ticker-sticky" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={appShellClassName}>
      <ResponsiveTableLabels />
      {shouldNoIndex ? (
        <SeoHead
          title={`ESADAR | ${isAdminView ? "Backoffice" : isCheckoutView ? "Checkout" : "Acceso"}`}
          description="Vista interna o transaccional de ESADAR."
          noindex
        />
      ) : null}
      <MobileMenuProvider>
        <div
          className={[
            "site-chrome",
            showOfferTicker ? "site-chrome--has-ticker" : "",
            showStickyOfferTicker ? "site-chrome--ticker-sticky" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Header hideBrand={isHome && heroLogoVisible} />
          {showOfferTicker ? (
            <OfferTicker className="page-offer-ticker" config={offerTicker} />
          ) : null}
        </div>
        <AppSnackbar />
        <main className={`page-shell${isHeroView ? " page-shell--hero" : ""}`}>
          {showBreadcrumbs ? <AppBreadcrumbs labelOverrides={breadcrumbLabelOverrides} /> : null}
          <div className="page-transition-shell">
            <Suspense fallback={<AppLoader variant="page" label="Cargando vista" />}>
              <Outlet context={{ setHeroLogoVisible, setBreadcrumbLabelOverrides }} />
            </Suspense>
          </div>
        </main>
      </MobileMenuProvider>
      {hasFooterReveal && contentReady && !showIntro ? (
        <FooterScrollScene
          disableVisualViewport={mobileDebugFlags.disableVisualViewport}
          disableFooterCurtainCover={mobileDebugFlags.disableFooterCurtainCover}
        />
      ) : null}
      {showStaticDebugFooter ? <Footer /> : null}
      <ScrollChrome />
      <MobileDebugBadge flags={mobileDebugFlags} />

      {showIntro ? (
        <div
          key={introKey}
          className={`intro-splash${introStage === "fading" ? " intro-splash--fade-out" : ""}`}
          style={{
            "--intro-logo-duration": `${introDuration}ms`,
            "--intro-fade-duration": `${introFadeDuration}ms`,
          }}
          aria-hidden="true"
        >
          <div className="intro-splash__logo-wrap">
            <img src={esadarWordmark} alt="" className="intro-splash__logo" decoding="async" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
