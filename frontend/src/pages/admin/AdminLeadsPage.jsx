import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import { ArchiveIcon, EyeIcon } from "../../components/ActionIcons.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";
import { useMobileMenu } from "../../contexts/MobileMenuContext.jsx";
import { notifyFormStatus } from "../../lib/validation.js";
import AppLoader from "../../components/AppLoader.jsx";

const LEAD_STATUS_LABELS = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  ARCHIVED: "Archivado",
};

const SOURCE_LABELS = {
  CHECKOUT: "Checkout",
  CONTACT_FORM: "Contacto",
  MANUAL: "Manual",
  OFFER: "Oferta",
  NEWSLETTER: "Newsletter",
  STOCK_ALERT: "Alerta de stock",
  WISHLIST: "Guardado",
  ABANDONED_CART: "Carrito abandonado",
  PRODUCT_INTEREST: "Interes de producto",
};

const initialFilters = {
  q: "",
  source: "",
  leadStatus: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

function formatSource(source) {
  return SOURCE_LABELS[source] || source || "Sin origen";
}

function renderContact(lead) {
  return lead.email || lead.phone || lead.instagram || "Sin contacto";
}

export default function AdminLeadsPage() {
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
      filters.leadStatus,
      filters.dateFrom,
      filters.dateTo,
    ].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadLeads() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/leads?${query}`);
        if (ignore) return;

        const nextItems = response.items || [];
        setItems(nextItems);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) {
          const errorMessage = err.message || "No se pudieron cargar los leads";
          setError(errorMessage);
          notifyMobileStatus({
            type: "error",
            icon: "error",
            message: errorMessage,
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadLeads();
    return () => {
      ignore = true;
    };
  }, [query, notifyMobileStatus]);

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

  async function handleArchiveLead(lead) {
    try {
      setError("");
      setMessage("");
      const response = await apiFetch(`/api/admin/leads/${lead.id}/status`, {
        method: "PATCH",
        body: { leadStatus: "ARCHIVED", adminNotes: lead.adminNotes || "" },
      });
      setItems((current) =>
        current.map((item) =>
          Number(item.id) === Number(lead.id)
            ? {
                ...item,
                leadStatus: response.lead?.leadStatus || "ARCHIVED",
                adminNotes: response.lead?.adminNotes ?? item.adminNotes,
                updatedAt: response.lead?.updatedAt || item.updatedAt,
              }
            : item,
        ),
      );
      const successMessage = "El lead fue archivado.";
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
    } catch (err) {
      const errorMessage = err.message || "No se pudo archivar el lead";
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
            <h1>Leads</h1>
          </div>
          <p className="muted-copy">{pagination.total || 0} leads</p>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de leads"
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
                placeholder="Nombre, email, telefono, Instagram"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>Origen</span>
              <select
                className="input"
                value={draftFilters.source}
                onChange={(event) => updateDraft("source", event.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Estado</span>
              <select
                className="input"
                value={draftFilters.leadStatus}
                onChange={(event) =>
                  updateDraft("leadStatus", event.target.value)
                }
              >
                <option value="">Todos</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
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
                <option value="createdAt">Alta</option>
                <option value="updatedAt">Actualizacion</option>
                <option value="source">Origen</option>
                <option value="leadStatus">Estado</option>
                <option value="name">Nombre</option>
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

        {loading ? <AppLoader variant="card" label="Cargando Leads" /> : null}

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
          items.length ? (
            <div className="table-shell admin-table-shell">
              <table className="data-table admin-leads-table">
                <thead>
                  <tr>
                    <SortableTh
                      sortKey="name"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Nombre
                    </SortableTh>
                    <th>Contacto</th>
                    <SortableTh
                      sortKey="source"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Origen
                    </SortableTh>
                    <SortableTh
                      sortKey="leadStatus"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Estado
                    </SortableTh>
                    <SortableTh
                      sortKey="createdAt"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Alta
                    </SortableTh>
                    <th>Alertas</th>
                    <th>Guardados</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <div className="cell-stack">
                          <strong>
                            {lead.firstName} {lead.lastName}
                          </strong>
                          <span className="muted-copy">#{lead.id}</span>
                        </div>
                      </td>
                      <td>{renderContact(lead)}</td>
                      <td>{formatSource(lead.source)}</td>
                      <td>
                        <StatusBadge
                          status={lead.leadStatus}
                          labels={LEAD_STATUS_LABELS}
                        />
                      </td>
                      <td>{formatDate(lead.createdAt)}</td>
                      <td>{lead.activeAlertsCount || 0}</td>
                      <td>{lead.wishlistItemsCount || 0}</td>
                      <td>
                        <div className="table-actions">
                          <Link
                            to={`/admin/leads/${lead.id}`}
                            className="icon-action-button"
                            aria-label={`Ver detalle de ${lead.firstName} ${lead.lastName}`}
                            title="Ver detalle"
                          >
                            <EyeIcon />
                          </Link>
                          {lead.leadStatus !== "ARCHIVED" ? (
                            <button
                              type="button"
                              className="button button-secondary button-compact admin-icon-action"
                              aria-label={`Eliminar ${lead.firstName} ${lead.lastName}`}
                              title="Eliminar"
                              onClick={() => void handleArchiveLead(lead)}
                            >
                              <ArchiveIcon />
                              {/* <span className="admin-action-label">
                                Eliminar
                              </span> */}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="centered-card nested-card">
              <p className="muted-copy">
                No hay leads para los filtros seleccionados.
              </p>
            </div>
          )
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
