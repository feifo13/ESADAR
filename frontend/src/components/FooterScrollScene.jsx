import { Link, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import esadarWordmark from "../assets/esadar-wordmark.webp";
import { ESADAR_SOCIAL_LINKS, handleMobileSocialLink } from "../lib/socialLinks.js";
import { getSiteChromeOffset } from "../lib/siteChromeOffset.js";


function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M14.2 8.28h2.38V4.36A30.77 30.77 0 0 0 13.1 4c-3.45 0-5.82 2.04-5.82 5.78v3.22H3.38v4.38h3.9V28h4.78V17.38h3.74l.6-4.38h-4.34V10.2c0-1.27.35-1.92 2.14-1.92Z"
        transform="scale(.75)"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5Zm8.75 2.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </svg>
  );
}

function SocialIcon({ type }) {
  if (type === "facebook") return <FacebookIcon />;
  if (type === "instagram") return <InstagramIcon />;
  return null;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function isCompactDebugViewport() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 960px)").matches;
  }
  return window.innerWidth <= 960;
}

function isMobileDebugFlagActive(flags, key) {
  return Boolean(flags?.enabled && flags[key] && isCompactDebugViewport());
}

export default function FooterScrollScene({ mobileDebugFlags = null }) {
  const sceneRef = useRef(null);
  const suppressRevealUntilRef = useRef(0);
  const suppressRevealUntilManualRef = useRef(false);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  function handleLogoClick() {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const appShell = document.querySelector(".app-shell");
    if (!appShell) return;

    appShell.style.setProperty("--footer-scroll-progress", "0");
    appShell.style.setProperty("--header-footer-hide-progress", "0");
    appShell.style.setProperty("--footer-header-cover-progress", "0");
    appShell.style.setProperty("--footer-header-cover-offset", "-140px");
    appShell.classList.remove(
      "app-shell--footer-scroll-active",
      "app-shell--footer-scroll-deep",
      "app-shell--footer-curtain-cover",
      "app-shell--footer-reveal-suppressed",
    );
  }, [location.key]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    const appShell = document.querySelector(".app-shell");
    const footer = sceneRef.current;
    if (!appShell || !footer) return undefined;

    let frameId = 0;
    let suppressTimerId = 0;
    const disableFooterRevealMobile = isMobileDebugFlagActive(
      mobileDebugFlags,
      "disableFooterRevealMobile",
    );
    const disableVisualViewport = isMobileDebugFlagActive(
      mobileDebugFlags,
      "disableVisualViewport",
    );
    const disableFooterCurtainCover = isMobileDebugFlagActive(
      mobileDebugFlags,
      "disableFooterCurtainCover",
    );

    function setFooterRevealSuppressed(isSuppressed) {
      appShell.classList.toggle(
        "app-shell--footer-reveal-suppressed",
        Boolean(isSuppressed),
      );
    }

    function resetFooterReveal() {
      appShell.style.setProperty("--footer-scroll-progress", "0");
      appShell.style.setProperty("--header-footer-hide-progress", "0");
      appShell.style.setProperty("--footer-header-cover-progress", "0");
      appShell.style.setProperty("--footer-header-cover-offset", "-140px");
      appShell.classList.remove(
        "app-shell--footer-scroll-active",
        "app-shell--footer-scroll-deep",
        "app-shell--footer-curtain-cover",
      );
    }

    if (disableFooterRevealMobile) {
      setFooterRevealSuppressed(false);
      resetFooterReveal();
      return undefined;
    }

    function update() {
      frameId = 0;

      const globalSuppressUntil = Number(
        window.__esadarFooterSuppressUntil || 0,
      );
      if (
        suppressRevealUntilManualRef.current ||
        Date.now() < suppressRevealUntilRef.current ||
        Date.now() < globalSuppressUntil ||
        appShell.classList.contains("app-shell--footer-navigation-guard")
      ) {
        setFooterRevealSuppressed(true);
        resetFooterReveal();
        return;
      }

      setFooterRevealSuppressed(false);

      const visualViewportHeight = disableVisualViewport
        ? 0
        : Number(window.visualViewport?.height || 0);
      const layoutViewportHeight = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0,
        visualViewportHeight,
        1,
      );
      const viewportHeights = [
        document.documentElement.clientHeight,
        window.innerHeight,
        visualViewportHeight,
      ].filter((height) => Number.isFinite(height) && height > 0);
      if (!viewportHeights.length) viewportHeights.push(layoutViewportHeight);

      const scrollingElement =
        document.scrollingElement || document.documentElement;
      const documentHeight = Math.max(
        scrollingElement?.scrollHeight || 0,
        document.documentElement.scrollHeight || 0,
        document.body?.scrollHeight || 0,
        1,
      );
      const footerViewportHeight = footer.getBoundingClientRect().height || 0;
      const revealViewportHeight = Math.max(
        footerViewportHeight,
        layoutViewportHeight,
        1,
      );
      const isCompactViewport =
        window.matchMedia?.("(max-width: 960px)")?.matches ||
        window.innerWidth <= 960;
      const headerHeight = Math.max(
        getSiteChromeOffset({ includeTicker: true, extra: 0 }),
        74,
      );
      const scrollTop = Math.max(
        window.scrollY || 0,
        scrollingElement?.scrollTop || 0,
        document.documentElement.scrollTop || 0,
        document.body?.scrollTop || 0,
      );
      const remainingScroll = Math.max(
        0,
        Math.min(
          ...viewportHeights.map(
            (viewportHeight) => documentHeight - scrollTop - viewportHeight,
          ),
        ),
      );
      const revealProgress = clamp01(
        1 - remainingScroll / Math.max(revealViewportHeight * 0.92, 1),
      );
      const headerHideProgress = prefersReducedMotion
        ? revealProgress >= 0.58
          ? 1
          : 0
        : clamp01((revealProgress - 0.44) / 0.28);
      const browserChromeHint = disableVisualViewport
        ? 0
        : Math.max(0, (window.innerHeight || 0) - visualViewportHeight);
      const coverStartDistance = Math.max(
        headerHeight + 96,
        browserChromeHint + headerHeight + 64,
      );
      const coverFullDistance = Math.max(18, browserChromeHint + 18);
      const rawHeaderCoverProgress =
        !disableFooterCurtainCover && isCompactViewport
          ? clamp01(
              (coverStartDistance - remainingScroll) /
                Math.max(coverStartDistance - coverFullDistance, 1),
            )
          : 0;
      const headerCoverProgress = isCompactViewport
        ? rawHeaderCoverProgress *
          rawHeaderCoverProgress *
          (3 - 2 * rawHeaderCoverProgress)
        : 0;
      const headerCoverTravel = headerHeight + 42;

      appShell.style.setProperty(
        "--footer-scroll-progress",
        String(revealProgress),
      );
      appShell.style.setProperty(
        "--header-footer-hide-progress",
        String(headerHideProgress),
      );
      appShell.style.setProperty(
        "--footer-header-cover-progress",
        String(headerCoverProgress),
      );
      appShell.style.setProperty(
        "--footer-header-cover-offset",
        `${-headerCoverTravel * (1 - headerCoverProgress)}px`,
      );
      appShell.classList.toggle(
        "app-shell--footer-scroll-active",
        revealProgress > 0.01,
      );
      appShell.classList.toggle(
        "app-shell--footer-curtain-cover",
        !disableFooterCurtainCover && headerCoverProgress > 0.001,
      );
      const compactEndThreshold = Math.max(24, layoutViewportHeight * 0.04);
      const isDeepFooterReveal = isCompactViewport
        ? revealProgress > 0.965 || remainingScroll <= compactEndThreshold
        : headerHideProgress > 0.88;

      appShell.classList.toggle(
        "app-shell--footer-scroll-deep",
        isDeepFooterReveal,
      );
    }

    function scheduleUpdate() {
      if (frameId) return;
      frameId = window.requestAnimationFrame(update);
    }

    function handleSuppressFooterReveal(event) {
      if (event.detail?.release) {
        suppressRevealUntilManualRef.current = false;
        suppressRevealUntilRef.current = 0;
        setFooterRevealSuppressed(false);
        resetFooterReveal();
        scheduleUpdate();
        return;
      }

      const duration = Number(event.detail?.duration || 0);
      const suppressMs =
        Number.isFinite(duration) && duration > 0 ? duration : 1200;
      const untilManual = Boolean(event.detail?.untilManual);

      suppressRevealUntilRef.current = Math.max(
        suppressRevealUntilRef.current,
        Date.now() + suppressMs,
      );
      if (untilManual) {
        suppressRevealUntilManualRef.current = true;
      }

      setFooterRevealSuppressed(true);
      resetFooterReveal();
      scheduleUpdate();

      if (suppressTimerId) window.clearTimeout(suppressTimerId);
      suppressTimerId = window.setTimeout(scheduleUpdate, suppressMs + 32);
    }

    function handleManualScrollIntent(event) {
      if (!suppressRevealUntilManualRef.current) return;

      if (event.type === "keydown") {
        const scrollKeys = new Set([
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
          "Spacebar",
        ]);
        if (!scrollKeys.has(event.key)) return;
      }

      suppressRevealUntilManualRef.current = false;
      suppressRevealUntilRef.current = 0;
      setFooterRevealSuppressed(false);
      scheduleUpdate();
    }

    scheduleUpdate();
    const settleTimer = window.setTimeout(scheduleUpdate, 80);
    window.addEventListener(
      "esadar:suppress-footer-reveal",
      handleSuppressFooterReveal,
    );
    window.addEventListener("wheel", handleManualScrollIntent, {
      passive: true,
    });
    window.addEventListener("touchmove", handleManualScrollIntent, {
      passive: true,
    });
    window.addEventListener("keydown", handleManualScrollIntent);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    if (!disableVisualViewport) {
      window.visualViewport?.addEventListener("resize", scheduleUpdate);
      window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (suppressTimerId) window.clearTimeout(suppressTimerId);
      window.clearTimeout(settleTimer);
      window.removeEventListener(
        "esadar:suppress-footer-reveal",
        handleSuppressFooterReveal,
      );
      window.removeEventListener("wheel", handleManualScrollIntent);
      window.removeEventListener("touchmove", handleManualScrollIntent);
      window.removeEventListener("keydown", handleManualScrollIntent);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (!disableVisualViewport) {
        window.visualViewport?.removeEventListener("resize", scheduleUpdate);
        window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      }
      appShell.style.removeProperty("--footer-scroll-progress");
      appShell.style.removeProperty("--header-footer-hide-progress");
      appShell.style.removeProperty("--footer-header-cover-progress");
      appShell.style.removeProperty("--footer-header-cover-offset");
      appShell.classList.remove(
        "app-shell--footer-scroll-active",
        "app-shell--footer-scroll-deep",
        "app-shell--footer-curtain-cover",
        "app-shell--footer-reveal-suppressed",
      );
    };
  }, [prefersReducedMotion, location.key, mobileDebugFlags]);

  return (
    <footer
      ref={sceneRef}
      className="footer-scroll-scene"
      aria-label="Cierre visual ESADAR"
    >
      <div className="footer-scroll-scene__sticky">
        <div className="footer-scroll-scene__ring" aria-hidden="true" />
        <div className="footer-scroll-scene__content">
          <button
            type="button"
            className="footer-scroll-scene__logo-button"
            onClick={handleLogoClick}
            aria-label="Volver al inicio"
          >
            <img
              src={esadarWordmark}
              alt="ESADAR"
              className="footer-scroll-scene__logo"
              decoding="async"
            />
          </button>
          <div
            className="footer-scroll-scene__actions"
            aria-label="Acciones del footer"
          >
            <Link
              to="/about"
              className="button footer-scroll-scene__copy footer-scroll-scene__copy--about"
            >
              Sobre nosotros
            </Link>
            <Link
              to="/contact"
              className="button footer-scroll-scene__copy footer-scroll-scene__copy--contact"
            >
              Contacto
            </Link>
          </div>
          <div
            className="footer-scroll-scene__socials"
            aria-label="Redes sociales de ESADAR"
          >
            <div className="footer-scroll-scene__social-heading" aria-hidden="true">
              <span className="footer-scroll-scene__social-heading-line" />
              <span className="footer-scroll-scene__social-heading-text">Seguinos</span>
              <span className="footer-scroll-scene__social-heading-line" />
            </div>
            <div className="footer-scroll-scene__social-list">
              {ESADAR_SOCIAL_LINKS.map((socialLink) => (
                <a
                  key={socialLink.key}
                  href={socialLink.webUrl}
                  className={`footer-scroll-scene__social-link footer-scroll-scene__social-link--${socialLink.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir perfil ${socialLink.label} en ${socialLink.platformLabel}`}
                  title={`${socialLink.platformLabel}: ${socialLink.label}`}
                  onClick={(event) => handleMobileSocialLink(event, socialLink)}
                >
                  <SocialIcon type={socialLink.key} />
                  <span>{socialLink.label}</span>
                </a>
              ))}
            </div>
          </div>
          <Link
            to="/terminos-y-condiciones"
            className="button footer-scroll-scene__copy footer-scroll-scene__copy--terms"
          >
            Términos y condiciones
          </Link>
        </div>
      </div>
    </footer>
  );
}
