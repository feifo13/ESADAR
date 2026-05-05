import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import SurfaceModal from "../../components/SurfaceModal.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import { EyeIcon } from "../../components/ActionIcons.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { articlePath } from "../../lib/routes.js";
import { buildQueryString } from "../../lib/query.js";
import { useMobileMenu } from "../../contexts/MobileMenuContext.jsx";
import { notifyFormStatus } from "../../lib/validation.js";

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

const ALERT_STATUS_LABELS = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  CONVERTED: "Convertida",
  CANCELLED: "Cancelada",
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

function formatPreferences(preferences = {}) {
  const groups = [
    ...(preferences.preferredCategories || []),
    ...(preferences.preferredBrands || []),
    ...(preferences.preferredSizes || []),
    ...(preferences.preferredColors || []),
  ].filter(Boolean);

  return groups;
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
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusForm, setStatusForm] = useState({
    leadStatus: "NEW",
    adminNotes: "",
  });
  const [savingStatus, setSavingStatus] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

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
          notifyMobileStatus({ type: "error", icon: "error", message: errorMessage });
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

  useEffect(() => {
    let ignore = false;

    async function loadLeadDetail() {
      if (!selectedLeadId) {
        setSelectedLead(null);
        setDetailError("");
        return;
      }

      try {
        setDetailLoading(true);
        setDetailError("");
        const response = await apiFetch(`/api/admin/leads/${selectedLeadId}`);
        if (ignore) return;
        setSelectedLead(response.lead);
        setStatusForm({
          leadStatus: response.lead.leadStatus || "NEW",
          adminNotes: response.lead.adminNotes || "",
        });
      } catch (err) {
        if (!ignore)
          setDetailError(
            err.message || "No se pudo cargar el detalle del lead",
          );
      } finally {
        if (!ignore) setDetailLoading(false);
      }
    }

    loadLeadDetail();
    return () => {
      ignore = true;
    };
  }, [selectedLeadId]);

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

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (!selectedLeadId) return;

    try {
      setSavingStatus(true);
      setDetailError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/leads/${selectedLeadId}/status`,
        {
          method: "PATCH",
          body: statusForm,
        },
      );

      setSelectedLead(response.lead);
      setStatusForm({
        leadStatus: response.lead.leadStatus || "NEW",
        adminNotes: response.lead.adminNotes || "",
      });
      setItems((current) =>
        current.map((item) =>
          Number(item.id) === Number(response.lead.id)
            ? {
                ...item,
                leadStatus: response.lead.leadStatus,
                adminNotes: response.lead.adminNotes,
                updatedAt: response.lead.updatedAt,
              }
            : item,
        ),
      );
      const successMessage = "El lead fue actualizado correctamente.";
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
    } catch (err) {
      const errorMessage = err.message || "No se pudo actualizar el lead";
      setDetailError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setSavingStatus(false);
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

        {message ? <p className="success-copy">{message}</p> : null}
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
          items.length ? (
            <div className="table-shell admin-table-shell">
              <table className="data-table admin-leads-table">
                <thead>
                  <tr>
                    <SortableTh sortKey="name" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Nombre</SortableTh>
                    <th>Contacto</th>
                    <SortableTh sortKey="source" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Origen</SortableTh>
                    <SortableTh sortKey="leadStatus" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Estado</SortableTh>
                    <SortableTh sortKey="createdAt" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Alta</SortableTh>
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
                          <strong>{lead.firstName} {lead.lastName}</strong>
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
                            className="button button-secondary button-compact admin-icon-action"
                            aria-label={`Ver detalle de ${lead.firstName} ${lead.lastName}`}
                            title="Ver detalle"
                          >
                            <EyeIcon />
                            <span className="admin-action-label">Ver detalle</span>
                          </Link>
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

        <SurfaceModal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="Detalle del lead"
          description="Datos de contacto, preferencias, alertas y seguimiento interno."
          wide
        >
          {!selectedLeadId ? (
            <p className="muted-copy">Selecciona un lead para ver detalles.</p>
          ) : detailLoading ? (
            <div className="centered-card">
              <p className="muted-copy">Cargando detalle...</p>
            </div>
          ) : detailError ? (
            <div className="centered-card">
              <p className="error-copy">{detailError}</p>
            </div>
          ) : selectedLead ? (
            <div className="page-stack">
              <div className="section-heading section-heading-wrap">
                <div>
                  <p className="section-kicker">Lead</p>
                  <h2>{selectedLead.firstName} {selectedLead.lastName}</h2>
                </div>
                <StatusBadge
                  status={selectedLead.leadStatus}
                  labels={LEAD_STATUS_LABELS}
                />
              </div>

              <div className="admin-detail-meta admin-detail-meta--grid">
                <p className="summary-line"><span>Origen</span><strong>{formatSource(selectedLead.source)}</strong></p>
                <p className="summary-line"><span>Email</span><strong>{selectedLead.email || "Sin email"}</strong></p>
                <p className="summary-line"><span>WhatsApp</span><strong>{selectedLead.phone || "Sin telefono"}</strong></p>
                <p className="summary-line"><span>Instagram</span><strong>{selectedLead.instagram || "Sin Instagram"}</strong></p>
                <p className="summary-line"><span>Alta</span><strong>{formatDate(selectedLead.createdAt)}</strong></p>
                <p className="summary-line"><span>Actualizacion</span><strong>{formatDate(selectedLead.updatedAt)}</strong></p>
              </div>

              <div className="page-stack stack-gap-sm">
                <div>
                  <p className="section-kicker">Preferencias</p>
                  <div className="preference-chip-list">
                    {formatPreferences(selectedLead.preferences).length ? (
                      formatPreferences(selectedLead.preferences).map((item) => (
                        <span key={`${selectedLead.id}-${item}`} className="preference-chip">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="muted-copy">Sin preferencias guardadas.</span>
                    )}
                  </div>
                  {selectedLead.preferences?.notes ? (
                    <p className="muted-copy admin-detail-note">{selectedLead.preferences.notes}</p>
                  ) : null}
                </div>

                <div>
                  <p className="section-kicker">Alertas</p>
                  <div className="alert-list">
                    {(selectedLead.alerts || []).length ? (
                      selectedLead.alerts.map((alert) => (
                        <div key={alert.id} className="history-row">
                          <div className="table-actions table-actions-spread">
                            <strong>{alert.alertType}</strong>
                            <StatusBadge status={alert.status} labels={ALERT_STATUS_LABELS} />
                          </div>
                          <span>{alert.articleTitle || "Sin articulo asociado"}</span>
                          {alert.articleSlug ? (
                            <Link
                              to={articlePath({ slug: alert.articleSlug, articleId: alert.articleId })}
                              className="muted-copy"
                            >
                              Ver articulo publico
                            </Link>
                          ) : null}
                          <span>{formatDate(alert.createdAt)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="muted-copy">Sin alertas asociadas.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="section-kicker">Wishlists</p>
                  <div className="wishlist-summary">
                    {(selectedLead.wishlists || []).length ? (
                      selectedLead.wishlists.map((wishlist) => (
                        <div key={wishlist.id} className="history-row">
                          <strong>Wishlist #{wishlist.id}</strong>
                          <span>{wishlist.itemCount} prendas guardadas</span>
                          <span>{wishlist.sessionToken || "Sin session token"}</span>
                        </div>
                      ))
                    ) : (
                      <p className="muted-copy">Sin listas guardadas.</p>
                    )}
                  </div>
                </div>
              </div>

              <form className="page-stack" onSubmit={handleStatusSubmit} noValidate>
                <p className="section-kicker">Seguimiento interno</p>

                <label className="field-group">
                  <span>Estado</span>
                  <select
                    className="input"
                    value={statusForm.leadStatus}
                    onChange={(event) =>
                      setStatusForm((current) => ({ ...current, leadStatus: event.target.value }))
                    }
                  >
                    {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span>Notas administrativas</span>
                  <textarea
                    className="input textarea"
                    value={statusForm.adminNotes}
                    onChange={(event) =>
                      setStatusForm((current) => ({ ...current, adminNotes: event.target.value }))
                    }
                    placeholder="Observaciones, proximo paso o contexto comercial."
                  />
                </label>

                <button type="submit" className="button button-primary" disabled={savingStatus}>
                  {savingStatus ? "Guardando..." : "Guardar seguimiento"}
                </button>
              </form>
            </div>
          ) : null}
        </SurfaceModal>

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
