import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import SmartImage from '../components/SmartImage.jsx';
import SurfaceModal from '../components/SurfaceModal.jsx';
import SortableTh from '../components/SortableTh.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import { useLookups } from '../contexts/LookupsContext.jsx';
import { useWishlist } from '../contexts/WishlistContext.jsx';
import { apiFetch } from '../lib/api.js';
import { formatCurrency, formatDate } from '../lib/format.js';
import { articlePath } from '../lib/routes.js';
import { getNextSortDirection, sortRows } from '../lib/tableSort.js';

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: 'Transferencia',
  MERCADO_PAGO: 'Mercado Pago',
};

const ORDER_STATUS_LABELS = {
  RESERVED: 'Reservada',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  SHIPPED: 'Enviada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

const TAB_ITEMS = [
  { key: 'perfil', label: 'Mis datos', path: '/cuenta/perfil' },
  { key: 'guardados', label: 'Mis guardados', path: '/cuenta/guardados' },
  { key: 'alertas', label: 'Mis alertas', path: '/cuenta/alertas' },
  { key: 'ordenes', label: 'Mis ordenes', path: '/cuenta/ordenes' },
];

function getActiveTab(pathname) {
  if (pathname.includes('/guardados')) return 'guardados';
  if (pathname.includes('/alertas')) return 'alertas';
  if (pathname.includes('/ordenes')) return 'ordenes';
  return 'perfil';
}

const initialForm = {
  firstName: '',
  lastName: '',
  birthDate: '',
  email: '',
  phone: '',
  instagram: '',
  preferredPaymentMethod: '',
  preferredShippingMethodId: '',
  defaultAddress: {
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Uruguay',
    deliveryNotes: '',
  },
  preferredCategories: [],
  preferredBrands: [],
  preferredSizes: [],
  preferredColors: [],
  preferenceNotes: '',
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
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [wishlistSort, setWishlistSort] = useState({ key: 'title', direction: 'asc' });
  const [ordersSort, setOrdersSort] = useState({ key: 'createdAt', direction: 'desc' });

  useEffect(() => {
    if (!isAuthenticated) return;

    let ignore = false;

    async function loadAccountData() {
      try {
        setProfileLoading(true);
        setProfileError('');
        const [profileResponse, ordersResponse, alertsResponse] = await Promise.all([
          apiFetch('/api/public/account/profile'),
          apiFetch('/api/public/account/orders'),
          apiFetch('/api/public/account/alerts'),
        ]);

        if (ignore) return;

        setForm({
          firstName: profileResponse.profile?.firstName || '',
          lastName: profileResponse.profile?.lastName || '',
          birthDate: profileResponse.profile?.birthDate
            ? String(profileResponse.profile.birthDate).slice(0, 10)
            : '',
          email: profileResponse.profile?.email || '',
          phone: profileResponse.profile?.phone || '',
          instagram: profileResponse.profile?.instagram || '',
          preferredPaymentMethod:
            profileResponse.profile?.preferredPaymentMethod || '',
          preferredShippingMethodId: profileResponse.profile
            ?.preferredShippingMethodId
            ? String(profileResponse.profile.preferredShippingMethodId)
            : '',
          defaultAddress: {
            addressLine:
              profileResponse.profile?.defaultAddress?.addressLine || '',
            city: profileResponse.profile?.defaultAddress?.city || '',
            state: profileResponse.profile?.defaultAddress?.state || '',
            postalCode:
              profileResponse.profile?.defaultAddress?.postalCode || '',
            country:
              profileResponse.profile?.defaultAddress?.country || 'Uruguay',
            deliveryNotes:
              profileResponse.profile?.defaultAddress?.deliveryNotes || '',
          },
          preferredCategories:
            profileResponse.profile?.preferredCategories || [],
          preferredBrands: profileResponse.profile?.preferredBrands || [],
          preferredSizes: profileResponse.profile?.preferredSizes || [],
          preferredColors: profileResponse.profile?.preferredColors || [],
          preferenceNotes: profileResponse.profile?.preferenceNotes || '',
        });
        setOrders(ordersResponse.items || []);
        setAlerts(alertsResponse.items || []);
      } catch (err) {
        if (!ignore) {
          setProfileError(err.message || 'No pudimos cargar tu cuenta.');
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
    () => sortRows(wishlistItems, wishlistSort, {
      title: (item) => item.title,
      price: (item) => item.discountedPrice || item.salePrice,
      status: (item) => (Number(item.quantityAvailable || 0) > 0 && item.status !== 'SOLD_OUT' ? 'Disponible' : 'Agotado'),
    }),
    [wishlistItems, wishlistSort],
  );

  const sortedOrders = useMemo(
    () => sortRows(orders, ordersSort, {
      orderNumber: (order) => order.orderNumber,
      createdAt: (order) => order.createdAt,
      total: (order) => order.total,
      orderStatus: (order) => ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus,
      updatedAt: (order) => order.shippedAt || order.cancelledAt || order.approvedAt || order.reservedUntil || order.createdAt,
    }),
    [orders, ordersSort],
  );

  function toggleWishlistSort(key) {
    setWishlistSort((current) => ({
      key,
      direction: getNextSortDirection(current, key),
    }));
  }

  function toggleOrdersSort(key) {
    setOrdersSort((current) => ({
      key,
      direction: getNextSortDirection(current, key, key === 'createdAt' || key === 'updatedAt' ? 'desc' : 'asc'),
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
      setProfileError('');
      setProfileMessage('');
      await apiFetch('/api/public/account/profile', {
        method: 'PATCH',
        body: {
          ...form,
          preferredShippingMethodId: form.preferredShippingMethodId || null,
          preferredPaymentMethod: form.preferredPaymentMethod || null,
          defaultAddress: form.defaultAddress?.addressLine
            ? form.defaultAddress
            : null,
        },
      });
      setProfileMessage('Datos guardados');
    } catch (err) {
      setProfileError(err.message || 'No se pudieron guardar los datos.');
    } finally {
      setProfileLoading(false);
    }
  }

  async function openOrderDetail(orderId) {
    try {
      setOrderModalOpen(true);
      setOrderDetailLoading(true);
      setOrderDetailError('');
      const response = await apiFetch(`/api/public/account/orders/${orderId}`);
      setSelectedOrderDetail(response.order || null);
    } catch (err) {
      setOrderDetailError(
        err.message || 'No pudimos cargar el detalle de la orden.',
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
                checked ? 'preference-check is-active' : 'preference-check'
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

      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Cliente</p>
            <h1>Mi cuenta</h1>
            <p className="muted-copy">
              {isAuthenticated
                ? `Hola, ${user?.firstName || 'cliente'}. Desde aqui puedes actualizar tus datos, revisar guardados y seguir tus alertas.`
                : 'Tus guardados siguen disponibles aunque todavia no hayas iniciado sesion.'}
            </p>
          </div>
        </div>

        <nav className="account-tabs" aria-label="Secciones de cuenta">
          {TAB_ITEMS.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.path}
              className={({ isActive }) =>
                isActive ? 'admin-tab active' : 'admin-tab'
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </section>

      {activeTab === 'perfil' && isAuthenticated ? (
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
                  onChange={(event) => updateField('firstName', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Apellido</span>
                <input
                  className="input"
                  value={form.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Telefono / WhatsApp</span>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Instagram</span>
                <input
                  className="input"
                  value={form.instagram}
                  onChange={(event) => updateField('instagram', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Fecha de nacimiento</span>
                <input
                  className="input"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => updateField('birthDate', event.target.value)}
                />
              </label>
              <label className="field-group field-group-span-2">
                <span>Direccion de envio</span>
                <input
                  className="input"
                  value={form.defaultAddress.addressLine}
                  onChange={(event) =>
                    updateAddressField('addressLine', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Ciudad</span>
                <input
                  className="input"
                  value={form.defaultAddress.city}
                  onChange={(event) => updateAddressField('city', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Departamento</span>
                <input
                  className="input"
                  value={form.defaultAddress.state}
                  onChange={(event) => updateAddressField('state', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Codigo postal</span>
                <input
                  className="input"
                  value={form.defaultAddress.postalCode}
                  onChange={(event) =>
                    updateAddressField('postalCode', event.target.value)
                  }
                />
              </label>
              <label className="field-group">
                <span>Metodo de pago preferente</span>
                <select
                  className="input"
                  value={form.preferredPaymentMethod}
                  onChange={(event) =>
                    updateField('preferredPaymentMethod', event.target.value)
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
                    updateField('preferredShippingMethodId', event.target.value)
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
                    updateAddressField('deliveryNotes', event.target.value)
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
                    'preferredCategories',
                    categoryOptions.slice(0, 12),
                  )}
                </div>
                <div>
                  <strong>Marcas</strong>
                  {renderPreferencesCheckboxes(
                    'preferredBrands',
                    brandOptions.slice(0, 12),
                  )}
                </div>
                <div>
                  <strong>Talles</strong>
                  {renderPreferencesCheckboxes(
                    'preferredSizes',
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
                                ? 'preference-check is-active'
                                : 'preference-check'
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                togglePreferenceField('preferredColors', color)
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
                      updateField('preferenceNotes', event.target.value)
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
                {profileLoading ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === 'guardados' ? (
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
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Imagen</th>
                    <SortableTh sortKey="title" sort={wishlistSort} onSort={toggleWishlistSort}>Prenda</SortableTh>
                    <SortableTh sortKey="price" sort={wishlistSort} onSort={toggleWishlistSort}>Precio</SortableTh>
                    <SortableTh sortKey="status" sort={wishlistSort} onSort={toggleWishlistSort}>Estado</SortableTh>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWishlistItems.map((item) => {
                    const isAvailable =
                      Number(item.quantityAvailable || 0) > 0 &&
                      item.status !== 'SOLD_OUT';

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
                              {item.sizeLabel || 'Talle no especificado'}
                              {item.conditionLabel
                                ? ` · ${item.conditionLabel}`
                                : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>
                            {formatCurrency(item.discountedPrice || item.salePrice)}
                          </strong>
                        </td>
                        <td>
                          {isAvailable
                            ? item.allowOffers
                              ? 'Disponible · ofertable'
                              : 'Disponible'
                            : 'Agotado'}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                toggleItem(item, {
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
                                })
                              }
                              disabled={pendingIds.includes(Number(item.articleId))}
                            >
                              Remover
                            </button>
                            <Link
                              to={articlePath(item)}
                              className="ghost-button"
                            >
                              Ver prenda
                            </Link>
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={!isAvailable}
                              onClick={(event) => {
                                addItem(
                                  {
                                    id: item.articleId,
                                    slug: item.slug,
                                    title: item.title,
                                    brandName: item.brandName,
                                    sizeText: item.sizeLabel,
                                    primaryImage: item.image,
                                    salePrice: item.salePrice,
                                    discountType: item.discountType,
                                    discountValue: item.discountValue,
                                    discountedPrice: item.discountedPrice,
                                    quantityAvailable: item.quantityAvailable,
                                    status: item.status,
                                  },
                                  1,
                                  {
                                    sourceRect:
                                      event?.currentTarget?.getBoundingClientRect?.() ||
                                      null,
                                  },
                                );
                              }}
                            >
                              Agregar al carrito
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'alertas' ? (
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
          <div className="history-list">
            {alerts.map((alert) => (
              <article key={alert.id} className="history-row">
                <div>
                  <strong>{alert.articleTitle || 'Alerta general'}</strong>
                  <p className="muted-copy">
                    {alert.alertType} · {alert.status}
                  </p>
                </div>
                <span>{formatDate(alert.createdAt)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'ordenes' ? (
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
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh sortKey="orderNumber" sort={ordersSort} onSort={toggleOrdersSort}>Orden</SortableTh>
                    <SortableTh sortKey="createdAt" sort={ordersSort} onSort={toggleOrdersSort}>Fecha</SortableTh>
                    <SortableTh sortKey="total" sort={ordersSort} onSort={toggleOrdersSort}>Total</SortableTh>
                    <SortableTh sortKey="orderStatus" sort={ordersSort} onSort={toggleOrdersSort}>Estado</SortableTh>
                    <SortableTh sortKey="updatedAt" sort={ordersSort} onSort={toggleOrdersSort}>Ultima actualizacion</SortableTh>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => {
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
                              {order.itemsCount} prendas ·{' '}
                              {PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                                order.paymentMethod}
                              {order.shippingMethodName
                                ? ` · ${order.shippingMethodName}`
                                : ''}
                            </span>
                          </div>
                        </td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td>
                          <strong>{formatCurrency(order.total)}</strong>
                        </td>
                        <td>
                          {ORDER_STATUS_LABELS[order.orderStatus] ||
                            order.orderStatus}
                        </td>
                        <td>{formatDate(latestStatusDate)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => void openOrderDetail(order.id)}
                            >
                              Detalles
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <SurfaceModal
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title={
          selectedOrderDetail
            ? `Orden ${selectedOrderDetail.orderNumber}`
            : 'Detalle de orden'
        }
        description="Seguimiento visible para tu compra."
        wide
      >
        {orderDetailLoading ? (
          <p className="muted-copy">Cargando detalle...</p>
        ) : null}
        {orderDetailError ? <p className="error-copy">{orderDetailError}</p> : null}

        {selectedOrderDetail ? (
          <div className="page-stack">
            <div className="admin-detail-meta">
              <p className="summary-line">
                <span>Estado actual</span>
                <strong>
                  {ORDER_STATUS_LABELS[selectedOrderDetail.orderStatus] ||
                    selectedOrderDetail.orderStatus}
                </strong>
              </p>
              <p className="summary-line">
                <span>Pago</span>
                <strong>{selectedOrderDetail.paymentStatus}</strong>
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
                <div className="history-list">
                  {selectedOrderDetail.items.map((item) => (
                    <article key={item.id} className="history-row">
                      <div>
                        <strong>{item.articleTitle}</strong>
                        <p className="muted-copy">
                          {item.brandName || 'Sin marca'} ·{' '}
                          {item.size || 'Sin talle'} · Cantidad: {item.quantity}
                        </p>
                      </div>
                      <strong>{formatCurrency(item.lineTotal)}</strong>
                    </article>
                  ))}
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
                            {ORDER_STATUS_LABELS[entry.toStatus] || entry.toStatus}
                          </strong>
                          <p className="muted-copy">
                            {entry.reason || 'Sin comentario adicional'}
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
