import { useEffect, useMemo, useState } from 'react';
import AdminPagination from '../../components/admin/AdminPagination.jsx';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { buildQueryString } from '../../lib/query.js';

const CONTACT_STATUS_LABELS = {
  NEW: 'Nuevo',
  READ: 'Leido',
  REPLIED: 'Respondido',
  ARCHIVED: 'Archivado',
};

const initialFilters = {
  q: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function AdminContactMessagesPage() {
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const query = useMemo(() => buildQueryString(filters), [filters]);
  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 25)));

  useEffect(() => {
    let ignore = false;

    async function loadMessages() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch(`/api/admin/contact-messages?${query}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudieron cargar los mensajes');
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

  async function updateStatus(messageId, nextStatus) {
    try {
      setError('');
      setMessage('');
      await apiFetch(`/api/admin/contact-messages/${messageId}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      setMessage('El estado del mensaje fue actualizado.');
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el mensaje');
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
            <p className="muted-copy">Mensajes recibidos con filtros reales por texto, estado y fecha.</p>
          </div>
        </div>

        <div className="admin-filter-grid">
          <label className="field-group">
            <span>Buscar</span>
            <input
              className="input"
              placeholder="Nombre, email, telefono, mensaje"
              value={draftFilters.q}
              onChange={(event) => updateDraft('q', event.target.value)}
            />
          </label>

          <label className="field-group">
            <span>Estado</span>
            <select className="input" value={draftFilters.status} onChange={(event) => updateDraft('status', event.target.value)}>
              <option value="">Todos</option>
              <option value="NEW">Nuevos</option>
              <option value="READ">Leidos</option>
              <option value="REPLIED">Respondidos</option>
              <option value="ARCHIVED">Archivados</option>
            </select>
          </label>

          <label className="field-group">
            <span>Desde</span>
            <input className="input" type="date" value={draftFilters.dateFrom} onChange={(event) => updateDraft('dateFrom', event.target.value)} />
          </label>

          <label className="field-group">
            <span>Hasta</span>
            <input className="input" type="date" value={draftFilters.dateTo} onChange={(event) => updateDraft('dateTo', event.target.value)} />
          </label>

          <label className="field-group">
            <span>Orden</span>
            <select className="input" value={draftFilters.sortBy} onChange={(event) => updateDraft('sortBy', event.target.value)}>
              <option value="createdAt">Fecha</option>
              <option value="status">Estado</option>
              <option value="name">Nombre</option>
              <option value="email">Email</option>
            </select>
          </label>

          <label className="field-group">
            <span>Direccion</span>
            <select className="input" value={draftFilters.sortDir} onChange={(event) => updateDraft('sortDir', event.target.value)}>
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </label>

          <label className="field-group">
            <span>Page size</span>
            <select className="input" value={draftFilters.pageSize} onChange={(event) => changePageSize(event.target.value)}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>

        <div className="toolbar-inline">
          <button type="button" className="button button-primary" onClick={applyFilters}>Aplicar filtros</button>
          <button type="button" className="button button-secondary" onClick={clearFilters}>Limpiar</button>
        </div>

        {message ? <p className="success-copy">{message}</p> : null}
        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando...</div> : null}

        {!loading ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Mensaje</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="cell-stack">
                        <strong>{item.firstName} {item.lastName}</strong>
                        <span className="muted-copy">{item.birthDate ? String(item.birthDate).slice(0, 10) : 'Sin fecha de nacimiento'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{item.email || 'Sin email'}</span>
                        <span className="muted-copy">{item.phone || 'Sin telefono'}</span>
                        <span className="muted-copy">{item.instagram || 'Sin Instagram'}</span>
                      </div>
                    </td>
                    <td className="cell-copy">{item.message}</td>
                    <td><StatusBadge status={item.status} labels={CONTACT_STATUS_LABELS} /></td>
                    <td>
                      <div className="table-actions">
                        {item.status !== 'READ' ? <button type="button" className="ghost-button" onClick={() => updateStatus(item.id, 'READ')}>Leer</button> : null}
                        {item.status !== 'REPLIED' ? <button type="button" className="ghost-button" onClick={() => updateStatus(item.id, 'REPLIED')}>Responder</button> : null}
                        {item.status !== 'ARCHIVED' ? <button type="button" className="ghost-button" onClick={() => updateStatus(item.id, 'ARCHIVED')}>Archivar</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}

                {!items.length ? (
                  <tr>
                    <td colSpan="6">
                      <p className="muted-copy">No hay mensajes para mostrar.</p>
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
          onPrevious={() => changePage(Math.max(1, Number(filters.page || 1) - 1))}
          onNext={() => changePage(Math.min(totalPages, Number(filters.page || 1) + 1))}
        />
      </section>
    </div>
  );
}
