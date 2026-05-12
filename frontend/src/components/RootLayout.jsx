import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Header from "./Header.jsx";
import AppBreadcrumbs from "./AppBreadcrumbs.jsx";
import ScrollChrome from "./ScrollChrome.jsx";
import FooterScrollScene from "./FooterScrollScene.jsx";
import SeoHead from "./SeoHead.jsx";
import ResponsiveTableLabels from "./ResponsiveTableLabels.jsx";
import AppSnackbar from "./AppSnackbar.jsx";
import { MobileMenuProvider } from "../contexts/MobileMenuContext.jsx";
import esadarWordmark from "../assets/esadar-wordmark.png";

const INTRO_INITIAL_VISIBLE_MS = 3300;
const INTRO_INITIAL_FADE_MS = 650;
const INTRO_REPLAY_VISIBLE_MS = 1700;
const INTRO_REPLAY_FADE_MS = 520;
const CART_REPLAY_VISIBLE_MS = 650;
const CART_REPLAY_FADE_MS = 350;

export default function RootLayout() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [heroLogoVisible, setHeroLogoVisible] = useState(false);
  const [introStage, setIntroStage] = useState("hidden");
  const [introKey, setIntroKey] = useState(0);
  const [introDuration, setIntroDuration] = useState(INTRO_INITIAL_VISIBLE_MS);
  const [introFadeDuration, setIntroFadeDuration] = useState(
    INTRO_INITIAL_FADE_MS,
  );
  const [breadcrumbLabelOverrides, setBreadcrumbLabelOverrides] = useState({});
  const didInitialIntro = useRef(false);
  const scrollPositionsRef = useRef(new Map());
  const isHome = location.pathname === "/";
  const isHeroView = isHome || location.pathname === "/articles";
  const isCheckoutView = location.pathname.startsWith("/checkout");
  const isAdminView = location.pathname.startsWith("/admin");
  const isAuthView = ["/login", "/register"].includes(location.pathname);
  const isAccountView = location.pathname.startsWith("/cuenta");
  const shouldNoIndex =
    isCheckoutView || isAdminView || isAuthView || isAccountView;

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
    const restoreTop = shouldPreserveScroll
      ? window.scrollY || document.documentElement.scrollTop || 0
      : navigationType === "POP"
        ? scrollPositionsRef.current.get(location.key) || 0
        : 0;

    if (!shouldPreserveScroll) {
      window.scrollTo({ top: restoreTop, left: 0, behavior: "auto" });
    }

    return () => {
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
  }, [location.key, location.state, navigationType]);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const wantsReplay = Boolean(location.state?.replayIntro);
    const shouldShowInitial = !didInitialIntro.current;
    const shouldShowIntro = !reduceMotion && (shouldShowInitial || wantsReplay);

    didInitialIntro.current = true;

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
    const hideTimer = window.setTimeout(
      () => setIntroStage("hidden"),
      visibleMs + fadeMs,
    );

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [location.key, location.state]);

  const showIntro = introStage !== "hidden";
  const appShellClassName = [
    "app-shell",
    !shouldNoIndex ? "app-shell--has-footer-reveal" : "",
    showIntro ? "app-shell--intro-active" : "",
    isCheckoutView ? "app-shell--checkout-view" : "",
    isAdminView ? "app-shell--admin-view" : "",
    isAccountView ? "app-shell--account-view" : "",
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
        <Header hideBrand={isHome && heroLogoVisible} />
        <AppSnackbar />
        <main className={`page-shell${isHeroView ? " page-shell--hero" : ""}`}>
          <AppBreadcrumbs labelOverrides={breadcrumbLabelOverrides} />
          <div className="page-transition-shell">
            <Suspense fallback={<div className="centered-card">Cargando...</div>}>
              <Outlet context={{ setHeroLogoVisible, setBreadcrumbLabelOverrides }} />
            </Suspense>
          </div>
        </main>
      </MobileMenuProvider>
      {!shouldNoIndex ? <FooterScrollScene /> : null}
      <ScrollChrome />

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
