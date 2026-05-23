import { Link, useLocation } from "react-router-dom";

const ROUTE_LABELS = {
  login: "Ingresar",
  register: "Crear cuenta",
  "forgot-password": "Recuperar contraseña",
  "reset-password": "Nueva contraseña",
  contact: "Contacto",
  about: "Nosotros",
  avisos: "Avisos",
  "guia-de-compra": "Guía de compra",
  "terminos-y-condiciones": "Términos y condiciones",
};

const CHECKOUT_LABELS = {
  resumen: "Resumen",
  comprador: "Comprador",
  pago: "Pago",
  envio: "Envío",
  confirmacion: "Confirmación",
  completa: "Orden completa",
};

const ACCOUNT_LABELS = {
  perfil: "Perfil",
  preferencias: "Preferencias",
  guardados: "Guardados",
  offers: "Ofertas",
  ofertas: "Ofertas",
  alertas: "Alertas",
  ordenes: "Órdenes",
};

const ADMIN_LABELS = {
  articles: "Artículos",
  orders: "Órdenes",
  offers: "Ofertas",
  "contact-messages": "Contactos",
  wishlists: "Wishlists",
  audit: "Auditoría",
  leads: "Leads",
  statistics: "Estadísticas",
};

function detailLabel(prefix, value) {
  const decoded = decodeURIComponent(String(value || "")).trim();
  return decoded ? `${prefix} #${decoded}` : prefix;
}

function titleizePathSegment(value) {
  return decodeURIComponent(String(value || ""))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildBreadcrumbs(pathname, labelOverrides = {}) {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  const parts = cleanPath.split("/").filter(Boolean);

  if (cleanPath === "/" || cleanPath === "/articles") return [];

  if (parts[0] === "articles") {
    const articlePathname = parts[1] ? `/articles/${parts[1]}` : "/articles";
    const articleLabel =
      labelOverrides[articlePathname] ||
      titleizePathSegment(parts[1]) ||
      "Artículo";
    const crumbs = [
      { label: "Catálogo", to: "/articles" },
      { label: articleLabel, to: parts[1] ? articlePathname : undefined },
    ];

    if (parts[2] === "offer") {
      crumbs.push({ label: "Oferta" });
    }

    return crumbs;
  }

  if (parts[0] === "checkout") {
    return [
      { label: "Checkout", to: "/checkout/resumen" },
      { label: CHECKOUT_LABELS[parts[1]] || "Paso" },
    ];
  }

  if (
    parts[0] === "cuenta" ||
    (parts[0] === "account" && parts[1] === "orders")
  ) {
    if (parts[0] === "account") {
      return [
        { label: "Mi cuenta", to: "/cuenta/perfil" },
        { label: "Órdenes", to: "/cuenta/ordenes" },
        { label: detailLabel("Orden", parts[2]) },
      ];
    }

    const crumbs = [{ label: "Mi cuenta", to: "/cuenta/perfil" }];
    if (parts[1]) {
      crumbs.push({
        label: ACCOUNT_LABELS[parts[1]] || "Sección",
        to: parts[2] ? `/cuenta/${parts[1]}` : undefined,
      });
    }
    if (parts[1] === "ordenes" && parts[2]) {
      crumbs.push({ label: detailLabel("Orden", parts[2]) });
    }
    return crumbs;
  }

  if (parts[0] === "admin") {
    const section = parts[1];
    const crumbs = [{ label: "Admin", to: "/admin/articles" }];

    if (section) {
      crumbs.push({
        label: ADMIN_LABELS[section] || "Sección",
        to: parts.length > 2 ? `/admin/${section}` : undefined,
      });
    }

    if (section === "articles") {
    if (parts[2] === "new") crumbs.push({ label: "Nuevo artículo" });
      if (parts[2] === "bulk-create") crumbs.push({ label: "Carga masiva" });
      if (parts[3] === "edit")
        crumbs.push({ label: detailLabel("Editar artículo", parts[2]) });
      if (parts[3] === "stock")
        crumbs.push({ label: detailLabel("Ajustar stock", parts[2]) });
    } else if (section === "orders" && parts[2]) {
      crumbs.push({ label: detailLabel("Orden", parts[2]) });
    } else if (section === "contact-messages" && parts[2]) {
      crumbs.push({ label: detailLabel("Mensaje", parts[2]) });
    } else if (section === "leads" && parts[2]) {
      crumbs.push({ label: detailLabel("Lead", parts[2]) });
    }

    return crumbs;
  }

  const fallbackLabel = ROUTE_LABELS[parts[0]] || "Sección";
  return [{ label: fallbackLabel }];
}

export default function AppBreadcrumbs({ labelOverrides = {} }) {
  const location = useLocation();
  const crumbs = buildBreadcrumbs(location.pathname, labelOverrides);

  if (!crumbs.length) return null;

  const items = [{ label: "Inicio", to: "/" }, ...crumbs];

  return (
    <nav className="app-breadcrumbs" aria-label="Ruta de navegación">
      <ol className="app-breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${index}`}
              className="app-breadcrumbs__item"
            >
              {item.to && !isLast ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
