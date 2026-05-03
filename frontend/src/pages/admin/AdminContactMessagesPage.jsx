import { useEffect, useMemo, useState } from "react";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SurfaceModal from "../../components/SurfaceModal.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";

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
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

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
        if (!ignore)
          setError(err.message || "No se pudieron cargar los mensajes");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMessages();
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
    const sortDir = filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setDraftFilters((current) => ({ ...current, sortBy, sortDir }));
    setFilters((current) => ({ ...current, sortBy, sortDir, page: 1 }));
  }

  async function updateStatus(messageId, nextStatus) {
    try {
      setError("");
      setMessage("");
      await apiFetch(`/api/admin/contact-messages/${messageId}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      setMessage("El estado del mensaje fue actualizado.");
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el mensaje");
    }
  }

  async function openMessageModal(item) {
    setSelectedMessage(item);
    setReplyText("");
    setError("");
    setMessage("");

    if (item.status === "NEW") {
      await updateStatus(item.id, "READ");
      setSelectedMessage((current) =>
        current ? { ...current, status: "READ" } : current,
      );
    }
  }

  async function handleReplySubmit() {
    if (!selectedMessage) return;

    try {
      setReplyLoading(true);
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/contact-messages/${selectedMessage.id}/reply`,
        {
          method: "POST",
          body: { replyMessage: replyText },
        },
      );
      setSelectedMessage((current) =>
        current ? { ...current, ...response.message } : current,
      );
      setReplyText("");
      setMessage("La respuesta fue enviada correctamente.");
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setError(err.message || "No se pudo enviar la respuesta");
    } finally {
      setReplyLoading(false);
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
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh sortKey="createdAt" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Fecha</SortableTh>
                  <SortableTh sortKey="name" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Nombre</SortableTh>
                  <SortableTh sortKey="email" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Contacto</SortableTh>
                  <th>Mensaje</th>
                  <SortableTh sortKey="status" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Estado</SortableTh>
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
                        {item.status !== "READ" ? (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void openMessageModal(item)}
                          >
                            Leer
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void openMessageModal(item)}
                          >
                            Leer
                          </button>
                        )}
                        {item.status !== "ARCHIVED" ? (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => updateStatus(item.id, "ARCHIVED")}
                          >
                            Archivar
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

      <SurfaceModal
        open={Boolean(selectedMessage)}
        onClose={() => setSelectedMessage(null)}
        title={selectedMessage ? `${selectedMessage.firstName} ${selectedMessage.lastName}` : "Contacto"}
        description="Lectura y respuesta del mensaje recibido."
        wide
        actions={(
          <>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSelectedMessage(null)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleReplySubmit()}
              disabled={replyLoading || !replyText.trim() || !selectedMessage?.email}
            >
              {replyLoading ? "Enviando..." : "Enviar respuesta"}
            </button>
          </>
        )}
      >
        {selectedMessage ? (
          <div className="page-stack">
            <div className="admin-detail-meta">
              <p className="summary-line"><span>Email</span><strong>{selectedMessage.email || "Sin email"}</strong></p>
              <p className="summary-line"><span>Telefono</span><strong>{selectedMessage.phone || "Sin telefono"}</strong></p>
              <p className="summary-line"><span>Instagram</span><strong>{selectedMessage.instagram || "Sin Instagram"}</strong></p>
              <p className="summary-line"><span>Fecha</span><strong>{formatDate(selectedMessage.createdAt)}</strong></p>
            </div>

            <div className="section-card nested-card page-stack-sm">
              <p className="section-kicker">Mensaje</p>
              <p className="dialog-copy">{selectedMessage.message}</p>
            </div>

            <label className="field-group">
              <span>Respuesta</span>
              <textarea
                className="input textarea"
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder={
                  selectedMessage.email
                    ? "Escribe la respuesta para enviar por email."
                    : "Este contacto no tiene email para responder."
                }
              />
            </label>

            {!selectedMessage.email ? (
              <p className="muted-copy">
                Este mensaje no tiene email asociado, por eso no se puede responder desde la app.
              </p>
            ) : null}
          </div>
        ) : null}
      </SurfaceModal>
    </div>
  );
}
