import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminBatchSnackbar from "../../components/admin/AdminBatchSnackbar.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import OrderStatusBadge from "../../components/OrderStatusBadge.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import {
  DownloadIcon,
  EyeIcon,
  ArchiveIcon,
  CheckIcon,
  BanIcon,
} from "../../components/ActionIcons.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiDownload, apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { formatPaymentMethod } from "../../lib/paymentMethods.js";
import { buildQueryString } from "../../lib/query.js";
import AppLoader from "../../components/AppLoader.jsx";

const BATCH_ORDER_STATUSES = ["PENDING", "RESERVED", "APPROVED"];

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
  const { user } = useAuth();
  const { categoryOptions, brandOptions } = useLookups();
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
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
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const isSuperAdmin = user?.roles?.includes("SUPER_ADMIN");
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

  const selectedOrderIdSet = useMemo(
    () => new Set(selectedOrderIds),
    [selectedOrderIds],
  );
  const selectableOrderIds = useMemo(
    () =>
      orders
        .filter((order) => BATCH_ORDER_STATUSES.includes(order.orderStatus))
        .map((order) => order.id),
    [orders],
  );
  const allSelectableOrdersChecked =
    selectableOrderIds.length > 0 &&
    selectableOrderIds.every((id) => selectedOrderIdSet.has(id));


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
        if (!ignore) setError(err.message || "No se pudo cargar órdenes");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      ignore = true;
    };
  }, [query, refreshNonce]);

  useEffect(() => {
    setSelectedOrderIds((current) =>
      current.filter((id) => orders.some((order) => order.id === id)),
    );
  }, [orders]);

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

  function toggleOrderSelection(orderId) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  }

  function toggleAllSelectableOrders() {
    setSelectedOrderIds((current) => {
      if (selectableOrderIds.every((id) => current.includes(id))) {
        return current.filter((id) => !selectableOrderIds.includes(id));
      }
      return Array.from(new Set([...current, ...selectableOrderIds]));
    });
  }

  function clearSelection() {
    setSelectedOrderIds([]);
  }

  async function handleBatchOrders(action) {
    if (!selectedOrderIds.length) return;

    const actionLabels = {
      APPROVE: "aprobar",
      CANCEL: "cancelar",
      SHIP: "marcar como enviadas",
    };

    const confirmed = window.confirm(
      `Vas a ${actionLabels[action] || "actualizar"} ${selectedOrderIds.length} orden(es). ¿Continuar?`,
    );
    if (!confirmed) return;

    try {
      setBatchBusy(true);
      setError("");
      const response = await apiFetch("/api/admin/orders/batch", {
        method: "PATCH",
        body: {
          action,
          ids: selectedOrderIds,
          reason:
            action === "CANCEL"
              ? "Orden cancelada en lote desde administración."
              : undefined,
        },
      });

      const message = `${response.succeeded || 0} orden(es) procesada(s).${
        response.failed ? ` ${response.failed} con error.` : ""
      }`;
      if (response.failed) {
        notifyWarning(message);
      } else {
        notifySuccess(message);
      }
      clearSelection();
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo ejecutar la acción batch";
      notifyError(errorMessage);
      clearSelection();
    } finally {
      setBatchBusy(false);
    }
  }

  async function handleDownloadPdf(order) {
    try {
      setError("");
      await apiDownload(`/api/admin/orders/${order.id}/receipt.pdf`, {
        fileName: `boleta-${order.orderNumber || order.id}.pdf`,
        extension: "pdf",
      });
    } catch (err) {
      const errorMessage =
        err.message || "No se pudo descargar el PDF de la orden";
      setError(errorMessage);
      notifyError(errorMessage);
    }
  }

  async function handleCancelOrder(order) {
    try {
      setError("");
      await apiFetch(`/api/admin/orders/${order.id}/cancel`, {
        method: "PATCH",
        body: { reason: "Eliminada desde administración." },
      });
      notifySuccess(
        order.hasOffers
          ? "La orden fue cancelada y el intento de oferta quedó consumido."
          : "La orden fue cancelada.",
      );
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo cancelar la orden";
      setError(errorMessage);
      notifyError(errorMessage);
    }
  }

  function changeSort(sortBy) {
    const sortDir =
      filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
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
            <h1>Órdenes</h1>
          </div>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}

        {isSuperAdmin ? (
          <AdminBatchSnackbar
            selectedCount={selectedOrderIds.length}
            entityLabel="orden"
            entityPluralLabel="órdenes"
            busy={batchBusy}
            onClear={clearSelection}
            actions={[
              {
                key: "approve",
                label: "Aprobar",
                icon: CheckIcon,
                variant: "success",
                onClick: () => handleBatchOrders("APPROVE"),
              },
              {
                key: "ship",
                label: "Enviar",
                icon: ArchiveIcon,
                onClick: () => handleBatchOrders("SHIP"),
              },
              {
                key: "cancel",
                label: "Cancelar",
                icon: BanIcon,
                variant: "danger",
                onClick: () => handleBatchOrders("CANCEL"),
              },
            ]}
          />
        ) : null}

        <ResponsiveFilterPanel
          title="Filtros de órdenes"
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
                placeholder="Número, cliente, email, artículo"
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
                <option value="orderNumber">Número</option>
                <option value="total">Total</option>
                <option value="orderStatus">Estado de orden</option>
                <option value="paymentStatus">Estado de pago</option>
                <option value="customerName">Cliente</option>
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
              <span>Tamaño de página</span>
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

        {loading ? <AppLoader variant="card" label="Cargando Orders" /> : null}

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
                  {isSuperAdmin ? (
                    <th className="batch-select-cell">
                      <input
                        type="checkbox"
                        className="batch-select-checkbox"
                        checked={allSelectableOrdersChecked}
                        disabled={!selectableOrderIds.length || batchBusy}
                        onChange={toggleAllSelectableOrders}
                        aria-label="Seleccionar órdenes accionables"
                      />
                    </th>
                  ) : null}
                  <SortableTh
                    sortKey="orderNumber"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    ID
                  </SortableTh>
                  <SortableTh
                    sortKey="customerName"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Cliente
                  </SortableTh>
                  <th>Email</th>
                  <SortableTh
                    sortKey="createdAt"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Fecha
                  </SortableTh>
                  <SortableTh
                    sortKey="orderStatus"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Estado
                  </SortableTh>
                  <SortableTh
                    sortKey="paymentStatus"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Pago
                  </SortableTh>
                  <th>Método de envío</th>
                  <SortableTh
                    sortKey="total"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Total
                  </SortableTh>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isBatchSelectable = BATCH_ORDER_STATUSES.includes(order.orderStatus);
                  return (
                    <tr key={order.id}>
                      {isSuperAdmin ? (
                        <td className="batch-select-cell" data-label="Seleccionar">
                          <input
                            type="checkbox"
                            className="batch-select-checkbox"
                            checked={selectedOrderIdSet.has(order.id)}
                            disabled={!isBatchSelectable || batchBusy}
                            onChange={() => toggleOrderSelection(order.id)}
                            aria-label={`Seleccionar orden ${order.orderNumber}`}
                          />
                        </td>
                      ) : null}
                      <td>
                      <div className="cell-stack">
                        <strong>{order.orderNumber}</strong>
                        <span className="muted-copy">#{order.id}</span>
                        <span className="muted-copy">
                          {order.totalQuantity || order.itemCount || 0} prenda
                          {Number(order.totalQuantity || order.itemCount || 0) === 1 ? "" : "s"}
                          {" · "}
                          {order.itemCount || 0} línea
                          {Number(order.itemCount || 0) === 1 ? "" : "s"}
                        </span>
                        {order.hasOffers ? (
                          <span className="pill pill-offer">
                            {order.offerCount || 1} oferta
                            {Number(order.offerCount || 1) === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {order.customer.firstName} {order.customer.lastName}
                    </td>
                    <td>{order.customer.email || "Sin email"}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <div className="cell-stack cell-stack--compact">
                        <OrderStatusBadge status={order.orderStatus} />
                        {order.hasOffers ? (
                          <span className="pill pill-offer">Con oferta</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack cell-stack--compact">
                        <span>{formatPaymentMethod(order.paymentMethod)}</span>
                        <StatusBadge
                          status={order.paymentStatus}
                          labels={PAYMENT_STATUS_LABELS}
                        />
                      </div>
                    </td>
                    <td>
                      {order.shippingMethodDescription ||
                        order.shippingMethodName ||
                        "-"}
                    </td>
                    <td>
                      <strong>{formatCurrency(order.total)}</strong>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="icon-action-button"
                          aria-label={`Ver orden ${order.orderNumber}`}
                          title="Ver orden"
                        >
                          <EyeIcon />
                        </Link>
                        <button
                          type="button"
                          className="ghost-button admin-icon-action"
                          aria-label={`Descargar PDF de la orden ${order.orderNumber}`}
                          title="Descargar PDF"
                          onClick={() => handleDownloadPdf(order)}
                        >
                          <DownloadIcon />
                          {/* <span className="admin-action-label">
                            Descargar PDF
                          </span> */}
                        </button>
                        {!["CANCELLED", "SHIPPED", "EXPIRED"].includes(
                          order.orderStatus,
                        ) ? (
                          <button
                            type="button"
                            className="ghost-button admin-icon-action"
                            aria-label={`Eliminar orden ${order.orderNumber}`}
                            title="Eliminar"
                            onClick={() => void handleCancelOrder(order)}
                          >
                            <ArchiveIcon />
                            {/* <span className="admin-action-label">Eliminar</span> */}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    </tr>
                  );
                })}

                {!orders.length ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 10 : 9}>
                      <p className="muted-copy">
                        No hay órdenes para los filtros seleccionados.
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
