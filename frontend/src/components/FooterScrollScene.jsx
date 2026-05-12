import { Link, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import esadarWordmark from "../assets/esadar-wordmark.png";

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export default function FooterScrollScene() {
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
    appShell.classList.remove(
      "app-shell--footer-scroll-active",
      "app-shell--footer-scroll-deep",
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


    function setFooterRevealSuppressed(isSuppressed) {
      appShell.classList.toggle(
        "app-shell--footer-reveal-suppressed",
        Boolean(isSuppressed),
      );
    }

    function resetFooterReveal() {
      appShell.style.setProperty("--footer-scroll-progress", "0");
      appShell.style.setProperty("--header-footer-hide-progress", "0");
      appShell.classList.remove(
        "app-shell--footer-scroll-active",
        "app-shell--footer-scroll-deep",
      );
    }

    function update() {
      frameId = 0;

      if (
        suppressRevealUntilManualRef.current ||
        Date.now() < suppressRevealUntilRef.current
      ) {
        setFooterRevealSuppressed(true);
        resetFooterReveal();
        return;
      }

      setFooterRevealSuppressed(false);

      const viewportHeight = window.innerHeight || 1;
      const scrollTop =
        window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - viewportHeight,
      );
      const remainingScroll = Math.max(0, maxScroll - scrollTop);
      const revealProgress = clamp01(
        1 - remainingScroll / Math.max(viewportHeight * 0.92, 1),
      );
      const headerHideProgress = prefersReducedMotion
        ? revealProgress >= 0.58
          ? 1
          : 0
        : clamp01((revealProgress - 0.44) / 0.28);

      appShell.style.setProperty(
        "--footer-scroll-progress",
        String(revealProgress),
      );
      appShell.style.setProperty(
        "--header-footer-hide-progress",
        String(headerHideProgress),
      );
      appShell.classList.toggle(
        "app-shell--footer-scroll-active",
        revealProgress > 0.01,
      );
      appShell.classList.toggle(
        "app-shell--footer-scroll-deep",
        headerHideProgress > 0.88,
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
      const suppressMs = Number.isFinite(duration) && duration > 0 ? duration : 1200;
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
    window.addEventListener("esadar:suppress-footer-reveal", handleSuppressFooterReveal);
    window.addEventListener("wheel", handleManualScrollIntent, { passive: true });
    window.addEventListener("touchmove", handleManualScrollIntent, { passive: true });
    window.addEventListener("keydown", handleManualScrollIntent);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (suppressTimerId) window.clearTimeout(suppressTimerId);
      window.clearTimeout(settleTimer);
      window.removeEventListener("esadar:suppress-footer-reveal", handleSuppressFooterReveal);
      window.removeEventListener("wheel", handleManualScrollIntent);
      window.removeEventListener("touchmove", handleManualScrollIntent);
      window.removeEventListener("keydown", handleManualScrollIntent);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      appShell.style.removeProperty("--footer-scroll-progress");
      appShell.style.removeProperty("--header-footer-hide-progress");
      appShell.classList.remove(
        "app-shell--footer-scroll-active",
        "app-shell--footer-scroll-deep",
        "app-shell--footer-reveal-suppressed",
      );
    };
  }, [prefersReducedMotion, location.key]);

  return (
    <footer
      ref={sceneRef}
      className="footer-scroll-scene"
      aria-label="Cierre visual ESADAR"
    >
      <div className="footer-scroll-scene__sticky">
        <div
          className="footer-scroll-scene__ring"
          aria-hidden="true"
        />
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
            />
          </button>
          <div className="footer-scroll-scene__actions" aria-label="Acciones del footer">
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
        </div>
      </div>
    </footer>
  );
}
