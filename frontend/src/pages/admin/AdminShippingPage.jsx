import { useEffect, useMemo, useState } from "react";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import {
  BanIcon,
  CheckIcon,
  EditIcon,
  XIcon,
} from "../../components/ActionIcons.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";
import AppLoader from "../../components/AppLoader.jsx";

const SHIPPING_STATUS_LABELS = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

const initialFilters = {
  q: "",
  isActive: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

const emptyForm = {
  id: null,
  description: "",
  baseCost: "0",
  instructions: "",
  isActive: true,
};

function toForm(method = {}) {
  return {
    id: method.id || null,
    description: method.description || "",
    baseCost: String(method.baseCost ?? 0),
    instructions: method.instructions || "",
    isActive: Boolean(method.isActive ?? true),
  };
}

export default function AdminShippingPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [methods, setMethods] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionMethodId, setActionMethodId] = useState(null);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const query = useMemo(() => buildQueryString(filters), [filters]);
  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(pagination.total || 0) / Number(pagination.pageSize || 25),
    ),
  );
  const activeFiltersCount =
    [filters.q, filters.isActive].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadMethods() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/shipping?${query}`);
        if (ignore) return;
        setMethods(response.items || []);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) {
          const message =
            err.message || "No se pudieron cargar los métodos de envío.";
          setError(message);
          notifyError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMethods();
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.description.trim()) {
      notifyError("Ingresa una descripción para el método de envío.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload = {
        description: form.description,
        baseCost: Number(form.baseCost || 0),
        instructions: form.instructions,
        isActive: form.isActive,
      };
      const path = form.id
        ? `/api/admin/shipping/${form.id}`
        : "/api/admin/shipping";
      const method = form.id ? "PUT" : "POST";
      await apiFetch(path, { method, body: payload });
      notifySuccess(
        form.id ? "Metodo de envio actualizado." : "Metodo de envio creado.",
      );
      setForm(emptyForm);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const message = err.message || "No se pudo guardar el método de envío.";
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(method, isActive) {
    const actionLabel = isActive ? "activar" : "desactivar";
    const confirmed = window.confirm(
      `¿Seguro que quieres ${actionLabel} ${method.description}?`,
    );
    if (!confirmed) return;

    try {
      setActionMethodId(method.id);
      setError("");
      await apiFetch(`/api/admin/shipping/${method.id}/status`, {
        method: "PATCH",
        body: { isActive },
      });
      notifySuccess(
        isActive ? "Metodo de envio activado." : "Metodo de envio desactivado.",
      );
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const message =
        err.message || "No se pudo actualizar el método de envío.";
      setError(message);
      notifyError(message);
    } finally {
      setActionMethodId(null);
    }
  }

  async function handleDelete(method) {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar ${method.description}? Si ya tiene órdenes vinculadas, deberás desactivarlo.`,
    );
    if (!confirmed) return;

    try {
      setActionMethodId(method.id);
      setError("");
      await apiFetch(`/api/admin/shipping/${method.id}`, { method: "DELETE" });
      notifySuccess("Metodo de envio eliminado.");
      if (form.id === method.id) setForm(emptyForm);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const message = err.message || "No se pudo eliminar el método de envío.";
      setError(message);
      notifyError(message);
    } finally {
      setActionMethodId(null);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Metodos de envio</h1>
          </div>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}

        <form className="section-card page-stack-sm" onSubmit={handleSubmit}>
          <div className="section-heading section-heading-wrap">
            <div>
              <p className="section-kicker">{form.id ? "Editar" : "Nuevo"}</p>
              <h2>{form.id ? "Editar método" : "Crear método"}</h2>
            </div>
            {form.id ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setForm(emptyForm)}
              >
                Cancelar edicion
              </button>
            ) : null}
          </div>

          <div className="form-grid-two">
            <label className="field-group">
                  <span>Descripción</span>
              <input
                className="input"
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                required
              />
            </label>
            <label className="field-group">
              <span>Costo base</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.baseCost}
                onChange={(event) => updateForm("baseCost", event.target.value)}
                required
              />
            </label>
            <label className="field-group field-group-span-2">
              <span>Instrucciones</span>
              <textarea
                className="input textarea"
                rows="3"
                value={form.instructions}
                onChange={(event) =>
                  updateForm("instructions", event.target.value)
                }
              />
            </label>
            <label className="preference-check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  updateForm("isActive", event.target.checked)
                }
              />
              <span>Activo</span>
            </label>
          </div>

          <div className="inline-action-group">
            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
            >
              {saving
                ? "Guardando..."
                : form.id
                  ? "Guardar cambios"
                  : "Crear método"}
            </button>
          </div>
        </form>

        <ResponsiveFilterPanel
          title="Filtros de envio"
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
                placeholder="Descripción o instrucciones"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
              />
            </label>
            <label className="field-group">
              <span>Estado</span>
              <select
                className="input"
                value={draftFilters.isActive}
                onChange={(event) =>
                  updateDraft("isActive", event.target.value)
                }
              >
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </label>
            <label className="field-group">
              <span>Orden</span>
              <select
                className="input"
                value={draftFilters.sortBy}
                onChange={(event) => updateDraft("sortBy", event.target.value)}
              >
                <option value="createdAt">Fecha de alta</option>
                <option value="updatedAt">Última actualización</option>
                <option value="description">Descripción</option>
                <option value="baseCost">Costo</option>
                <option value="status">Estado</option>
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

        {loading ? <AppLoader variant="card" label="Cargando Shipping" /> : null}

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
          <div className="table-shell admin-table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh
                    sortKey="description"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Metodo
                  </SortableTh>
                  <SortableTh
                    sortKey="baseCost"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Costo
                  </SortableTh>
                  <SortableTh
                    sortKey="status"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Estado
                  </SortableTh>
                  <th>Uso</th>
                  <SortableTh
                    sortKey="updatedAt"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Actualizado
                  </SortableTh>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => {
                  const isBusy = actionMethodId === method.id;
                  return (
                    <tr key={method.id}>
                      <td data-label="Metodo">
                        <div className="cell-stack">
                          <strong>{method.description}</strong>
                          {method.instructions ? (
                            <span className="muted-copy">
                              {method.instructions}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Costo">
                        {formatCurrency(method.baseCost)}
                      </td>
                      <td data-label="Estado">
                        <StatusBadge
                          status={method.isActive ? "ACTIVE" : "INACTIVE"}
                          labels={SHIPPING_STATUS_LABELS}
                        />
                      </td>
                      <td data-label="Uso">
                        <span className="muted-copy">
                          Órdenes: {method.orderCount}
                        </span>
                      </td>
                      <td data-label="Actualizado">
                        {formatDate(method.updatedAt || method.createdAt)}
                      </td>
                      <td data-label="Acciones">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="ghost-button admin-icon-action"
                            onClick={() => setForm(toForm(method))}
                            aria-label={`Editar ${method.description}`}
                            title="Editar"
                          >
                            <EditIcon />
                            <span className="admin-action-label">Editar</span>
                          </button>
                          {method.isActive ? (
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() => handleStatusChange(method, false)}
                              disabled={isBusy}
                              aria-label={`Desactivar ${method.description}`}
                              title="Desactivar"
                            >
                              <BanIcon />
                              {/* <span className="admin-action-label">Desactivar</span> */}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() => handleStatusChange(method, true)}
                              disabled={isBusy}
                              aria-label={`Activar ${method.description}`}
                              title="Activar"
                            >
                              <CheckIcon />
                              <span className="admin-action-label">
                                Activar
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="ghost-button admin-icon-action"
                            onClick={() => handleDelete(method)}
                            disabled={isBusy}
                            aria-label={`Eliminar ${method.description}`}
                            title="Eliminar"
                          >
                            <XIcon />
                            {/* <span className="admin-action-label">Eliminar</span> */}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!methods.length ? (
                  <tr>
                    <td colSpan="6">
                      <p className="muted-copy">
                        No hay métodos de envío para mostrar.
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
