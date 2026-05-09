import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Header from "./Header.jsx";
import AppBreadcrumbs from "./AppBreadcrumbs.jsx";
import ThemeDock from "./ThemeDock.jsx";
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
  const isCheckoutView = location.pathname.startsWith("/checkout");
  const isAdminView = location.pathname.startsWith("/admin");
  const isAuthView = ["/login", "/register"].includes(location.pathname);
  const isAccountView = location.pathname.startsWith("/cuenta");
  const shouldNoIndex =
    isCheckoutView || isAdminView || isAuthView || isAccountView;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const restoreTop =
      navigationType === "POP"
        ? scrollPositionsRef.current.get(location.key) || 0
        : 0;

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: restoreTop, left: 0, behavior: "auto" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
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
  }, [location.key, navigationType]);

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

  return (
    <div
      className={`app-shell${showIntro ? " app-shell--intro-active" : ""}${isCheckoutView ? " app-shell--checkout-view" : ""}${isAdminView ? " app-shell--admin-view" : ""}${isAccountView ? " app-shell--account-view" : ""}`}
    >
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
        <main className="page-shell">
          <AppBreadcrumbs labelOverrides={breadcrumbLabelOverrides} />
          <div className="page-transition-shell">
            <Outlet context={{ setHeroLogoVisible, setBreadcrumbLabelOverrides }} />
          </div>
        </main>
      </MobileMenuProvider>
      {!shouldNoIndex ? <FooterScrollScene /> : null}
      <ThemeDock />
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
            <img src={esadarWordmark} alt="" className="intro-splash__logo" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
