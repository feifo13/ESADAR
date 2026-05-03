import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const overlayVariants = {
  closed: { opacity: 0 },
  open: {
    opacity: 1,
    transition: {
      duration: 0.16,
      ease: "easeOut",
    },
  },
};

const panelVariants = {
  closed: {
    x: "-100%",
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 38,
      mass: 0.82,
      when: "afterChildren",
    },
  },
  open: {
    x: 0,
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 36,
      mass: 0.82,
      when: "beforeChildren",
      staggerChildren: 0.035,
      delayChildren: 0.015,
    },
  },
};

const itemVariants = {
  closed: {
    opacity: 0,
    x: -14,
    transition: { duration: 0.1, ease: "easeIn" },
  },
  open: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.14, ease: "easeOut" },
  },
};

const listVariants = {
  closed: {},
  open: {
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.015,
    },
  },
};

function renderItem(item, onClose) {
  const itemClassName = [
    "mobile-nav-sheet__link",
    "mobile-motion-menu__item",
    item.className || "",
  ].filter(Boolean).join(" ");

  if (item.kind === "button") {
    return (
      <button
        key={item.key}
        type="button"
        className={itemClassName}
        onClick={() => {
          item.onClick?.();
          onClose?.();
        }}
      >
        {item.label}
      </button>
    );
  }

  return (
    <NavLink
      key={item.key}
      to={item.to}
      className={({ isActive }) => [itemClassName, isActive ? "is-active" : ""].filter(Boolean).join(" ")}
      onClick={() => onClose?.()}
    >
      {item.label}
    </NavLink>
  );
}

export default function MobileMotionMenu({
  id = "mobile-motion-menu",
  open,
  onClose,
  title = "Menu",
  description = "",
  headerContent = null,
  searchContent = null,
  filtersContent = null,
  items = [],
}) {
  const shouldReduceMotion = useReducedMotion();
  const panelRef = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeydown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  const activePanelVariants = shouldReduceMotion
    ? {
      closed: { x: "-100%" },
      open: { x: 0, transition: { duration: 0.12 } },
    }
    : panelVariants;

  const activeItemVariants = shouldReduceMotion
    ? {
      closed: { opacity: 0 },
      open: { opacity: 1, transition: { duration: 0.12 } },
    }
    : itemVariants;

  const activeListVariants = shouldReduceMotion
    ? { closed: {}, open: {} }
    : listVariants;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="mobile-motion-menu"
          initial="closed"
          animate="open"
          exit="closed"
        >
          <motion.button
            type="button"
            className="mobile-motion-menu__overlay"
            aria-label="Cerrar menu"
            onClick={() => onClose?.()}
            variants={overlayVariants}
          />

          <motion.aside
            id={id}
            ref={panelRef}
            className="mobile-motion-menu__panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            variants={activePanelVariants}
          >
            <div className="mobile-motion-menu__header">
              {headerContent ? (
                <div className="mobile-motion-menu__brand-wrap">
                  {headerContent}
                </div>
              ) : (
                <div className="page-stack-sm">
                  <h3>{title}</h3>
                  {description ? <p className="muted-copy">{description}</p> : null}
                </div>
              )}

              <button
                type="button"
                className="mobile-motion-menu__close"
                onClick={() => onClose?.()}
                aria-label="Cerrar menu"
              >
                {"\u00D7"}
              </button>
            </div>

            <motion.nav
              className="mobile-nav-sheet__links"
              aria-label="Navegacion principal"
              variants={activeListVariants}
            >
              {searchContent ? (
                <motion.div variants={activeItemVariants} className="mobile-nav-sheet__search">
                  {searchContent}
                </motion.div>
              ) : null}
              {filtersContent ? (
                <motion.div variants={activeItemVariants} className="mobile-nav-sheet__filters">
                  <button
                    type="button"
                    className="mobile-motion-menu__item mobile-motion-menu__accordion-trigger"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((current) => !current)}
                  >
                    <span>Filtros</span>
                    <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
                  </button>
                  {filtersOpen ? (
                    <div className="mobile-motion-menu__accordion-body">
                      {filtersContent}
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
              {items.map((item) => (
                <motion.div key={item.key} variants={activeItemVariants}>
                  {renderItem(item, onClose)}
                </motion.div>
              ))}
            </motion.nav>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
