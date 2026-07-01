import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { buildQueryString } from "../../lib/query.js";

const LOT_STATUS_LABELS = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

const emptyForm = {
  id: null,
  code: "",
  name: "",
  description: "",
  sourceLabel: "",
  acquisitionDate: "",
  arrivalDate: "",
  status: "OPEN",
  notes: "",
};

const initialFilters = {
  q: "",
  status: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

function toForm(lot = null) {
  return lot
    ? {
        id: lot.id,
        code: lot.code || "",
        name: lot.name || "",
        description: lot.description || "",
        sourceLabel: lot.sourceLabel || "",
        acquisitionDate: lot.acquisitionDate || "",
        arrivalDate: lot.arrivalDate || "",
        status: lot.status || "OPEN",
        notes: lot.notes || "",
      }
    : emptyForm;
}

export default function AdminArticleLotsPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const query = useMemo(() => buildQueryString(filters), [filters]);
  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 25)));

  useEffect(() => {
    let ignore = false;

    async function loadLots() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/article-lots?${query}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
      } catch (err) {
        if (!ignore) {
          const message = err.message || "No se pudieron cargar los lotes.";
          setError(message);
          notifyError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadLots();
    return () => {
      ignore = true;
    };
  }, [query, refreshNonce]);

  function updateDraft(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    setFilters((current) => ({ ...current, ...draftFilters, page: 1 }));
  }

  function clearFilters() {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
  }

  async function submitLot(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        sourceLabel: form.sourceLabel || null,
        acquisitionDate: form.acquisitionDate || null,
        arrivalDate: form.arrivalDate || null,
        status: form.status,
        notes: form.notes || null,
      };
      const path = form.id ? `/api/admin/article-lots/${form.id}` : "/api/admin/article-lots";
      await apiFetch(path, {
        method: form.id ? "PATCH" : "POST",
        body: payload,
      });
      notifySuccess(form.id ? "Lote actualizado." : "Lote creado.");
      setForm(emptyForm);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const message = err.message || "No se pudo guardar el lote.";
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(lot, status) {
    const confirmed = window.confirm(`Cambiar ${lot.code} a estado ${LOT_STATUS_LABELS[status] || status}?`);
    if (!confirmed) return;
    try {
      await apiFetch(`/api/admin/article-lots/${lot.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      notifySuccess("Estado de lote actualizado.");
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      notifyError(err.message || "No se pudo actualizar el estado.");
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Lotes de articulos</h1>
            <p className="muted-copy">Agrupa articulos por lote para reportes, balances y exportaciones.</p>
          </div>
          <Link to="/admin/articles" className="button button-secondary">
            Ver articulos
          </Link>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}

        <ResponsiveFilterPanel title="Filtros">
          <label className="field-group">
            <span>Buscar</span>
            <input className="input" value={draftFilters.q} onChange={(event) => updateDraft("q", event.target.value)} />
          </label>
          <label className="field-group">
            <span>Estado</span>
            <select className="input" value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value)}>
              <option value="">Todos</option>
              <option value="OPEN">Abierto</option>
              <option value="CLOSED">Cerrado</option>
              <option value="ARCHIVED">Archivado</option>
            </select>
          </label>
          <div className="inline-action-group">
            <button type="button" className="button button-secondary" onClick={clearFilters}>
              Limpiar
            </button>
            <button type="button" className="button button-primary" onClick={applyFilters}>
              Aplicar
            </button>
          </div>
        </ResponsiveFilterPanel>
      </section>

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">{form.id ? "Editar" : "Nuevo"}</p>
            <h2>{form.id ? `Editar ${form.code}` : "Crear lote"}</h2>
          </div>
          {form.id ? (
            <button type="button" className="button button-secondary" onClick={() => setForm(emptyForm)}>
              Cancelar
            </button>
          ) : null}
        </div>

        <form className="form-grid-two" onSubmit={submitLot}>
          <label className="field-group">
            <span>Codigo</span>
            <input className="input" value={form.code} onChange={(event) => updateForm("code", event.target.value.toUpperCase())} required />
          </label>
          <label className="field-group">
            <span>Nombre</span>
            <input className="input" value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
          </label>
          <label className="field-group">
            <span>Estado</span>
            <select className="input" value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
              <option value="OPEN">Abierto</option>
              <option value="CLOSED">Cerrado</option>
              <option value="ARCHIVED">Archivado</option>
            </select>
          </label>
          <label className="field-group">
            <span>Origen</span>
            <input className="input" value={form.sourceLabel} onChange={(event) => updateForm("sourceLabel", event.target.value)} />
          </label>
          <label className="field-group">
            <span>Fecha compra</span>
            <input className="input" type="date" value={form.acquisitionDate} onChange={(event) => updateForm("acquisitionDate", event.target.value)} />
          </label>
          <label className="field-group">
            <span>Fecha llegada</span>
            <input className="input" type="date" value={form.arrivalDate} onChange={(event) => updateForm("arrivalDate", event.target.value)} />
          </label>
          <label className="field-group field-group-span-2">
            <span>Descripcion</span>
            <textarea className="input textarea" value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
          </label>
          <label className="field-group field-group-span-2">
            <span>Notas</span>
            <textarea className="input textarea" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
          </label>
          <div className="inline-action-group form-grid-span-two">
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear lote"}
            </button>
          </div>
        </form>
      </section>

      <section className="section-card page-stack">
        {loading ? <p className="muted-copy">Cargando lotes...</p> : null}
        {!loading ? (
          items.length ? (
            <div className="table-shell admin-table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Estado</th>
                    <th>Articulos</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((lot) => (
                    <tr key={lot.id}>
                      <td><strong>{lot.code}</strong></td>
                      <td>{lot.name}</td>
                      <td><StatusBadge status={lot.status} labels={LOT_STATUS_LABELS} /></td>
                      <td>{lot.articleCount}</td>
                      <td>{lot.stockAvailable} / {lot.stockTotal}</td>
                      <td>
                        <div className="table-actions">
                          <Link className="button button-secondary button-compact" to={`/admin/article-lots/${lot.id}`}>
                            Ver
                          </Link>
                          <button type="button" className="button button-secondary button-compact" onClick={() => setForm(toForm(lot))}>
                            Editar
                          </button>
                          {lot.status !== "ARCHIVED" ? (
                            <button type="button" className="button button-secondary button-compact" onClick={() => changeStatus(lot, "ARCHIVED")}>
                              Archivar
                            </button>
                          ) : (
                            <button type="button" className="button button-secondary button-compact" onClick={() => changeStatus(lot, "OPEN")}>
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-copy">No hay lotes para los filtros seleccionados.</p>
          )
        ) : null}
        <AdminPagination
          page={Number(filters.page || 1)}
          totalPages={totalPages}
          totalItems={Number(pagination.total || 0)}
          loading={loading}
          onPrevious={() => setFilters((current) => ({ ...current, page: Math.max(1, Number(current.page || 1) - 1) }))}
          onNext={() => setFilters((current) => ({ ...current, page: Math.min(totalPages, Number(current.page || 1) + 1) }))}
        />
      </section>
    </div>
  );
}
