import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import OrderStatusBadge from "../../components/OrderStatusBadge.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import { DownloadIcon, EyeIcon } from "../../components/ActionIcons.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { apiDownload, apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";

const PAYMENT_STATUS_LABELS = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
  REFUNDED: "Reintegrado",
  PAID: "Pagado",
};

const initialFilters = {
  q: "",
  status: "",
  paymentStatus: "",
  categoryId: "",
  brandId: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

export default function AdminOrdersPage() {
  const { categoryOptions, brandOptions } = useLookups();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      filters.paymentStatus,
      filters.categoryId,
      filters.brandId,
      filters.dateFrom,
      filters.dateTo,
    ].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadOrders() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/orders?${query}`);
        if (ignore) return;
        setOrders(response.items || []);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) setError(err.message || "No se pudo cargar ordenes");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      ignore = true;
    };
  }, [query]);

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


  async function handleDownloadPdf(order) {
    try {
      setError("");
      await apiDownload(`/api/admin/orders/${order.id}/receipt.pdf`, {
        fileName: `boleta-${order.orderNumber || order.id}.pdf`,
        extension: "pdf",
      });
    } catch (err) {
      setError(err.message || "No se pudo descargar el PDF de la orden");
    }
  }

  function changeSort(sortBy) {
    const sortDir = filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setDraftFilters((current) => ({ ...current, sortBy, sortDir }));
    setFilters((current) => ({ ...current, sortBy, sortDir, page: 1 }));
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Ordenes</h1>
          </div>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de ordenes"
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
                placeholder="Numero, cliente, email, articulo"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>Estado de orden</span>
              <select
                className="input"
                value={draftFilters.status}
                onChange={(event) => updateDraft("status", event.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendientes</option>
                <option value="RESERVED">Reservadas</option>
                <option value="APPROVED">Aprobadas</option>
                <option value="SHIPPED">Enviadas</option>
                <option value="CANCELLED">Canceladas</option>
                <option value="EXPIRED">Vencidas</option>
              </select>
            </label>

            <label className="field-group">
              <span>Estado de pago</span>
              <select
                className="input"
                value={draftFilters.paymentStatus}
                onChange={(event) =>
                  updateDraft("paymentStatus", event.target.value)
                }
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="PAID">Pagado</option>
                <option value="FAILED">Fallido</option>
                <option value="REFUNDED">Reintegrado</option>
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
                <option value="orderNumber">Numero</option>
                <option value="total">Total</option>
                <option value="orderStatus">Estado de orden</option>
                <option value="paymentStatus">Estado de pago</option>
                <option value="customerName">Cliente</option>
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

        {error ? <p className="error-copy">{error}</p> : null}
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
                  <SortableTh sortKey="orderNumber" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>ID</SortableTh>
                  <SortableTh sortKey="customerName" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Cliente</SortableTh>
                  <th>Email</th>
                  <SortableTh sortKey="createdAt" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Fecha</SortableTh>
                  <SortableTh sortKey="orderStatus" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Estado</SortableTh>
                  <SortableTh sortKey="paymentStatus" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Pago</SortableTh>
                  <th>Metodo de envio</th>
                  <SortableTh sortKey="total" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Total</SortableTh>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{order.orderNumber}</strong>
                        <span className="muted-copy">#{order.id}</span>
                      </div>
                    </td>
                    <td>{order.customer.firstName} {order.customer.lastName}</td>
                    <td>{order.customer.email || "Sin email"}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td><OrderStatusBadge status={order.orderStatus} /></td>
                    <td>
                      <div className="cell-stack cell-stack--compact">
                        <span>{order.paymentMethod || "-"}</span>
                        <StatusBadge status={order.paymentStatus} labels={PAYMENT_STATUS_LABELS} />
                      </div>
                    </td>
                    <td>{order.shippingMethodDescription || order.shippingMethodName || "-"}</td>
                    <td><strong>{formatCurrency(order.total)}</strong></td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="ghost-button admin-icon-action"
                          aria-label={`Ver orden ${order.orderNumber}`}
                          title="Ver orden"
                        >
                          <EyeIcon />
                          <span className="admin-action-label">Ver orden</span>
                        </Link>
                        <button
                          type="button"
                          className="ghost-button admin-icon-action"
                          aria-label={`Descargar PDF de la orden ${order.orderNumber}`}
                          title="Descargar PDF"
                          onClick={() => handleDownloadPdf(order)}
                        >
                          <DownloadIcon />
                          <span className="admin-action-label">Descargar PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!orders.length ? (
                  <tr>
                    <td colSpan="9">
                      <p className="muted-copy">
                        No hay ordenes para los filtros seleccionados.
                      </p>
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
