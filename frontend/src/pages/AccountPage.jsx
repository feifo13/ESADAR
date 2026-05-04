import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import SmartImage from "../components/SmartImage.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import SummaryItemCard from "../components/SummaryItemCard.jsx";
import SurfaceModal from "../components/SurfaceModal.jsx";
import SortableTh from "../components/SortableTh.jsx";
import WishlistHeartButton from "../components/WishlistHeartButton.jsx";
import OrderStatusBadge from "../components/OrderStatusBadge.jsx";
import { BellIcon, CartIcon } from "../components/ActionIcons.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useCart } from "../contexts/CartContext.jsx";
import { useLookups } from "../contexts/LookupsContext.jsx";
import { useWishlist } from "../contexts/WishlistContext.jsx";
import { apiFetch } from "../lib/api.js";
import { formatCurrency, formatDate } from "../lib/format.js";
import { articlePath } from "../lib/routes.js";
import { getNextSortDirection, sortRows } from "../lib/tableSort.js";

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
};

const PAYMENT_STATUS_LABELS = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
  REFUNDED: "Reintegrado",
  PAID: "Pagado",
};

const ORDER_STATUS_LABELS = {
  RESERVED: "Reservada",
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  SHIPPED: "Enviada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

const ALERT_TYPE_LABELS = {
  BACK_IN_STOCK: "Avisarme si vuelve",
  SIMILAR_ITEMS: "Avisarme si entra algo similar",
  PRICE_OR_OFFER: "Avisarme por precio u oferta",
  NEW_ARRIVALS: "Avisarme por ingresos",
};

const TAB_ITEMS = [
  { key: "perfil", label: "Mis datos", path: "/cuenta/perfil" },
  { key: "guardados", label: "Mis guardados", path: "/cuenta/guardados" },
  { key: "alertas", label: "Mis alertas", path: "/cuenta/alertas" },
  { key: "ordenes", label: "Mis ordenes", path: "/cuenta/ordenes" },
];

const ACCOUNT_TABLE_PAGE_SIZE = 8;

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LocalTablePagination() {
  return null;
}

function getActiveTab(pathname) {
  if (pathname.includes("/guardados")) return "guardados";
  if (pathname.includes("/alertas")) return "alertas";
  if (pathname.includes("/ordenes")) return "ordenes";
  return "perfil";
}

const initialForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  email: "",
  phone: "",
  instagram: "",
  preferredPaymentMethod: "",
  preferredShippingMethodId: "",
  defaultAddress: {
    addressLine: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Uruguay",
    deliveryNotes: "",
  },
  preferredCategories: [],
  preferredBrands: [],
  preferredSizes: [],
  preferredColors: [],
  preferenceNotes: "",
};

export default function AccountPage() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { addItem } = useCart();
  const {
    items: wishlistItems,
    pendingIds,
    toggleItem,
    loading: wishlistLoading,
  } = useWishlist();
  const {
    categoryOptions,
    brandOptions,
    sizeOptions,
    shippingMethodOptions,
    paymentMethodOptions,
  } = useLookups();

  const activeTab = getActiveTab(location.pathname);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [wishlistSort, setWishlistSort] = useState({
    key: "title",
    direction: "asc",
  });
  const [ordersSort, setOrdersSort] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [wishlistPage, setWishlistPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [alertPendingIds, setAlertPendingIds] = useState([]);
  const [alertError, setAlertError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    let ignore = false;

    async function loadAccountData() {
      try {
        setProfileLoading(true);
        setProfileError("");
        const [profileResponse, ordersResponse, alertsResponse] =
          await Promise.all([
            apiFetch("/api/public/account/profile"),
            apiFetch("/api/public/account/orders"),
            apiFetch("/api/public/account/alerts"),
          ]);

        if (ignore) return;

        setForm({
          firstName: profileResponse.profile?.firstName || "",
          lastName: profileResponse.profile?.lastName || "",
          birthDate: profileResponse.profile?.birthDate
            ? String(profileResponse.profile.birthDate).slice(0, 10)
            : "",
          email: profileResponse.profile?.email || "",
          phone: profileResponse.profile?.phone || "",
          instagram: profileResponse.profile?.instagram || "",
          preferredPaymentMethod:
            profileResponse.profile?.preferredPaymentMethod || "",
          preferredShippingMethodId: profileResponse.profile
            ?.preferredShippingMethodId
            ? String(profileResponse.profile.preferredShippingMethodId)
            : "",
          defaultAddress: {
            addressLine:
              profileResponse.profile?.defaultAddress?.addressLine || "",
            city: profileResponse.profile?.defaultAddress?.city || "",
            state: profileResponse.profile?.defaultAddress?.state || "",
            postalCode:
              profileResponse.profile?.defaultAddress?.postalCode || "",
            country:
              profileResponse.profile?.defaultAddress?.country || "Uruguay",
            deliveryNotes:
              profileResponse.profile?.defaultAddress?.deliveryNotes || "",
          },
          preferredCategories:
            profileResponse.profile?.preferredCategories || [],
          preferredBrands: profileResponse.profile?.preferredBrands || [],
          preferredSizes: profileResponse.profile?.preferredSizes || [],
          preferredColors: profileResponse.profile?.preferredColors || [],
          preferenceNotes: profileResponse.profile?.preferenceNotes || "",
        });
        setOrders(ordersResponse.items || []);
        setAlerts(alertsResponse.items || []);
      } catch (err) {
        if (!ignore) {
          setProfileError(err.message || "No pudimos cargar tu cuenta.");
        }
      } finally {
        if (!ignore) setProfileLoading(false);
      }
    }

    loadAccountData();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  const availableColors = useMemo(() => {
    const colors = new Set();
    wishlistItems.forEach((item) => {
      if (item.color) colors.add(item.color);
    });
    return [...colors];
  }, [wishlistItems]);

  const sortedWishlistItems = useMemo(
    () =>
      sortRows(wishlistItems, wishlistSort, {
        title: (item) => item.title,
        price: (item) => item.discountedPrice || item.salePrice,
        status: (item) =>
          Number(item.quantityAvailable || 0) > 0 && item.status !== "SOLD_OUT"
            ? "Disponible"
            : "Agotado",
      }),
    [wishlistItems, wishlistSort],
  );

  const sortedOrders = useMemo(
    () =>
      sortRows(orders, ordersSort, {
        orderNumber: (order) => order.orderNumber,
        createdAt: (order) => order.createdAt,
        total: (order) => order.total,
        orderStatus: (order) =>
          ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus,
        updatedAt: (order) =>
          order.shippedAt ||
          order.cancelledAt ||
          order.approvedAt ||
          order.reservedUntil ||
          order.createdAt,
      }),
    [orders, ordersSort],
  );

  const wishlistTotalPages = Math.max(
    1,
    Math.ceil(sortedWishlistItems.length / ACCOUNT_TABLE_PAGE_SIZE),
  );
  const ordersTotalPages = Math.max(
    1,
    Math.ceil(sortedOrders.length / ACCOUNT_TABLE_PAGE_SIZE),
  );
  const pagedWishlistItems = sortedWishlistItems;
  const pagedOrders = sortedOrders;

  useEffect(() => {
    setWishlistPage((current) => Math.min(current, wishlistTotalPages));
  }, [wishlistTotalPages]);

  useEffect(() => {
    setOrdersPage((current) => Math.min(current, ordersTotalPages));
  }, [ordersTotalPages]);

  function isArticleAvailable(item) {
    return (
      Number(item?.quantityAvailable || 0) > 0 &&
      item?.status !== "SOLD_OUT" &&
      item?.articleStatus !== "SOLD_OUT"
    );
  }

  function getAvailabilityBadge(item) {
    return (
      <StatusBadge
        status={isArticleAvailable(item) ? "AVAILABLE" : "SOLD_OUT"}
        labels={{ AVAILABLE: "Disponible", SOLD_OUT: "Agotado" }}
      />
    );
  }

  function getWishlistItemPayload(item) {
    return {
      articleId: item.articleId,
      slug: item.slug,
      title: item.title,
      salePrice: item.salePrice,
      discountType: item.discountType,
      discountValue: item.discountValue,
      discountedPrice: item.discountedPrice,
      status: item.status,
      conditionLabel: item.conditionLabel,
      color: item.color,
      material: item.material,
      quantityAvailable: item.quantityAvailable,
      brandName: item.brandName,
      sizeLabel: item.sizeLabel,
      image: item.image,
      allowOffers: item.allowOffers,
    };
  }

  function addArticleToCart(item, event) {
    addItem(
      {
        id: item.articleId,
        slug: item.slug || item.articleSlug,
        title: item.title || item.articleTitle,
        brandName: item.brandName,
        sizeText: item.sizeLabel,
        primaryImage: item.image,
        salePrice: item.salePrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountedPrice: item.discountedPrice,
        quantityAvailable: item.quantityAvailable,
        status: item.status || item.articleStatus,
      },
      1,
      {
        sourceRect:
          event?.currentTarget?.getBoundingClientRect?.() || null,
      },
    );
  }

  function getOrderLatestStatusDate(order) {
    return (
      order.shippedAt ||
      order.cancelledAt ||
      order.approvedAt ||
      order.reservedUntil ||
      order.createdAt
    );
  }

  async function handleRemoveAlert(alertId) {
    try {
      setAlertError("");
      setAlertPendingIds((current) => [...current, alertId]);
      await apiFetch(`/api/public/account/alerts/${alertId}`, {
        method: "DELETE",
      });
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
    } catch (err) {
      setAlertError(err.message || "No pudimos actualizar la alerta.");
    } finally {
      setAlertPendingIds((current) => current.filter((id) => id !== alertId));
    }
  }

  function toggleWishlistSort(key) {
    setWishlistPage(1);
    setWishlistSort((current) => ({
      key,
      direction: getNextSortDirection(current, key),
    }));
  }

  function toggleOrdersSort(key) {
    setOrdersPage(1);
    setOrdersSort((current) => ({
      key,
      direction: getNextSortDirection(
        current,
        key,
        key === "createdAt" || key === "updatedAt" ? "desc" : "asc",
      ),
    }));
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateAddressField(name, value) {
    setForm((current) => ({
      ...current,
      defaultAddress: {
        ...current.defaultAddress,
        [name]: value,
      },
    }));
  }

  function togglePreferenceField(name, value) {
    setForm((current) => {
      const values = current[name] || [];
      return {
        ...current,
        [name]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setProfileLoading(true);
      setProfileError("");
      setProfileMessage("");
      await apiFetch("/api/public/account/profile", {
        method: "PATCH",
        body: {
          ...form,
          preferredShippingMethodId: form.preferredShippingMethodId || null,
          preferredPaymentMethod: form.preferredPaymentMethod || null,
          defaultAddress: form.defaultAddress?.addressLine
            ? form.defaultAddress
            : null,
        },
      });
      setProfileMessage("Datos guardados");
    } catch (err) {
      setProfileError(err.message || "No se pudieron guardar los datos.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function openOrderDetail(orderId) {
    try {
      setOrderModalOpen(true);
      setOrderDetailLoading(true);
      setOrderDetailError("");
      const response = await apiFetch(`/api/public/account/orders/${orderId}`);
      setSelectedOrderDetail(response.order || null);
    } catch (err) {
      setOrderDetailError(
        err.message || "No pudimos cargar el detalle de la orden.",
      );
      setSelectedOrderDetail(null);
    } finally {
      setOrderDetailLoading(false);
    }
  }

  function renderGuestState() {
    return (
      <section className="section-card page-stack">
        <p className="section-kicker">Mi cuenta</p>
        <h1>Mi cuenta</h1>
        <p className="muted-copy">
          Puedes seguir guardando prendas como invitado. Para editar datos,
          alertas y ordenes, entra con tu cuenta.
        </p>
        <div className="inline-action-group">
          <Link to="/login" className="button button-primary">
            Ingresar
          </Link>
          <Link to="/register" className="button button-secondary">
            Crear cuenta
          </Link>
        </div>
      </section>
    );
  }

  function renderPreferencesCheckboxes(name, options) {
    return (
      <div className="preference-grid">
        {options.map((option) => {
          const checked = (form[name] || []).includes(option.label);
          return (
            <label
              key={`${name}-${option.id}`}
              className={
                checked ? "preference-check is-active" : "preference-check"
              }
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePreferenceField(name, option.label)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className="container page-stack account-page-shell">
      <SeoHead
        title="Mi cuenta | ESADAR"
        description="Gestiona tus datos, guardados, alertas y ordenes en ESADAR."
        noindex={!isAuthenticated}
      />

      {isAuthenticated ? null : renderGuestState()}

      <nav className="account-tabs" aria-label="Secciones de cuenta">
        {TAB_ITEMS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.path}
            className={({ isActive }) =>
              isActive ? "admin-tab active" : "admin-tab"
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {activeTab === "perfil" && isAuthenticated ? (
        <section className="section-card page-stack">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Perfil</p>
              <h2>Mis datos</h2>
            </div>
          </div>

          <form className="page-stack" onSubmit={handleSubmit}>
            <div className="admin-filter-grid">
              <label className="field-group">
                <span>Nombre</span>
                <input
                  className="input"
                  value={form.firstName}
                  onChange={(event) =>
                    updateField("firstName", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Apellido</span>
                <input
                  className="input"
                  value={form.lastName}
                  onChange={(event) =>
                    updateField("lastName", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Telefono / WhatsApp</span>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Instagram</span>
                <input
                  className="input"
                  value={form.instagram}
                  onChange={(event) =>
                    updateField("instagram", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Fecha de nacimiento</span>
                <input
                  className="input"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) =>
                    updateField("birthDate", event.target.value)
                  }
                />
              </label>
              <label className="field-group field-group-span-2">
                <span>Direccion de envio</span>
                <input
                  className="input"
                  value={form.defaultAddress.addressLine}
                  onChange={(event) =>
                    updateAddressField("addressLine", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Ciudad</span>
                <input
                  className="input"
                  value={form.defaultAddress.city}
                  onChange={(event) =>
                    updateAddressField("city", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Departamento</span>
                <input
                  className="input"
                  value={form.defaultAddress.state}
                  onChange={(event) =>
                    updateAddressField("state", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Codigo postal</span>
                <input
                  className="input"
                  value={form.defaultAddress.postalCode}
                  onChange={(event) =>
                    updateAddressField("postalCode", event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Metodo de pago preferente</span>
                <select
                  className="input"
                  value={form.preferredPaymentMethod}
                  onChange={(event) =>
                    updateField("preferredPaymentMethod", event.target.value)
                  }
                >
                  <option value="">Sin preferencia</option>
                  {(paymentMethodOptions || []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Metodo de envio preferente</span>
                <select
                  className="input"
                  value={form.preferredShippingMethodId}
                  onChange={(event) =>
                    updateField("preferredShippingMethodId", event.target.value)
                  }
                >
                  <option value="">Sin preferencia</option>
                  {shippingMethodOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group field-group-span-2">
                <span>Notas de entrega</span>
                <textarea
                  className="input textarea"
                  rows="3"
                  value={form.defaultAddress.deliveryNotes}
                  onChange={(event) =>
                    updateAddressField("deliveryNotes", event.target.value)
                  }
                />
              </label>
            </div>

            <div className="page-stack-sm">
              <div>
                <p className="section-kicker">Preferencias</p>
                <h3>Mis preferencias</h3>
              </div>
              <div className="page-stack-sm">
                <div>
                  <strong>Categorias</strong>
                  {renderPreferencesCheckboxes(
                    "preferredCategories",
                    categoryOptions.slice(0, 12),
                  )}
                </div>
                <div>
                  <strong>Marcas</strong>
                  {renderPreferencesCheckboxes(
                    "preferredBrands",
                    brandOptions.slice(0, 12),
                  )}
                </div>
                <div>
                  <strong>Talles</strong>
                  {renderPreferencesCheckboxes(
                    "preferredSizes",
                    sizeOptions.slice(0, 12),
                  )}
                </div>
                <div>
                  <strong>Colores</strong>
                  {availableColors.length ? (
                    <div className="preference-grid">
                      {availableColors.map((color) => {
                        const checked = form.preferredColors.includes(color);
                        return (
                          <label
                            key={color}
                            className={
                              checked
                                ? "preference-check is-active"
                                : "preference-check"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                togglePreferenceField("preferredColors", color)
                              }
                            />
                            <span>{color}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted-copy">
                      A medida que interactues con prendas vamos a mostrar
                      colores frecuentes aqui.
                    </p>
                  )}
                </div>
                <label className="field-group">
                  <span>Notas</span>
                  <textarea
                    className="input textarea"
                    rows="3"
                    value={form.preferenceNotes}
                    onChange={(event) =>
                      updateField("preferenceNotes", event.target.value)
                    }
                  />
                </label>
              </div>
            </div>

            {profileError ? <p className="error-copy">{profileError}</p> : null}
            {profileMessage ? (
              <p className="success-copy">{profileMessage}</p>
            ) : null}
            <div className="inline-action-group">
              <button
                type="submit"
                className="button button-primary"
                disabled={profileLoading}
              >
                {profileLoading ? "Guardando..." : "Guardar datos"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === "guardados" ? (
        <section className="section-card page-stack">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Wishlist</p>
              <h2>Mis guardados</h2>
            </div>
          </div>

          {wishlistLoading ? (
            <p className="muted-copy">Cargando guardados...</p>
          ) : null}
          {!wishlistLoading && !wishlistItems.length ? (
            <div className="page-stack-sm">
              <p className="muted-copy">Todavia no guardaste prendas.</p>
              <Link to="/" className="button button-primary">
                Ver catalogo
              </Link>
            </div>
          ) : null}

          {wishlistItems.length ? (
            <>
              <LocalTablePagination
                page={wishlistPage}
                totalPages={wishlistTotalPages}
                totalItems={sortedWishlistItems.length}
                onPrevious={() =>
                  setWishlistPage((current) => Math.max(1, current - 1))
                }
                onNext={() =>
                  setWishlistPage((current) =>
                    Math.min(wishlistTotalPages, current + 1),
                  )
                }
              />

              <div className="account-mobile-list">
                {pagedWishlistItems.map((item) => {
                  const isAvailable = isArticleAvailable(item);
                  const currentPrice = Number(
                    item.discountedPrice || item.salePrice || 0,
                  );
                  const comparePrice =
                    Number(item.salePrice || 0) > currentPrice
                      ? formatCurrency(item.salePrice)
                      : null;

                  return (
                    <SummaryItemCard
                      key={`wishlist-mobile-${item.articleId}`}
                      image={item.image}
                      imageAlt={item.title}
                      imageFallbackLabel={item.title}
                      imageTo={articlePath(item)}
                      badge={getAvailabilityBadge(item)}
                      title={item.title}
                      titleTo={articlePath(item)}
                      subtitle={item.sizeLabel || "Talle no especificado"}
                      meta={[
                        item.brandName ? `Marca: ${item.brandName}` : null,
                        item.conditionLabel || null,
                      ].filter(Boolean)}
                      price={formatCurrency(currentPrice)}
                      comparePrice={comparePrice}
                      actions={[
                        <WishlistHeartButton
                          active
                          pending={pendingIds.includes(Number(item.articleId))}
                          className="summary-item-card__favorite-action wishlist-heart-button--bare"
                          labelActive="Quitar de guardados"
                          labelInactive="Guardar articulo"
                          onToggle={() =>
                            void toggleItem(item, getWishlistItemPayload(item))
                          }
                        />,
                        <Link
                          to={articlePath(item)}
                          className="icon-action-button"
                          aria-label={`Ver ${item.title}`}
                          title="Ver prenda"
                        >
                          <EyeIcon />
                        </Link>,
                        <button
                          type="button"
                          className="icon-action-button"
                          aria-label={`Agregar ${item.title} al carrito`}
                          title="Agregar al carrito"
                          disabled={!isAvailable}
                          onClick={(event) => addArticleToCart(item, event)}
                        >
                          <CartIcon />
                        </button>,
                      ]}
                    />
                  );
                })}
              </div>

              <div className="table-shell account-desktop-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Imagen</th>
                      <SortableTh
                        sortKey="title"
                        sort={wishlistSort}
                        onSort={toggleWishlistSort}
                      >
                        Prenda
                      </SortableTh>
                      <SortableTh
                        sortKey="price"
                        sort={wishlistSort}
                        onSort={toggleWishlistSort}
                      >
                        Precio
                      </SortableTh>
                      <SortableTh
                        sortKey="status"
                        sort={wishlistSort}
                        onSort={toggleWishlistSort}
                      >
                        Estado
                      </SortableTh>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedWishlistItems.map((item) => {
                      const isAvailable =
                        Number(item.quantityAvailable || 0) > 0 &&
                        item.status !== "SOLD_OUT";

                      return (
                        <tr key={item.articleId}>
                          <td>
                            <Link
                              to={articlePath(item)}
                              className="table-thumb-link"
                              aria-label={`Ver ${item.title}`}
                            >
                              <SmartImage
                                src={item.image}
                                alt={item.title}
                                fallbackLabel={item.title}
                                className="table-thumb-image"
                              />
                            </Link>
                          </td>
                          <td>
                            <div className="cell-stack">
                              <Link
                                to={articlePath(item)}
                                className="table-strong-link"
                              >
                                {item.title}
                              </Link>
                              <span className="muted-copy">
                                {item.sizeLabel || "Talle no especificado"}
                                {item.conditionLabel
                                  ? ` · ${item.conditionLabel}`
                                  : ""}
                              </span>
                            </div>
                          </td>
                          <td>
                            <strong>
                              {formatCurrency(
                                item.discountedPrice || item.salePrice,
                              )}
                            </strong>
                          </td>
                          <td>
                            {isAvailable
                              ? item.allowOffers
                                ? "Disponible · ofertable"
                                : "Disponible"
                              : "Agotado"}
                          </td>
                          <td>
                            <div className="table-actions">
                              <WishlistHeartButton
                                active
                                pending={pendingIds.includes(Number(item.articleId))}
                                className="summary-item-card__favorite-action wishlist-heart-button--bare"
                                labelActive="Quitar de guardados"
                                labelInactive="Guardar articulo"
                                onToggle={() =>
                                  void toggleItem(item, getWishlistItemPayload(item))
                                }
                              />
                              <Link
                                to={articlePath(item)}
                                className="icon-action-button"
                                aria-label={`Ver ${item.title}`}
                                title="Ver prenda"
                              >
                                <EyeIcon />
                              </Link>
                              <button
                                type="button"
                                className="icon-action-button"
                                aria-label={`Agregar ${item.title} al carrito`}
                                title="Agregar al carrito"
                                disabled={!isAvailable}
                                onClick={(event) => addArticleToCart(item, event)}
                              >
                                <CartIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === "alertas" ? (
        <section className="section-card page-stack">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Seguimiento</p>
              <h2>Mis alertas</h2>
            </div>
          </div>

          {!isAuthenticated ? (
            <p className="muted-copy">
              Inicia sesion para ver tus alertas guardadas.
            </p>
          ) : null}
          {isAuthenticated && !alerts.length ? (
            <p className="muted-copy">Todavia no tienes alertas activas.</p>
          ) : null}
          {alertError ? <p className="error-copy">{alertError}</p> : null}

          {isAuthenticated && alerts.length ? (
            <>
              <div className="account-mobile-list">
                {alerts.map((alert) => {
                  const alertPath =
                    alert.articleId || alert.articleSlug
                      ? articlePath({
                          articleId: alert.articleId,
                          articleSlug: alert.articleSlug,
                          slug: alert.articleSlug,
                        })
                      : null;
                  const isAvailable = isArticleAvailable(alert);
                  const currentPrice = Number(
                    alert.discountedPrice || alert.salePrice || 0,
                  );
                  const comparePrice =
                    Number(alert.salePrice || 0) > currentPrice
                      ? formatCurrency(alert.salePrice)
                      : null;
                  const alertPending = alertPendingIds.includes(alert.id);

                  return (
                    <SummaryItemCard
                      key={`alert-mobile-${alert.id}`}
                      image={alert.image || null}
                      imageAlt={alert.articleTitle || "Alerta"}
                      imageFallbackLabel={alert.articleTitle || "Alerta"}
                      imageTo={alertPath || undefined}
                      badge={
                        alert.articleId ? (
                          getAvailabilityBadge(alert)
                        ) : (
                          <StatusBadge
                            status={alert.status}
                            labels={{ ACTIVE: "Activa", INACTIVE: "Inactiva" }}
                          />
                        )
                      }
                      title={alert.articleTitle || "Alerta general"}
                      titleTo={alertPath || undefined}
                      subtitle={
                        alert.sizeLabel ||
                        ALERT_TYPE_LABELS[alert.alertType] ||
                        alert.alertType
                      }
                      meta={[
                        alert.brandName ? `Marca: ${alert.brandName}` : null,
                        `Alerta: ${
                          ALERT_TYPE_LABELS[alert.alertType] ||
                          alert.alertType
                        }`,
                        `Creada: ${formatDate(alert.createdAt)}`,
                      ].filter(Boolean)}
                      price={alert.articleId ? formatCurrency(currentPrice) : null}
                      comparePrice={alert.articleId ? comparePrice : null}
                      actions={[
                        <button
                          type="button"
                          className={`icon-action-button summary-item-card__alert-action${
                            alertPending ? " is-pending" : " is-active"
                          }`}
                          aria-label="Quitar alerta"
                          title="Quitar alerta"
                          disabled={alertPending}
                          onClick={() => void handleRemoveAlert(alert.id)}
                        >
                          <BellIcon active />
                        </button>,
                        alertPath ? (
                          <Link
                            to={alertPath}
                            className="icon-action-button"
                            aria-label={`Ver ${alert.articleTitle || "alerta"}`}
                            title="Ver prenda"
                          >
                            <EyeIcon />
                          </Link>
                        ) : (
                          <span
                            className="icon-action-button summary-item-card__icon-placeholder"
                            aria-hidden="true"
                          >
                            <EyeIcon />
                          </span>
                        ),
                        <button
                          type="button"
                          className="icon-action-button"
                          aria-label={`Agregar ${
                            alert.articleTitle || "prenda"
                          } al carrito`}
                          title="Agregar al carrito"
                          disabled={!alert.articleId || !isAvailable}
                          onClick={(event) => addArticleToCart(alert, event)}
                        >
                          <CartIcon />
                        </button>,
                      ]}
                    />
                  );
                })}
              </div>

              <div className="history-list account-desktop-list">
                {alerts.map((alert) => (
                  <article key={alert.id} className="history-row">
                    <div>
                      <strong>{alert.articleTitle || "Alerta general"}</strong>
                      <p className="muted-copy">
                        {ALERT_TYPE_LABELS[alert.alertType] || alert.alertType} ·{" "}
                        <StatusBadge
                          status={alert.status}
                          labels={{ ACTIVE: "Activa", INACTIVE: "Inactiva" }}
                        />
                      </p>
                    </div>
                    <div className="table-actions">
                      <span>{formatDate(alert.createdAt)}</span>
                      <button
                        type="button"
                        className={`icon-action-button summary-item-card__alert-action${
                          alertPendingIds.includes(alert.id)
                            ? " is-pending"
                            : " is-active"
                        }`}
                        aria-label="Quitar alerta"
                        title="Quitar alerta"
                        disabled={alertPendingIds.includes(alert.id)}
                        onClick={() => void handleRemoveAlert(alert.id)}
                      >
                        <BellIcon active />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === "ordenes" ? (
        <section className="section-card page-stack">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Compras</p>
              <h2>Mis ordenes</h2>
            </div>
          </div>

          {!isAuthenticated ? (
            <p className="muted-copy">
              Inicia sesion para revisar tus ordenes.
            </p>
          ) : null}
          {isAuthenticated && !orders.length ? (
            <p className="muted-copy">Todavia no tienes ordenes asociadas.</p>
          ) : null}

          {isAuthenticated && orders.length ? (
            <>
              <LocalTablePagination
                page={ordersPage}
                totalPages={ordersTotalPages}
                totalItems={sortedOrders.length}
                onPrevious={() =>
                  setOrdersPage((current) => Math.max(1, current - 1))
                }
                onNext={() =>
                  setOrdersPage((current) =>
                    Math.min(ordersTotalPages, current + 1),
                  )
                }
              />

              <div className="account-mobile-list">
                {pagedOrders.map((order) => {
                  const latestStatusDate = getOrderLatestStatusDate(order);
                  return (
                    <SummaryItemCard
                      key={`order-mobile-${order.id}`}
                      badge={<OrderStatusBadge status={order.orderStatus} />}
                      title={order.orderNumber}
                      subtitle={`${order.itemsCount} prenda${
                        order.itemsCount === 1 ? "" : "s"
                      }`}
                      meta={[
                        `Fecha: ${formatDate(order.createdAt)}`,
                        `Pago: ${
                          PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                          order.paymentMethod
                        }`,
                        order.shippingMethodName
                          ? `Envio: ${order.shippingMethodName}`
                          : null,
                        `Ultima actualizacion: ${formatDate(
                          latestStatusDate,
                        )}`,
                      ].filter(Boolean)}
                      price={formatCurrency(order.total)}
                      actions={[
                        <Link
                          to={`/cuenta/ordenes/${order.id}`}
                          className="icon-action-button"
                          aria-label={`Ver ${order.orderNumber}`}
                          title="Ver orden"
                        >
                          <EyeIcon />
                        </Link>,
                      ]}
                    />
                  );
                })}
              </div>

              <div className="table-shell account-desktop-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableTh
                        sortKey="orderNumber"
                        sort={ordersSort}
                        onSort={toggleOrdersSort}
                      >
                        Orden
                      </SortableTh>
                      <SortableTh
                        sortKey="createdAt"
                        sort={ordersSort}
                        onSort={toggleOrdersSort}
                      >
                        Fecha
                      </SortableTh>
                      <SortableTh
                        sortKey="total"
                        sort={ordersSort}
                        onSort={toggleOrdersSort}
                      >
                        Total
                      </SortableTh>
                      <SortableTh
                        sortKey="orderStatus"
                        sort={ordersSort}
                        onSort={toggleOrdersSort}
                      >
                        Estado
                      </SortableTh>
                      <SortableTh
                        sortKey="updatedAt"
                        sort={ordersSort}
                        onSort={toggleOrdersSort}
                      >
                        Ultima actualizacion
                      </SortableTh>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOrders.map((order) => {
                      const latestStatusDate =
                        order.shippedAt ||
                        order.cancelledAt ||
                        order.approvedAt ||
                        order.reservedUntil ||
                        order.createdAt;

                      return (
                        <tr key={order.id}>
                          <td>
                            <div className="cell-stack">
                              <strong>{order.orderNumber}</strong>
                              <span className="muted-copy">
                                {order.itemsCount} prendas ·{" "}
                                {PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                                  order.paymentMethod}
                                {order.shippingMethodName
                                  ? ` · ${order.shippingMethodName}`
                                  : ""}
                              </span>
                            </div>
                          </td>
                          <td>{formatDate(order.createdAt)}</td>
                          <td>
                            <strong>{formatCurrency(order.total)}</strong>
                          </td>
                          <td>
                            <OrderStatusBadge status={order.orderStatus} />
                          </td>
                          <td>{formatDate(latestStatusDate)}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="icon-action-button"
                                aria-label={`Ver ${order.orderNumber}`}
                                title="Ver orden"
                                onClick={() => void openOrderDetail(order.id)}
                              >
                                <EyeIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <SurfaceModal
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title={
          selectedOrderDetail
            ? `Orden ${selectedOrderDetail.orderNumber}`
            : "Detalle de orden"
        }
        description="Seguimiento visible para tu compra."
        wide
      >
        {orderDetailLoading ? (
          <p className="muted-copy">Cargando detalle...</p>
        ) : null}
        {orderDetailError ? (
          <p className="error-copy">{orderDetailError}</p>
        ) : null}

        {selectedOrderDetail ? (
          <div className="page-stack">
            <div className="admin-detail-meta">
              <p className="summary-line">
                <span>Estado actual</span>
                <strong>
                  <OrderStatusBadge status={selectedOrderDetail.orderStatus} />
                </strong>
              </p>
              <p className="summary-line">
                <span>Pago</span>
                <strong>
                  <StatusBadge
                    status={selectedOrderDetail.paymentStatus}
                    labels={PAYMENT_STATUS_LABELS}
                  />
                </strong>
              </p>
              <p className="summary-line">
                <span>Total</span>
                <strong>{formatCurrency(selectedOrderDetail.total)}</strong>
              </p>
              <p className="summary-line">
                <span>Ultima actualizacion</span>
                <strong>{formatDate(selectedOrderDetail.updatedAt)}</strong>
              </p>
            </div>

            <div className="page-stack-sm">
              <div>
                <p className="section-kicker">Prendas</p>
                <div className="table-shell order-items-table-shell">
                  <table className="data-table order-items-table">
                    <thead>
                      <tr>
                        <th>Prenda</th>
                        <th>Marca</th>
                        <th>Talle</th>
                        <th>Cant.</th>
                        <th>Unitario</th>
                        <th>Total</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderDetail.items.map((item) => {
                        const itemPath =
                          item.articleSlug || item.articleId
                            ? articlePath({
                                slug: item.articleSlug,
                                id: item.articleId,
                                articleId: item.articleId,
                              })
                            : null;

                        return (
                          <tr key={item.id}>
                            <td className="cell-truncate">
                              <div className="cell-stack cell-stack--compact">
                                <strong title={item.articleTitle}>
                                  {item.articleTitle}
                                </strong>
                                <span className="muted-copy">
                                  #{item.articleId || "s/d"}
                                </span>
                              </div>
                            </td>
                            <td className="cell-truncate">
                              {item.brandName || "Sin marca"}
                            </td>
                            <td className="cell-truncate">
                              {item.size || "Sin talle"}
                            </td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.finalUnitPrice)}</td>
                            <td>
                              <strong>{formatCurrency(item.lineTotal)}</strong>
                            </td>
                            <td>
                              {itemPath ? (
                                <Link
                                  className="icon-action-button"
                                  to={itemPath}
                                  aria-label={`Ver ${item.articleTitle}`}
                                  title="Ver prenda"
                                >
                                  <EyeIcon />
                                </Link>
                              ) : (
                                <span className="muted-copy">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="section-kicker">Historial</p>
                <div className="history-list">
                  {selectedOrderDetail.history.length ? (
                    selectedOrderDetail.history.map((entry) => (
                      <article key={entry.id} className="history-row">
                        <div>
                          <strong>
                            <OrderStatusBadge status={entry.toStatus} />
                          </strong>
                          <p className="muted-copy">
                            {entry.reason || "Sin comentario adicional"}
                          </p>
                        </div>
                        <span>{formatDate(entry.changedAt)}</span>
                      </article>
                    ))
                  ) : (
                    <p className="muted-copy">
                      Todavia no hay cambios de estado registrados.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SurfaceModal>
    </div>
  );
}
