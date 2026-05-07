import { useEffect, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import esadarWordmark from "../assets/esadar-wordmark.png";

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export default function FooterScrollScene() {
  const sceneRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start end", "end end"],
  });

  const logoOpacity = useTransform(
    scrollYProgress,
    [0, 0.18, 0.82, 1],
    [0, 1, 1, 0.9],
  );
  const logoScale = useTransform(
    scrollYProgress,
    [0, 0.26, 1],
    [0.86, 1, 1.16],
  );
  const logoY = useTransform(scrollYProgress, [0, 1], [42, -30]);
  const ringScale = useTransform(scrollYProgress, [0, 1], [0.75, 1.38]);
  const ringOpacity = useTransform(
    scrollYProgress,
    [0, 0.26, 1],
    [0, 0.32, 0.08],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const appShell = document.querySelector(".app-shell");
    const header = document.querySelector(".site-header");
    const footer = sceneRef.current;
    if (!appShell || !header || !footer) return undefined;

    let frameId = 0;

    function update() {
      frameId = 0;

      const footerRect = footer.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const rawProgress = (viewportHeight - footerRect.top) / viewportHeight;
      const progress = clamp01(rawProgress);
      const headerHideProgress = prefersReducedMotion
        ? progress >= 0.72
          ? 1
          : 0
        : clamp01((progress - 0.18) / 0.72);

      appShell.style.setProperty("--footer-scroll-progress", String(progress));
      appShell.style.setProperty(
        "--header-footer-hide-progress",
        String(headerHideProgress),
      );
      appShell.classList.toggle(
        "app-shell--footer-scroll-active",
        progress > 0.01,
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
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      appShell.style.removeProperty("--footer-scroll-progress");
      appShell.style.removeProperty("--header-footer-hide-progress");
      appShell.classList.remove(
        "app-shell--footer-scroll-active",
        "app-shell--footer-scroll-deep",
      );
    };
  }, [prefersReducedMotion]);

  const logoStyle = prefersReducedMotion
    ? undefined
    : { opacity: logoOpacity, scale: logoScale, y: logoY };
  const ringStyle = prefersReducedMotion
    ? undefined
    : { opacity: ringOpacity, scale: ringScale };

  return (
    <footer
      ref={sceneRef}
      className="footer-scroll-scene"
      aria-label="Cierre visual ESADAR"
    >
      <div className="footer-scroll-scene__sticky">
        <motion.div
          className="footer-scroll-scene__ring"
          style={ringStyle}
          aria-hidden="true"
        />
        <motion.div className="footer-scroll-scene__content" style={logoStyle}>
          <img
            src={esadarWordmark}
            alt="ESADAR"
            className="footer-scroll-scene__logo"
          />
          <p className="footer-scroll-scene__copy">
            Mile y Fede ♥ sentados en un arbol
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
