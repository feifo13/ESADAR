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

function AccordionIndicator({ open }) {
  return (
    <span
      className={`mobile-motion-menu__accordion-indicator${open ? " is-open" : ""}`}
      aria-hidden="true"
    >
      +
    </span>
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
  sortContent = null,
  items = [],
}) {
  const shouldReduceMotion = useReducedMotion();
  const panelRef = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

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

  useEffect(() => {
    if (open) return;
    setFiltersOpen(false);
    setSortOpen(false);
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

  function renderItem(item, { nested = false } = {}) {
    const itemClassName = [
      "mobile-nav-sheet__link",
      "mobile-motion-menu__item",
      nested ? "mobile-motion-menu__item--nested" : "",
      item.className || "",
    ]
      .filter(Boolean)
      .join(" ");

    if (item.kind === "group") {
      const groupOpen = Boolean(openGroups[item.key]);
      return (
        <div key={item.key} className="mobile-motion-menu__group">
          <button
            type="button"
            className={`${itemClassName} mobile-motion-menu__accordion-trigger`}
            aria-expanded={groupOpen}
            onClick={() =>
              setOpenGroups((current) => ({
                ...current,
                [item.key]: !current[item.key],
              }))
            }
          >
            <span>{item.label}</span>
            <AccordionIndicator open={groupOpen} />
          </button>
          {groupOpen ? (
            <div className="mobile-motion-menu__group-body">
              {(item.children || []).map((child) =>
                renderItem(child, { nested: true }),
              )}
            </div>
          ) : null}
        </div>
      );
    }

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
        className={({ isActive }) =>
          [itemClassName, isActive ? "is-active" : ""].filter(Boolean).join(" ")
        }
        onClick={() => onClose?.()}
      >
        {item.label}
      </NavLink>
    );
  }

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
                  {description ? (
                    <p className="muted-copy">{description}</p>
                  ) : null}
                </div>
              )}

              {/* <button
                type="button"
                className="mobile-motion-menu__close"
                onClick={() => onClose?.()}
                aria-label="Cerrar menu"
              >
                {"\u00D7"}
              </button> */}
            </div>

            <motion.nav
              className="mobile-nav-sheet__links"
              aria-label="Navegacion principal"
              variants={activeListVariants}
            >
              {searchContent ? (
                <motion.div
                  variants={activeItemVariants}
                  className="mobile-nav-sheet__search"
                >
                  {searchContent}
                </motion.div>
              ) : null}
              {filtersContent ? (
                <motion.div
                  variants={activeItemVariants}
                  className="mobile-nav-sheet__filters"
                >
                  <button
                    type="button"
                    className="mobile-motion-menu__item mobile-motion-menu__accordion-trigger"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((current) => !current)}
                  >
                    <span>Filtros</span>
                    <AccordionIndicator open={filtersOpen} />
                  </button>
                  {filtersOpen ? (
                    <div
                      className="mobile-motion-menu__accordion-body"
                      onClickCapture={(event) => {
                        const actionButton = event.target.closest?.("button");
                        if (!actionButton) return;
                        const actionLabel =
                          actionButton.textContent?.trim().toLowerCase() || "";
                        if (
                          actionLabel.includes("aplicar filtros") ||
                          actionLabel.includes("limpiar")
                        ) {
                          window.setTimeout(() => {
                            setFiltersOpen(false);
                            onClose?.();
                          }, 0);
                        }
                      }}
                    >
                      {filtersContent}
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
              {sortContent ? (
                <motion.div
                  variants={activeItemVariants}
                  className="mobile-nav-sheet__sort"
                >
                  <button
                    type="button"
                    className="mobile-motion-menu__item mobile-motion-menu__accordion-trigger"
                    aria-expanded={sortOpen}
                    onClick={() => setSortOpen((current) => !current)}
                  >
                    <span>Ordenamiento</span>
                    <AccordionIndicator open={sortOpen} />
                  </button>
                  {sortOpen ? (
                    <div
                      className="mobile-motion-menu__accordion-body mobile-motion-menu__accordion-body--sort"
                      onClickCapture={(event) => {
                        const actionButton = event.target.closest?.("button");
                        if (!actionButton) return;
                        const actionLabel =
                          actionButton.textContent?.trim().toLowerCase() || "";
                        if (
                          actionLabel.includes("aplicar orden") ||
                          actionLabel.includes("limpiar orden")
                        ) {
                          window.setTimeout(() => {
                            setSortOpen(false);
                            onClose?.();
                          }, 0);
                        }
                      }}
                    >
                      {sortContent}
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
              {items.map((item) => (
                <motion.div key={item.key} variants={activeItemVariants}>
                  {renderItem(item)}
                </motion.div>
              ))}
            </motion.nav>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
