import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import { BanIcon, CheckIcon, XIcon } from "../../components/ActionIcons.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";

const OFFER_STATUS_LABELS = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
  USED: "Usada",
};

const initialFilters = {
  q: "",
  status: "",
  categoryId: "",
  brandId: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

export default function AdminOffersPage() {
  const { categoryOptions, brandOptions } = useLookups();
  const { notifySuccess, notifyError } = useNotification();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [offers, setOffers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const query = useMemo(() => buildQueryString(filters), [filters]);
  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(pagination.total || 0) / Number(pagination.pageSize || 25),
    ),
  );
  const activeFiltersCount =
    [
      filters.q,
      filters.status,
      filters.categoryId,
      filters.brandId,
      filters.dateFrom,
      filters.dateTo,
    ].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadOffers() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/offers?${query}`);
        if (ignore) return;
        setOffers(response.items || []);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore)
          setError(err.message || "No se pudieron cargar las ofertas");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOffers();
    return () => {
      ignore = true;
    };
  }, [query, refreshNonce]);

  function updateDraft(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    setFilters((current) => ({ ...current, ...draftFilters, page: 1 }));
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

  function changeSort(sortBy) {
    const sortDir =
      filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setDraftFilters((current) => ({ ...current, sortBy, sortDir }));
    setFilters((current) => ({ ...current, sortBy, sortDir, page: 1 }));
  }

  async function handleStatusChange(offerId, nextStatus) {
    try {
      setError("");
      setMessage("");
      await apiFetch(`/api/admin/offers/${offerId}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      setMessage("La oferta fue actualizada correctamente.");
      notifySuccess("La oferta fue actualizada correctamente.");
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo actualizar la oferta";
      setError(errorMessage);
      notifyError(errorMessage);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Ofertas</h1>
          </div>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
        {message ? <p className="success-copy">{message}</p> : null}

        <ResponsiveFilterPanel
          title="Filtros de ofertas"
          description=""
          buttonLabel="Mostrar filtros"
          summary={
            activeFiltersCount
              ? `${activeFiltersCount} filtro(s) activos`
              : "Sin filtros adicionales"
          }
          onApply={applyFilters}
          onClear={clearFilters}
        >
          <div className="admin-filter-grid">
            <label className="field-group">
              <span>Buscar</span>
              <input
                className="input"
                placeholder="Articulo, codigo, contacto, email"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>Estado</span>
              <select
                className="input"
                value={draftFilters.status}
                onChange={(event) => updateDraft("status", event.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendientes</option>
                <option value="ACCEPTED">Aceptadas</option>
                <option value="REJECTED">Rechazadas</option>
                <option value="CANCELLED">Canceladas</option>
                <option value="EXPIRED">Vencidas</option>
                <option value="USED">Usadas</option>
              </select>
            </label>

            <label className="field-group">
              <span>Categoria</span>
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
                <option value="createdAt">Fecha</option>
                <option value="offeredAmount">Monto</option>
                <option value="status">Estado</option>
                <option value="articleTitle">Articulo</option>
                <option value="contactName">Contacto</option>
              </select>
            </label>

            <label className="field-group">
              <span>Direccion</span>
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
              <span>Tamano de pagina</span>
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

        {loading ? <div className="centered-card">Cargando...</div> : null}

        <AdminPagination
          className="pagination-row--top"
          page={Number(filters.page || 1)}
          totalPages={totalPages}
          totalItems={Number(pagination.total || 0)}
          loading={loading}
          onPrevious={() =>
            changePage(Math.max(1, Number(filters.page || 1) - 1))
          }
          onNext={() =>
            changePage(Math.min(totalPages, Number(filters.page || 1) + 1))
          }
        />

        {!loading ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Imagen</th>
                  <SortableTh
                    sortKey="createdAt"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Fecha
                  </SortableTh>
                  <SortableTh
                    sortKey="articleTitle"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Articulo
                  </SortableTh>
                  <SortableTh
                    sortKey="contactName"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Contacto
                  </SortableTh>
                  <SortableTh
                    sortKey="offeredAmount"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Monto
                  </SortableTh>
                  <SortableTh
                    sortKey="status"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Estado
                  </SortableTh>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const displayStatus =
                    offer.consumedAt || offer.status === "USED"
                      ? "USED"
                      : offer.status;
                  return (
                    <tr key={offer.id}>
                      <td>
                        <SmartImage
                          src={offer.article.image}
                          alt={offer.article.title}
                          fallbackLabel={offer.article.title}
                          className="table-thumb-image"
                        />
                      </td>
                      <td>{formatDate(offer.createdAt)}</td>
                      <td>
                        <div className="cell-stack">
                          <strong>{offer.article.title}</strong>
                          <span className="muted-copy">
                            {offer.article.internalCode ||
                              `#${offer.article.id}`}
                          </span>
                          <span className="muted-copy">
                            {offer.article.categoryName || "Sin categoria"} -{" "}
                            {offer.article.brandName || "Sin marca"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>
                            {offer.contact.firstName} {offer.contact.lastName}
                          </strong>
                          <span className="muted-copy">
                            {offer.contact.email || "Sin email"}
                          </span>
                          <span className="muted-copy">
                            {offer.contact.phone || "Sin telefono"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <span className="muted-copy">
                            Oferta: {formatCurrency(offer.offeredAmount)}
                          </span>
                          <strong>
                            <span className="muted-copy">
                              Precio: {formatCurrency(offer.article.salePrice)}
                            </span>
                          </strong>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack cell-stack--compact">
                          <StatusBadge
                            status={displayStatus}
                            labels={OFFER_STATUS_LABELS}
                          />
                          {offer.consumedAt ? (
                            <Link
                              className="pill pill-offer"
                              to={`/admin/orders/${offer.consumedOrderId}`}
                            >
                              Usada en orden #{offer.consumedOrderId}
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {offer.status === "PENDING" ? (
                          <div className="table-actions">
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() =>
                                handleStatusChange(offer.id, "ACCEPTED")
                              }
                              aria-label={`Aceptar oferta de ${offer.contact.firstName} ${offer.contact.lastName}`}
                              title="Aceptar"
                            >
                              <CheckIcon />
                              <span className="admin-action-label">
                                Aceptar
                              </span>
                            </button>
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() =>
                                handleStatusChange(offer.id, "REJECTED")
                              }
                              aria-label={`Rechazar oferta de ${offer.contact.firstName} ${offer.contact.lastName}`}
                              title="Rechazar"
                            >
                              <XIcon />
                              <span className="admin-action-label">
                                Rechazar
                              </span>
                            </button>
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() =>
                                handleStatusChange(offer.id, "CANCELLED")
                              }
                              aria-label={`Eliminar oferta de ${offer.contact.firstName} ${offer.contact.lastName}`}
                              title="Eliminar"
                            >
                              <BanIcon />
                              <span className="admin-action-label">
                                Eliminar
                              </span>
                            </button>
                          </div>
                        ) : (
                          <span className="muted-copy">Sin acciones</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!offers.length ? (
                  <tr>
                    <td colSpan="6">
                      <p className="muted-copy">No hay ofertas para mostrar.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        <AdminPagination
          page={Number(filters.page || 1)}
          totalPages={totalPages}
          totalItems={Number(pagination.total || 0)}
          loading={loading}
          onPrevious={() =>
            changePage(Math.max(1, Number(filters.page || 1) - 1))
          }
          onNext={() =>
            changePage(Math.min(totalPages, Number(filters.page || 1) + 1))
          }
        />
      </section>
    </div>
  );
}
