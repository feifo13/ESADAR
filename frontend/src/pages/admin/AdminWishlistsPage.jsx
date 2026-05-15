import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { EyeIcon } from "../../components/ActionIcons.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { articlePath } from "../../lib/routes.js";
import { buildQueryString } from "../../lib/query.js";
import AppLoader from "../../components/AppLoader.jsx";

const ALERT_STATUS_LABELS = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
};

const ARTICLE_STATUS_LABELS = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  RESERVED: "Reservada",
  SOLD_OUT: "Agotada",
};

const initialFilters = {
  q: "",
  categoryId: "",
  brandId: "",
  status: "",
  source: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "updatedAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

export default function AdminWishlistsPage() {
  const { categoryOptions, brandOptions } = useLookups();
  const { notifyError } = useNotification();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [topArticles, setTopArticles] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedWishlist, setSelectedWishlist] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const activeQuery = useMemo(() => buildQueryString(filters), [filters]);
  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(pagination.total || 0) / Number(pagination.pageSize || 25),
    ),
  );
  const activeFiltersCount =
    [
      filters.q,
      filters.categoryId,
      filters.brandId,
      filters.status,
      filters.source,
      filters.dateFrom,
      filters.dateTo,
    ].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadWishlists() {
      try {
        setLoading(true);
        setError("");
        const [
          listResponse,
          summaryResponse,
          topArticlesResponse,
          topUsersResponse,
        ] = await Promise.all([
          apiFetch(`/api/admin/wishlists?${activeQuery}`),
          apiFetch(`/api/admin/wishlists/summary?${activeQuery}`),
          apiFetch(`/api/admin/wishlists/top-articles?${activeQuery}`),
          apiFetch(`/api/admin/wishlists/top-users?${activeQuery}`),
        ]);

        if (ignore) return;

        setItems(listResponse.items || []);
        setPagination(
          listResponse.pagination || { page: 1, pageSize: 25, total: 0 },
        );
        setSummary(summaryResponse.summary || null);
        setTopArticles(topArticlesResponse.items || []);
        setTopUsers(topUsersResponse.items || []);

        if ((listResponse.items || []).length && !selectedId) {
          setSelectedId(listResponse.items[0].id);
        }
        if (!(listResponse.items || []).length) {
          setSelectedId(null);
          setSelectedWishlist(null);
        }
      } catch (err) {
        if (!ignore) {
          const errorMessage = err.message || "No se pudieron cargar los guardados.";
          setError(errorMessage);
          notifyError(errorMessage);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadWishlists();
    return () => {
      ignore = true;
    };
  }, [activeQuery]);

  useEffect(() => {
    if (!selectedId) return;

    let ignore = false;

    async function loadDetail() {
      try {
        setDetailLoading(true);
        const response = await apiFetch(`/api/admin/wishlists/${selectedId}`);
        if (!ignore) setSelectedWishlist(response.wishlist);
      } catch (err) {
        if (!ignore) {
          const errorMessage = err.message || "No se pudo cargar el detalle del guardado.";
          setError(errorMessage);
          notifyError(errorMessage);
        }
      } finally {
        if (!ignore) setDetailLoading(false);
      }
    }

    loadDetail();
    return () => {
      ignore = true;
    };
  }, [selectedId]);

  function updateDraft(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    setFilters((current) => ({
      ...current,
      ...draftFilters,
      page: 1,
    }));
  }

  function clearFilters() {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
  }

  function changePage(nextPage) {
    setFilters((current) => ({ ...current, page: nextPage }));
  }

  function changePageSize(nextPageSize) {
    const numericSize = Number(nextPageSize) || 25;
    setDraftFilters((current) => ({ ...current, pageSize: numericSize }));
    setFilters((current) => ({ ...current, pageSize: numericSize, page: 1 }));
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Wishlists</h1>
          </div>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de guardados"
          description=""
          buttonLabel="Mostrar filtros"
          summary={
            activeFiltersCount
              ? `${activeFiltersCount} filtro(s) activos`
              : "Sin filtros adicionales"
          }
          onApply={applyFilters}
          onClear={clearFilters}
          showClear={activeFiltersCount > 0}
        >
          <div className="admin-filter-grid">
            <label className="field-group">
              <span>Buscar</span>
              <input
                className="input"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
                placeholder="Nombre, contacto o articulo"
              />
            </label>
            <label className="field-group">
              <span>Categoría</span>
              <select
                className="input"
                value={draftFilters.categoryId}
                onChange={(event) =>
                  updateDraft("categoryId", event.target.value)
                }
              >
                <option value="">Todas</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Marca</span>
              <select
                className="input"
                value={draftFilters.brandId}
                onChange={(event) => updateDraft("brandId", event.target.value)}
              >
                <option value="">Todas</option>
                {brandOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Estado articulo</span>
              <select
                className="input"
                value={draftFilters.status}
                onChange={(event) => updateDraft("status", event.target.value)}
              >
                <option value="">Todos</option>
                <option value="ACTIVE">Activo</option>
                <option value="RESERVED">Reservado</option>
                <option value="SOLD_OUT">Agotado</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </label>
            <label className="field-group">
              <span>Origen</span>
              <input
                className="input"
                value={draftFilters.source}
                onChange={(event) => updateDraft("source", event.target.value)}
                placeholder="REGISTERED, SESSION..."
              />
            </label>
            <label className="field-group">
              <span>Desde</span>
              <input
                className="input"
                type="date"
                value={draftFilters.dateFrom}
                onChange={(event) =>
                  updateDraft("dateFrom", event.target.value)
                }
              />
            </label>
            <label className="field-group">
              <span>Hasta</span>
              <input
                className="input"
                type="date"
                value={draftFilters.dateTo}
                onChange={(event) => updateDraft("dateTo", event.target.value)}
              />
            </label>
            <label className="field-group">
              <span>Orden</span>
              <select
                className="input"
                value={draftFilters.sortBy}
                onChange={(event) => updateDraft("sortBy", event.target.value)}
              >
                <option value="updatedAt">Actividad</option>
                <option value="lastSavedAt">Ultimo guardado</option>
                <option value="itemCount">Cantidad</option>
                <option value="ownerName">Usuario</option>
                <option value="source">Origen</option>
              </select>
            </label>
            <label className="field-group">
              <span>Dirección</span>
              <select
                className="input"
                value={draftFilters.sortDir}
                onChange={(event) => updateDraft("sortDir", event.target.value)}
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </label>
            <label className="field-group">
              <span>Page size</span>
              <select
                className="input"
                value={draftFilters.pageSize}
                onChange={(event) => changePageSize(event.target.value)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
        </ResponsiveFilterPanel>

        {summary ? (
          <div className="stats-kpi-grid">
            <article className="stats-kpi-card">
              <span>Total wishlists</span>
              <strong>{summary.totalWishlists}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Articulos guardados</span>
              <strong>{summary.totalSavedItems}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Usuarios / leads</span>
              <strong>{summary.totalOwners}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Promedio por wishlist</span>
              <strong>{summary.averageItemsPerWishlist}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Articulo mas guardado</span>
              <strong>{summary.topArticle?.title || "Sin datos"}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Ultima actividad</span>
              <strong>
                {summary.lastActivity
                  ? formatDate(summary.lastActivity)
                  : "Sin datos"}
              </strong>
            </article>
          </div>
        ) : null}

        {loading ? (
          <AppLoader variant="inline" label="Cargando analítica de guardados" />
        ) : null}
      </section>

      <section className="admin-detail-grid">
        <div className="page-stack">
          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Ranking</p>
                <h2>Articulos mas guardados</h2>
              </div>
            </div>
            <div className="table-stack">
              {topArticles.map((item) => (
                <div
                  key={item.id}
                  className="history-row history-row--with-image"
                >
                  <div className="history-row__media">
                    <SmartImage
                      src={item.image}
                      alt={item.title}
                      fallbackLabel={item.title}
                      className="history-thumb"
                    />
                  </div>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="muted-copy">
                      {item.categoryName || "Sin categoria"} ·{" "}
                      {item.brandName || "Sin marca"} ·{" "}
                      {item.sizeLabel || "Sin talle"}
                    </p>
                  </div>
                  <div className="history-row__meta">
                    <strong>{item.savesCount} guardados</strong>
                    <span>
                      {formatCurrency(item.discountedPrice || item.salePrice)}
                    </span>
                    <Link
                      to={articlePath(item)}
                      className="icon-action-button"
                      aria-label={`Ver ${item.title}`}
                      title="Ver articulo"
                    >
                      <EyeIcon />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Usuarios</p>
                <h2>Quien guarda mas prendas</h2>
              </div>
            </div>
            <div className="table-stack">
              {topUsers.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={
                    selectedId === item.id
                      ? "history-row history-row--button is-active"
                      : "history-row history-row--button"
                  }
                  onClick={() => setSelectedId(item.id)}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted-copy">
                      {item.email ||
                        item.phone ||
                        item.instagram ||
                        item.sessionToken ||
                        "Sin contacto"}
                    </p>
                    <p className="muted-copy">
                      {(item.savedTitlesPreview || []).join(" · ") ||
                        "Sin resumen de prendas"}
                    </p>
                  </div>
                  <div className="history-row__meta">
                    <strong>{item.itemCount} guardados</strong>
                    <span>
                      {item.lastSavedAt
                        ? formatDate(item.lastSavedAt)
                        : "Sin actividad"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Listado</p>
                <h2>Wishlists</h2>
              </div>
            </div>
            <div className="table-stack">
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={
                    selectedId === item.id
                      ? "history-row history-row--button is-active"
                      : "history-row history-row--button"
                  }
                  onClick={() => setSelectedId(item.id)}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted-copy">
                      {item.email ||
                        item.phone ||
                        item.instagram ||
                        item.sessionToken ||
                        "Sin contacto"}
                    </p>
                    <p className="muted-copy">
                      Ultimo articulo: {item.lastArticleTitle || "Sin prendas"}
                    </p>
                  </div>
                  <div className="history-row__meta">
                    <strong>{item.itemCount} prendas</strong>
                    <span>
                      {item.lastSavedAt
                        ? formatDate(item.lastSavedAt)
                        : formatDate(item.updatedAt)}
                    </span>
                    <span>{item.source || "Sin origen"}</span>
                  </div>
                </button>
              ))}
            </div>
            <AdminPagination
              page={pagination.page}
              totalPages={totalPages}
              onChange={changePage}
            />
          </section>
        </div>

        <aside className="section-card page-stack admin-detail-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Detalle</p>
              <h2>{selectedWishlist?.name || "Selecciona una wishlist"}</h2>
            </div>
          </div>

          {detailLoading ? (
            <AppLoader variant="inline" label="Cargando detalle" />
          ) : null}
          {selectedWishlist ? (
            <>
              <div className="admin-detail-meta">
                <span>
                  <strong>Contacto:</strong>{" "}
                  {selectedWishlist.email ||
                    selectedWishlist.phone ||
                    selectedWishlist.instagram ||
                    selectedWishlist.sessionToken ||
                    "Sin dato"}
                </span>
                <span>
                  <strong>Origen:</strong>{" "}
                  {selectedWishlist.source || "Sin origen"}
                </span>
                <span>
                  <strong>Ultima actividad:</strong>{" "}
                  {formatDate(selectedWishlist.updatedAt)}
                </span>
              </div>

              <div className="page-stack-sm">
                <h3>Prendas guardadas</h3>
                {(selectedWishlist.items || []).map((item) => (
                  <article
                    key={item.id}
                    className="history-row history-row--with-image"
                  >
                    <div className="history-row__media">
                      <SmartImage
                        src={item.image}
                        alt={item.title}
                        fallbackLabel={item.title}
                        className="history-thumb"
                      />
                    </div>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="muted-copy">
                        {item.sizeLabel || "Sin talle"} ·{" "}
                        {item.conditionLabel || "Sin estado"}
                      </p>
                      <p className="muted-copy">
                        {item.quantityAvailable > 0
                          ? `${item.quantityAvailable} disponibles`
                          : "Sin stock"}{" "}
                        ·{" "}
                        {item.wasPurchasedByOwner
                          ? "Ya fue comprada"
                          : "Aun no comprada"}
                      </p>
                    </div>
                    <div className="history-row__meta">
                      <strong>
                        {formatCurrency(item.discountedPrice || item.salePrice)}
                      </strong>
                      <span>{formatDate(item.savedAt)}</span>
                      <Link
                        to={articlePath(item)}
                        className="icon-action-button"
                        aria-label={`Ver ${item.title}`}
                        title="Ver articulo"
                      >
                        <EyeIcon />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="page-stack-sm">
                <h3>Alertas relacionadas</h3>
                {(selectedWishlist.alerts || []).length ? (
                  selectedWishlist.alerts.map((alert) => (
                    <div key={alert.id} className="history-row">
                      <div>
                        <strong>
                          {alert.articleTitle || "Alerta general"}
                        </strong>
                        <p className="muted-copy">
                          {alert.alertType} ·{" "}
                          <StatusBadge status={alert.status} labels={ALERT_STATUS_LABELS} />
                        </p>
                      </div>
                      <span>{formatDate(alert.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted-copy">Sin alertas asociadas.</p>
                )}
              </div>

              <div className="page-stack-sm">
                <h3>Eventos relacionados</h3>
                {(selectedWishlist.events || []).length ? (
                  selectedWishlist.events.map((event) => (
                    <div key={event.id} className="history-row">
                      <div>
                        <strong>
                          {event.articleTitle || "Interaccion general"}
                        </strong>
                        <p className="muted-copy">{event.eventType}</p>
                      </div>
                      <span>{formatDate(event.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted-copy">Sin eventos asociados.</p>
                )}
              </div>
            </>
          ) : (
            <p className="muted-copy">
              Selecciona una wishlist para ver el detalle completo.
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
