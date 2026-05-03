import { useEffect, useMemo, useState } from "react";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";

const initialFilters = {
  q: "",
  source: "",
  entityType: "",
  actionCode: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

function formatActor(entry) {
  if (entry.actorLabel) return entry.actorLabel;
  if (entry.actorUserId) return `Usuario #${entry.actorUserId}`;
  return "Sistema";
}

export default function AdminAuditPage() {
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
      filters.source,
      filters.entityType,
      filters.actionCode,
      filters.dateFrom,
      filters.dateTo,
    ].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadAudit() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/audit?${query}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) setError(err.message || "No se pudo cargar la auditoria");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadAudit();
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
            <h1>Auditoria</h1>
          </div>
          <p className="muted-copy">{pagination.total || 0} eventos</p>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de auditoria"
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
                placeholder="Actor, accion, entidad, entity id"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>Source</span>
              <select
                className="input"
                value={draftFilters.source}
                onChange={(event) => updateDraft("source", event.target.value)}
              >
                <option value="">Todos</option>
                <option value="BACKOFFICE">Backoffice</option>
                <option value="FRONTEND">Frontend</option>
                <option value="API">API</option>
                <option value="SYSTEM">System</option>
              </select>
            </label>

            <label className="field-group">
              <span>Entidad</span>
              <input
                className="input"
                value={draftFilters.entityType}
                onChange={(event) =>
                  updateDraft("entityType", event.target.value)
                }
              />
            </label>

            <label className="field-group">
              <span>Accion</span>
              <input
                className="input"
                value={draftFilters.actionCode}
                onChange={(event) =>
                  updateDraft("actionCode", event.target.value)
                }
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
                <option value="createdAt">Fecha</option>
                <option value="actionCode">Accion</option>
                <option value="actorLabel">Actor</option>
                <option value="entityType">Entidad</option>
                <option value="source">Source</option>
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
                  <SortableTh sortKey="createdAt" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Fecha</SortableTh>
                  <SortableTh sortKey="actorLabel" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Usuario / actor</SortableTh>
                  <SortableTh sortKey="actionCode" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Accion</SortableTh>
                  <SortableTh sortKey="entityType" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Entidad</SortableTh>
                  <th>Entity ID</th>
                  <SortableTh sortKey="source" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Source</SortableTh>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{formatActor(entry)}</td>
                    <td>{entry.actionCode}</td>
                    <td>{entry.entityType}</td>
                    <td>{entry.entityId || "-"}</td>
                    <td>{entry.source}</td>
                  </tr>
                ))}

                {!items.length ? (
                  <tr>
                    <td colSpan="6">
                      <p className="muted-copy">
                        No hay eventos de auditoria para mostrar.
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
