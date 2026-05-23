import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

const instantTransition = { duration: 0 };

const overlayVariants = {
  closed: {
    opacity: 0,
    transition: { duration: 0.14, ease: "easeInOut" },
  },
  open: {
    opacity: 1,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

const panelVariants = {
  closed: {
    x: "-100%",
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
  open: {
    x: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

const itemVariants = {
  closed: {
    opacity: 1,
    x: 0,
    transition: instantTransition,
  },
  open: {
    opacity: 1,
    x: 0,
    transition: instantTransition,
  },
};

const listVariants = {
  closed: {},
  open: {},
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
  filtersCount = 0,
  sortActive = false,
  items = [],
  footerItems = [],
}) {
  const location = useLocation();
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
    setOpenGroups({});
  }, [open]);

  function matchesCurrentPath(to) {
    if (!to) return false;
    const currentPath = location.pathname;
    const normalizedTo = String(to).replace(/\/$/, "") || "/";
    if (currentPath === normalizedTo) return true;
    if (normalizedTo !== "/" && currentPath.startsWith(`${normalizedTo}/`)) {
      return true;
    }
    if (normalizedTo.startsWith("/cuenta") && currentPath.startsWith("/account")) {
      return true;
    }
    return false;
  }

  function itemHasCurrentPath(item) {
    if (!item) return false;
    if (matchesCurrentPath(item.to)) return true;
    return (item.children || []).some((child) => itemHasCurrentPath(child));
  }

  useEffect(() => {
    if (!open) return;
    const activeGroup = items.find((item) => item.kind === "group" && itemHasCurrentPath(item));
    if (activeGroup?.key) {
      setFiltersOpen(false);
      setSortOpen(false);
      setOpenGroups({ [activeGroup.key]: true });
    }

    const scrollTimer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector?.(".mobile-motion-menu__item.is-active")
        ?.scrollIntoView?.({ block: "center", inline: "nearest" });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, [open, location.pathname, items]);

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
      const groupActive = itemHasCurrentPath(item);
      return (
        <div key={item.key} className="mobile-motion-menu__group">
          <button
            type="button"
            className={`${itemClassName} mobile-motion-menu__accordion-trigger${groupActive ? " is-active" : ""}`}
            aria-expanded={groupOpen}
            onClick={() => {
              setFiltersOpen(false);
              setSortOpen(false);
              setOpenGroups((current) => ({
                [item.key]: !current[item.key],
              }));
            }}
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
            variants={panelVariants}
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
              aria-label="Navegación principal"
              variants={listVariants}
            >
              {searchContent ? (
                <motion.div
                  variants={itemVariants}
                  className="mobile-nav-sheet__search"
                >
                  {searchContent}
                </motion.div>
              ) : null}
              {filtersContent ? (
                <motion.div
                  variants={itemVariants}
                  className="mobile-nav-sheet__filters"
                >
                  <button
                    type="button"
                    className={`mobile-motion-menu__item mobile-motion-menu__accordion-trigger${filtersCount > 0 ? " is-active" : ""}`}
                    aria-expanded={filtersOpen}
                    onClick={() => {
                      setSortOpen(false);
                      setOpenGroups({});
                      setFiltersOpen((current) => !current);
                    }}
                  >
                    <span>Filtros</span>
                    {filtersCount > 0 ? <span className="mobile-motion-menu__count-badge">{filtersCount}</span> : null}
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
                  variants={itemVariants}
                  className="mobile-nav-sheet__sort"
                >
                  <button
                    type="button"
                    className={`mobile-motion-menu__item mobile-motion-menu__accordion-trigger${sortActive ? " is-active" : ""}`}
                    aria-expanded={sortOpen}
                    onClick={() => {
                      setFiltersOpen(false);
                      setOpenGroups({});
                      setSortOpen((current) => !current);
                    }}
                  >
                    <span>Ordenamiento</span>
                    {sortActive ? <span className="mobile-motion-menu__count-badge mobile-motion-menu__count-badge--sort">Activo</span> : null}
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
                <motion.div key={item.key} variants={itemVariants}>
                  {renderItem(item)}
                </motion.div>
              ))}
            </motion.nav>
            {footerItems.length > 0 ? (
              <motion.nav
                className="mobile-motion-menu__footer"
                aria-label="Navegacion secundaria"
                variants={listVariants}
              >
                {footerItems.map((item) => (
                  <motion.div key={item.key} variants={itemVariants}>
                    {renderItem(item)}
                  </motion.div>
                ))}
              </motion.nav>
            ) : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
