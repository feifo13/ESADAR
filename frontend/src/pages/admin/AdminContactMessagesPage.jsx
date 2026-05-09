import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { ArchiveIcon, EyeIcon } from "../../components/ActionIcons.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";
import { useMobileMenu } from "../../contexts/MobileMenuContext.jsx";
import { notifyFormStatus } from "../../lib/validation.js";

const CONTACT_STATUS_LABELS = {
  NEW: "Nuevo",
  READ: "Leido",
  REPLIED: "Respondido",
  ARCHIVED: "Archivado",
};

const initialFilters = {
  q: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

export default function AdminContactMessagesPage() {
  const { notifyMobileStatus } = useMobileMenu();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
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
    [filters.q, filters.status, filters.dateFrom, filters.dateTo].filter(
      Boolean,
    ).length + (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadMessages() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/contact-messages?${query}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) {
          const errorMessage =
            err.message || "No se pudieron cargar los mensajes";
          setError(errorMessage);
          notifyFormStatus(notifyMobileStatus, "error", errorMessage);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMessages();
    return () => {
      ignore = true;
    };
  }, [query, refreshNonce, notifyMobileStatus]);

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

  async function updateStatus(messageId, nextStatus) {
    try {
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/contact-messages/${messageId}/status`,
        {
          method: "PATCH",
          body: { status: nextStatus },
        },
      );
      setItems((current) =>
        current.map((item) =>
          Number(item.id) === Number(messageId)
            ? {
                ...item,
                ...(response.message || {}),
                status: response.message?.status || nextStatus,
              }
            : item,
        ),
      );
      setMessage("El estado del mensaje fue actualizado.");
      notifyFormStatus(
        notifyMobileStatus,
        "success",
        "El estado del mensaje fue actualizado.",
      );
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo actualizar el mensaje";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Contactos</h1>
          </div>
          <p className="muted-copy">{pagination.total || 0} mensajes</p>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de contactos"
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
                placeholder="Nombre, email, telefono, mensaje"
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
                <option value="NEW">Nuevos</option>
                <option value="READ">Leidos</option>
                <option value="REPLIED">Respondidos</option>
                <option value="ARCHIVED">Archivados</option>
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
                <option value="status">Estado</option>
                <option value="name">Nombre</option>
                <option value="email">Email</option>
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
                  <SortableTh
                    sortKey="createdAt"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Fecha
                  </SortableTh>
                  <SortableTh
                    sortKey="name"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Nombre
                  </SortableTh>
                  <SortableTh
                    sortKey="email"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Contacto
                  </SortableTh>
                  <th>Mensaje</th>
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
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="cell-stack">
                        <strong>
                          {item.firstName} {item.lastName}
                        </strong>
                        <span className="muted-copy">
                          {item.birthDate
                            ? String(item.birthDate).slice(0, 10)
                            : "Sin fecha de nacimiento"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{item.email || "Sin email"}</span>
                        <span className="muted-copy">
                          {item.phone || "Sin telefono"}
                        </span>
                        <span className="muted-copy">
                          {item.instagram || "Sin Instagram"}
                        </span>
                      </div>
                    </td>
                    <td className="cell-copy">{item.message}</td>
                    <td>
                      <StatusBadge
                        status={item.status}
                        labels={CONTACT_STATUS_LABELS}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="icon-action-button"
                          to={`/admin/contact-messages/${item.id}`}
                          aria-label={`Ver detalle de ${item.firstName} ${item.lastName}`}
                          title="Ver detalle"
                        >
                          <EyeIcon />
                        </Link>
                        {item.status !== "ARCHIVED" ? (
                          <button
                            type="button"
                            className="ghost-button admin-icon-action"
                            onClick={() => updateStatus(item.id, "ARCHIVED")}
                            aria-label={`Eliminar mensaje de ${item.firstName} ${item.lastName}`}
                            title="Eliminar"
                          >
                            <ArchiveIcon />
                            {/* <span className="admin-action-label">Eliminar</span> */}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}

                {!items.length ? (
                  <tr>
                    <td colSpan="6">
                      <p className="muted-copy">
                        No hay mensajes para mostrar.
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
