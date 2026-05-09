import { Link, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import esadarWordmark from "../assets/esadar-wordmark.png";

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export default function FooterScrollScene() {
  const sceneRef = useRef(null);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const appShell = document.querySelector(".app-shell");
    if (!appShell) return;

    appShell.style.setProperty("--footer-scroll-progress", "0");
    appShell.style.setProperty("--header-footer-hide-progress", "0");
    appShell.classList.remove(
      "app-shell--footer-scroll-active",
      "app-shell--footer-scroll-deep",
    );
  }, [location.key]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const appShell = document.querySelector(".app-shell");
    const footer = sceneRef.current;
    if (!appShell || !footer) return undefined;

    let frameId = 0;

    appShell.classList.add("app-shell--has-footer-reveal");

    function update() {
      frameId = 0;

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

    scheduleUpdate();
    const settleTimer = window.setTimeout(scheduleUpdate, 80);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      appShell.style.removeProperty("--footer-scroll-progress");
      appShell.style.removeProperty("--header-footer-hide-progress");
      appShell.classList.remove(
        "app-shell--has-footer-reveal",
        "app-shell--footer-scroll-active",
        "app-shell--footer-scroll-deep",
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
          <img
            src={esadarWordmark}
            alt="ESADAR"
            className="footer-scroll-scene__logo"
          />
          <Link to="/about" className="button footer-scroll-scene__copy">
            Sobre nosotros
          </Link>
        </div>
      </div>
    </footer>
  );
}
