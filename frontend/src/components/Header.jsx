import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useCart } from "../contexts/CartContext.jsx";
import MobileMotionMenu from "./MobileMotionMenu.jsx";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import esadarWordmark from "../assets/esadar-wordmark.webp";

function findVisibleTargetRect(...refs) {
  for (const ref of refs) {
    const element = ref.current;
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

function HeaderIcon({ children }) {
  return (
    <span className="header-icon-button__icon" aria-hidden="true">
      {children}
    </span>
  );
}

function AccountIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l7 4v5c0 5-3.4 7.7-7 9-3.6-1.3-7-4-7-9V7l7-4z" />
      <path d="M9.5 12.5l1.6 1.6 3.4-3.7" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.4 2.4 0 0 1 4.6 1.1c0 1.8-2.3 2.1-2.3 4" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4v16" />
      <path d="M4 7l3-3 3 3" />
      <path d="M17 20V4" />
      <path d="M14 17l3 3 3-3" />
    </svg>
  );
}

function MenuGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="menu-glyph"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="round"
    >
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

export default function Header({ hideBrand = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount, cartFx } = useCart();
  const {
    catalogFiltersContent,
    catalogSortContent,
    catalogFiltersCount,
    catalogSortActive,
    clearCatalogFilters,
    clearCatalogSort,
  } = useMobileMenu();
  const shouldReduceMotion = useReducedMotion();
  const [cartPulse, setCartPulse] = useState(false);
  const [flyFx, setFlyFx] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const desktopCartButtonRef = useRef(null);
  const mobileCartButtonRef = useRef(null);
  const mobileMenuId = "esadar-mobile-menu";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!cartFx?.tick) return undefined;

    setCartPulse(true);
    const timeoutId = window.setTimeout(() => setCartPulse(false), 900);

    const sourceRect = cartFx.sourceRect;
    const targetRect = findVisibleTargetRect(
      mobileCartButtonRef,
      desktopCartButtonRef,
    );

    if (sourceRect && targetRect) {
      const startX = sourceRect.left + sourceRect.width / 2;
      const startY = sourceRect.top + sourceRect.height / 2;
      const endX = targetRect.left + targetRect.width / 2;
      const endY = targetRect.top + targetRect.height / 2;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const curveLift = Math.max(
        48,
        Math.min(160, Math.abs(deltaY) * 0.55 + 72),
      );

      setFlyFx({
        id: cartFx.tick,
        style: {
          "--cart-fly-start-x": `${startX}px`,
          "--cart-fly-start-y": `${startY}px`,
          "--cart-fly-dx": `${deltaX}px`,
          "--cart-fly-dy": `${deltaY}px`,
          "--cart-fly-lift": `${curveLift}px`,
        },
      });

      const flyTimer = window.setTimeout(() => setFlyFx(null), 960);
      return () => {
        window.clearTimeout(timeoutId);
        window.clearTimeout(flyTimer);
      };
    }

    return () => window.clearTimeout(timeoutId);
  }, [cartFx?.sourceRect, cartFx?.tick]);

  const isAdmin = user?.roles?.some((role) =>
    ["SUPER_ADMIN", "ADMIN", "OPERATOR"].includes(role),
  );
  const canManageUsers = user?.roles?.some((role) =>
    ["SUPER_ADMIN", "ADMIN"].includes(role),
  );
  const isCheckoutView = location.pathname.startsWith("/checkout");
  const isAccountView = location.pathname.startsWith("/cuenta");
  const isAdminView = location.pathname.startsWith("/admin");

  function openCart() {
    navigate("/checkout/resumen", {
      state: { replayIntro: true, replayIntroReason: "cart" },
    });
  }

  function handleMobileSearchSubmit(event) {
    event.preventDefault();
    const search = mobileSearch.trim();
    const path = search
      ? `/articles?search=${encodeURIComponent(search)}`
      : "/articles";
    navigate(path, {
      state: { scrollToCatalog: true, source: "header-search" },
    });
    setMobileMenuOpen(false);
  }

  function renderCartButton(buttonRef, extraClassName = "") {
    return (
      <button
        ref={buttonRef}
        type="button"
        className={[
          "ghost-button",
          "cart-button",
          "cart-button--icon-only",
          "header-icon-button",
          cartPulse ? "cart-button--pulse" : "",
          extraClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={openCart}
        aria-label="Carrito"
        title="Carrito"
      >
        <HeaderIcon>
          <svg
            className="cart-button__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="20" r="1.6" />
            <circle cx="18" cy="20" r="1.6" />
            <path d="M3 4h2.2l1.9 9.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H7.1" />
          </svg>
        </HeaderIcon>
        <span className={`badge${cartPulse ? " badge--pulse" : ""}`}>
          {cartCount}
        </span>
      </button>
    );
  }

  function renderIconNavLink(to, label, icon, extraClassName = "") {
    return (
      <NavLink
        to={to}
        className={({ isActive }) =>
          [
            "ghost-button",
            "header-icon-button",
            isActive ? "is-active" : "",
            extraClassName,
          ]
            .filter(Boolean)
            .join(" ")
        }
        aria-label={label}
        title={label}
      >
        <HeaderIcon>{icon}</HeaderIcon>
        <span className="sr-only">{label}</span>
      </NavLink>
    );
  }

  function renderIconButton(onClick, label, icon) {
    return (
      <button
        type="button"
        className="ghost-button header-icon-button"
        onClick={onClick}
        aria-label={label}
        title={label}
      >
        <HeaderIcon>{icon}</HeaderIcon>
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  const accountMenuChildren = isAuthenticated
    ? [
        { key: "account-orders", label: "Mis ordenes", to: "/cuenta/ordenes" },
        { key: "account-offers", label: "Ofertas", to: "/cuenta/offers" },
        { key: "account-saved", label: "Guardados", to: "/cuenta/guardados" },
        { key: "account-profile", label: "Perfil", to: "/cuenta/perfil" },
        // { key: "account-alerts", label: "Alertas", to: "/cuenta/alertas" },
      ]
    : [
        { key: "account-login", label: "Ingresar", to: "/login" },
        { key: "account-register", label: "Crear cuenta", to: "/register" },
        { key: "account-saved", label: "Guardados", to: "/cuenta/guardados" },
      ];

  function handleLogout() {
    logout();
    setMobileMenuOpen(false);
    navigate("/", { replace: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const adminMenuChildren = [
    { key: "admin-articles", label: "Articulos", to: "/admin/articles" },
    {
      key: "admin-article-new",
      label: "Nuevo articulo",
      to: "/admin/articles/new",
    },
    // {
    //   key: "admin-article-bulk",
    //   label: "Crear multiples",
    //   to: "/admin/articles/bulk-create",
    // },
    { key: "admin-orders", label: "Ordenes", to: "/admin/orders" },
    { key: "admin-offers", label: "Ofertas", to: "/admin/offers" },
    {
      key: "admin-contacts",
      label: "Contactos",
      to: "/admin/contact-messages",
    },
    { key: "admin-leads", label: "Leads", to: "/admin/leads" },
    { key: "admin-wishlists", label: "Wishlists", to: "/admin/wishlists" },
    ...(canManageUsers
      ? [
          { key: "admin-users", label: "Usuarios", to: "/admin/users" },
          { key: "admin-collecting", label: "Cobros", to: "/admin/collecting" },
        ]
      : []),
    { key: "admin-shipping", label: "Envios", to: "/admin/shipping" },
    { key: "admin-statistics", label: "Estadisticas", to: "/admin/statistics" },
    { key: "admin-audit", label: "Auditoria", to: "/admin/audit" },
  ];

  const mobileInfoLinks = [
    { key: "purchase-guide", label: "Guía de compra", to: "/guia-de-compra" },
    {
      key: "terms-and-conditions",
      label: "Términos y condiciones",
      to: "/terminos-y-condiciones",
    },
  ];

  const mobileMenuItems = [
    // { key: "home", label: "Inicio", to: "/" },
    {
      key: "account",
      label: "Mi cuenta",
      kind: "group",
      children: accountMenuChildren,
    },
    ...(isAdmin
      ? [
          {
            key: "admin",
            label: "Admin",
            kind: "group",
            children: adminMenuChildren,
          },
        ]
      : []),
    ...mobileInfoLinks,
    ...(isAuthenticated
      ? [
          {
            key: "logout",
            label: "Salir",
            kind: "button",
            onClick: handleLogout,
          },
        ]
      : []),
  ];

  function renderMenuButton() {
    return (
      <span className="header-mobile-menu-wrap">
        <motion.button
          type="button"
          className="ghost-button header-actions-mobile__menu"
          aria-controls={mobileMenuId}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
          onClick={() => setMobileMenuOpen((current) => !current)}
          initial={false}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
        >
          <motion.span
            animate={
              mobileMenuOpen
                ? { rotate: -3, scale: 0.95 }
                : { rotate: 0, scale: 1 }
            }
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.12 }
            }
          >
            <MenuGlyph />
          </motion.span>
        </motion.button>
        <span
          className="mobile-catalog-indicators"
          aria-hidden={
            catalogFiltersCount > 0 || catalogSortActive ? undefined : "true"
          }
        >
          {catalogFiltersCount > 0 ? (
            <button
              type="button"
              className="mobile-catalog-indicator mobile-catalog-indicator--filters"
              onClick={(event) => {
                event.stopPropagation();
                clearCatalogFilters?.();
              }}
              aria-label={`Limpiar ${catalogFiltersCount} filtros activos`}
              title="Limpiar filtros"
            >
              <FilterIcon />
              <span>{catalogFiltersCount}</span>
            </button>
          ) : null}
          {catalogSortActive ? (
            <button
              type="button"
              className="mobile-catalog-indicator mobile-catalog-indicator--sort"
              onClick={(event) => {
                event.stopPropagation();
                clearCatalogSort?.();
              }}
              aria-label="Restablecer ordenamiento"
              title="Restablecer orden"
            >
              <SortIcon />
            </button>
          ) : null}
        </span>
      </span>
    );
  }

  const mobileSearchContent = (
    <form className="mobile-menu-search" onSubmit={handleMobileSearchSubmit}>
      <label className="sr-only" htmlFor="mobile-menu-search-input">
        Buscar prendas
      </label>
      <div className="mobile-menu-search__field">
        <SearchIcon />
        <input
          id="mobile-menu-search-input"
          className="input"
          type="search"
          value={mobileSearch}
          onChange={(event) => setMobileSearch(event.target.value)}
          placeholder="Buscar por titulo, marca o categoria"
        />
      </div>
      <button
        type="submit"
        className="button button-secondary mobile-menu-search__submit"
      >
        Buscar
      </button>
    </form>
  );

  const desktopSearchContent = (
    <form
      className="header-search-desktop"
      onSubmit={handleMobileSearchSubmit}
      role="search"
    >
      <label className="sr-only" htmlFor="site-header-search-input">
        Buscar prendas
      </label>
      <div className="header-search-desktop__field">
        <SearchIcon />
        <input
          id="site-header-search-input"
          className="input"
          type="search"
          value={mobileSearch}
          onChange={(event) => setMobileSearch(event.target.value)}
          placeholder="Buscar prendas"
        />
      </div>
    </form>
  );

  return (
    <>
      <header className="site-header">
        <div className="container header-inner header-inner--compact header-inner--mobile-balanced">
          <Link
            to="/"
            className={`brand-mark brand-mark--desktop ${hideBrand ? "brand-mark--hidden" : ""}`}
            aria-label="ESADAR"
          >
            <img
              src={esadarWordmark}
              alt="ESADAR"
              className="brand-mark__logo"
              decoding="async"
            />
          </Link>

          {isCheckoutView || isAccountView || isAdminView ? (
            <span
              className="header-search-desktop-placeholder"
              aria-hidden="true"
            />
          ) : (
            desktopSearchContent
          )}

          <div className="header-actions header-actions--ordered header-actions--desktop">
            {isAuthenticated ? (
              <>
                <span className="user-greeting">
                  Hola, {user?.firstName || ""}
                </span>
                {renderIconNavLink(
                  "/cuenta/perfil",
                  "Mi cuenta",
                  <AccountIcon />,
                )}
                {isAdmin
                  ? renderIconNavLink("/admin/articles", "Admin", <AdminIcon />)
                  : null}
                {renderIconNavLink(
                  "/cuenta/guardados",
                  "Guardados",
                  <HeartIcon />,
                )}
                {renderIconNavLink(
                  "/guia-de-compra",
                  "Guía de compra",
                  <HelpIcon />,
                  "header-icon-button--help",
                )}
                {renderCartButton(desktopCartButtonRef)}
                {renderIconButton(handleLogout, "Salir", <LogoutIcon />)}
              </>
            ) : (
              <>
                {renderIconNavLink("/login", "Ingresar", <LoginIcon />)}
                {renderIconNavLink(
                  "/cuenta/guardados",
                  "Guardados",
                  <HeartIcon />,
                )}
                {renderIconNavLink(
                  "/guia-de-compra",
                  "Guía de compra",
                  <HelpIcon />,
                  "header-icon-button--help",
                )}
                {renderCartButton(desktopCartButtonRef)}
              </>
            )}
          </div>

          <div className="header-mobile-shell">
            {renderMenuButton()}
            <Link
              to="/"
              className={`brand-mark brand-mark--mobile ${hideBrand ? "brand-mark--hidden" : ""}`}
              aria-label="ESADAR"
            >
              <img
                src={esadarWordmark}
                alt="ESADAR"
                className="brand-mark__logo"
                decoding="async"
              />
            </Link>
            {renderCartButton(mobileCartButtonRef, "header-mobile-shell__cart")}
          </div>
        </div>
      </header>

      <MobileMotionMenu
        id={mobileMenuId}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="Menu"
        headerContent={
          <img
            src={esadarWordmark}
            alt="ESADAR"
            className="mobile-motion-menu__brand"
            decoding="async"
          />
        }
        searchContent={mobileSearchContent}
        filtersContent={catalogFiltersContent}
        sortContent={catalogSortContent}
        filtersCount={catalogFiltersCount}
        sortActive={catalogSortActive}
        items={mobileMenuItems}
      />

      {flyFx ? (
        <span
          key={flyFx.id}
          className="cart-fly-token"
          style={flyFx.style}
          aria-hidden="true"
        >
          <span className="cart-fly-token__core" />
        </span>
      ) : null}
    </>
  );
}
