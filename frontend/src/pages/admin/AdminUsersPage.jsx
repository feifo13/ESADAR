import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { BanIcon, CheckIcon, EditIcon, XIcon } from "../../components/ActionIcons.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";
import AppLoader from "../../components/AppLoader.jsx";

const USER_STATUS_LABELS = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

const initialFilters = {
  q: "",
  isActive: "",
  role: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

function getUserDisplayName(user) {
  return (
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Sin nombre"
  );
}

function getRoleLabel(role) {
  const labels = {
    SUPER_ADMIN: "Super admin",
    ADMIN: "Admin",
    OPERATOR: "Operador",
    CUSTOMER: "Cliente",
  };
  return labels[role] || role;
}

export default function AdminUsersPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [actionUserId, setActionUserId] = useState(null);

  const query = useMemo(() => buildQueryString(filters), [filters]);
  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(pagination.total || 0) / Number(pagination.pageSize || 25),
    ),
  );
  const activeFiltersCount =
    [filters.q, filters.isActive, filters.role].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadUsers() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/users?${query}`);
        if (ignore) return;
        setUsers(response.items || []);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) {
          const errorMessage =
            err.message || "No se pudieron cargar los usuarios.";
          setError(errorMessage);
          notifyError(errorMessage);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadUsers();
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
    const sortDir =
      filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setDraftFilters((current) => ({ ...current, sortBy, sortDir }));
    setFilters((current) => ({ ...current, sortBy, sortDir, page: 1 }));
  }

  async function handleStatusChange(user, isActive) {
    const actionLabel = isActive ? "activar" : "desactivar";
    const confirmed = window.confirm(
      `¿Seguro que quieres ${actionLabel} a ${getUserDisplayName(user)}?`,
    );
    if (!confirmed) return;

    try {
      setActionUserId(user.id);
      setError("");
      await apiFetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: { isActive },
      });
      notifySuccess(
        isActive
          ? "Usuario activado correctamente."
          : "Usuario desactivado correctamente.",
      );
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo actualizar el usuario.";
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setActionUserId(null);
    }
  }

  async function handleDelete(user) {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar a ${getUserDisplayName(user)}? Esta accion no se puede deshacer.`,
    );
    if (!confirmed) return;

    try {
      setActionUserId(user.id);
      setError("");
      await apiFetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      notifySuccess("Usuario eliminado correctamente.");
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo eliminar el usuario.";
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Usuarios</h1>
          </div>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}

        <ResponsiveFilterPanel
          title="Filtros de usuarios"
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
                placeholder="Nombre, email, telefono, rol"
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
              <span>Rol</span>
              <select
                className="input"
                value={draftFilters.role}
                onChange={(event) => updateDraft("role", event.target.value)}
              >
                <option value="">Todos</option>
                <option value="SUPER_ADMIN">Super admin</option>
                <option value="ADMIN">Admin</option>
                <option value="OPERATOR">Operador</option>
                <option value="CUSTOMER">Cliente</option>
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
                <option value="updatedAt">Ultima actualizacion</option>
                <option value="lastLoginAt">Ultimo ingreso</option>
                <option value="name">Nombre</option>
                <option value="email">Email</option>
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
              <span>Tamano de pagina</span>
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

        {loading ? <AppLoader variant="card" label="Cargando usuarios" /> : null}

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
                    sortKey="name"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Usuario
                  </SortableTh>
                  <SortableTh
                    sortKey="email"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Contacto
                  </SortableTh>
                  <th>Roles</th>
                  <SortableTh
                    sortKey="status"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Estado
                  </SortableTh>
                  <th>Actividad</th>
                  <SortableTh
                    sortKey="createdAt"
                    sort={{ key: filters.sortBy, direction: filters.sortDir }}
                    onSort={changeSort}
                  >
                    Alta
                  </SortableTh>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isBusy = actionUserId === user.id;
                  return (
                    <tr key={user.id}>
                      <td data-label="Usuario">
                        <div className="cell-stack">
                          <strong>{getUserDisplayName(user)}</strong>
                          <span className="muted-copy">#{user.id}</span>
                        </div>
                      </td>
                      <td data-label="Contacto">
                        <div className="cell-stack">
                          <span>{user.email || "Sin email"}</span>
                          <span className="muted-copy">
                            {user.phone || "Sin teléfono"}
                          </span>
                          {user.instagram ? (
                            <span className="muted-copy">{user.instagram}</span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Roles">
                        <div className="cell-stack cell-stack--compact">
                          {user.roles?.length ? (
                            user.roles.map((role) => (
                              <span key={role} className="pill">
                                {getRoleLabel(role)}
                              </span>
                            ))
                          ) : (
                            <span className="muted-copy">Sin rol</span>
                          )}
                        </div>
                      </td>
                      <td data-label="Estado">
                        <StatusBadge
                          status={user.isActive ? "ACTIVE" : "INACTIVE"}
                          labels={USER_STATUS_LABELS}
                        />
                      </td>
                      <td data-label="Actividad">
                        <div className="cell-stack">
                          <span className="muted-copy">
                            Ordenes: {user.orderCount}
                          </span>
                          <span className="muted-copy">
                            Ofertas: {user.offerCount}
                          </span>
                          <span className="muted-copy">
                            Ultimo ingreso:{" "}
                            {user.lastLoginAt
                              ? formatDate(user.lastLoginAt)
                              : "Sin ingresos"}
                          </span>
                        </div>
                      </td>
                      <td data-label="Alta">{formatDate(user.createdAt)}</td>
                      <td data-label="Acciones">
                        <div className="table-actions">
                          <Link
                            to={`/admin/users/${user.id}/edit`}
                            className="ghost-button admin-icon-action"
                            aria-label={`Editar usuario ${getUserDisplayName(user)}`}
                            title="Editar"
                          >
                            <EditIcon />
                          </Link>

                          {user.isActive ? (
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() => handleStatusChange(user, false)}
                              disabled={isBusy}
                              aria-label={`Desactivar usuario ${getUserDisplayName(user)}`}
                              title="Desactivar"
                            >
                              <BanIcon />
                              {/* <span className="admin-action-label">Desactivar</span> */}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() => handleStatusChange(user, true)}
                              disabled={isBusy}
                              aria-label={`Activar usuario ${getUserDisplayName(user)}`}
                              title="Activar"
                            >
                              <CheckIcon />
                              {/* <span className="admin-action-label">
                                Activar
                              </span> */}
                            </button>
                          )}

                          <button
                            type="button"
                            className="ghost-button admin-icon-action"
                            onClick={() => handleDelete(user)}
                            disabled={isBusy}
                            aria-label={`Eliminar usuario ${getUserDisplayName(user)}`}
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

                {!users.length ? (
                  <tr>
                    <td colSpan="7">
                      <p className="muted-copy">
                        No hay usuarios para mostrar.
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
