import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { apiFetch } from '../../lib/api.js';
import AppLoader from '../../components/AppLoader.jsx';

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'OPERATOR', label: 'Operador' },
  { value: 'CUSTOMER', label: 'Cliente' },
];

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  instagram: '',
  address: '',
  isActive: true,
  roles: ['CUSTOMER'],
};

function getDisplayName(user) {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || `Usuario #${user?.id || ''}`;
}

export default function AdminUserEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const [form, setForm] = useState(emptyForm);
  const [loadedUser, setLoadedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');

  const isEditingSelf = Number(currentUser?.id) === Number(id);
  const canChangePasswords = currentUser?.roles?.includes('SUPER_ADMIN');
  const selectedRoles = useMemo(() => new Set(form.roles || []), [form.roles]);

  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch(`/api/admin/users/${id}`);
        if (ignore) return;
        const user = response.user || {};
        setLoadedUser(user);
        setForm({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phone: user.phone || '',
          instagram: user.instagram || '',
          address: user.address || '',
          isActive: Boolean(user.isActive),
          roles: user.roles?.length ? user.roles : ['CUSTOMER'],
        });
      } catch (err) {
        if (!ignore) {
          const message = err.message || 'No se pudo cargar el usuario.';
          setError(message);
          notifyError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadUser();
    return () => {
      ignore = true;
    };
  }, [id]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleRole(role) {
    setForm((current) => {
      const roles = new Set(current.roles || []);
      if (roles.has(role)) {
        roles.delete(role);
      } else {
        roles.add(role);
      }
      return { ...current, roles: Array.from(roles) };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.roles.length) {
      const message = 'El usuario debe tener al menos un rol.';
      setError(message);
      notifyError(message);
      return;
    }

    try {
      setSaving(true);
      setError('');
      await apiFetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: {
          ...form,
          email: form.email,
          phone: form.phone || null,
          instagram: form.instagram || null,
          address: form.address || null,
        },
      });
      notifySuccess('Usuario actualizado correctamente.');
      navigate('/admin/users');
    } catch (err) {
      const message = err.message || 'No se pudo guardar el usuario.';
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }


  async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      const message = 'La nueva contraseña debe tener al menos 8 caracteres.';
      setError(message);
      notifyError(message);
      return;
    }

    try {
      setPasswordSaving(true);
      setError('');
      await apiFetch(`/api/admin/users/${id}/password`, {
        method: 'PATCH',
        body: { password: newPassword },
      });
      setNewPassword('');
      setShowNewPassword(false);
      notifySuccess('Contraseña actualizada correctamente.');
    } catch (err) {
      const message = err.message || 'No se pudo actualizar la contraseña.';
      setError(message);
      notifyError(message);
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container page-stack admin-page-shell">
        <AdminToolbar />
        <AppLoader variant="card" label="Cargando usuario" />
      </div>
    );
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>Editar usuario</h1>
            {loadedUser ? <p className="muted-copy">{getDisplayName(loadedUser)} · #{loadedUser.id}</p> : null}
          </div>
          <Link to="/admin/users" className="button button-secondary">Volver</Link>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}

        <form className="page-stack" onSubmit={handleSubmit}>
          <div className="admin-filter-grid">
            <label className="field-group">
              <span>Nombre</span>
              <input className="input" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} required />
            </label>
            <label className="field-group">
              <span>Apellido</span>
              <input className="input" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} required />
            </label>
            <label className="field-group">
              <span>Email</span>
              <input className="input" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
            </label>
            <label className="field-group">
              <span>Teléfono</span>
              <input className="input" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </label>
            <label className="field-group">
              <span>Instagram</span>
              <input className="input" value={form.instagram} onChange={(event) => updateField('instagram', event.target.value)} />
            </label>
            <label className="field-group">
              <span>Dirección</span>
              <input className="input" value={form.address} onChange={(event) => updateField('address', event.target.value)} />
            </label>
            <label className="field-group">
              <span>Estado</span>
              <select className="input" value={form.isActive ? 'true' : 'false'} onChange={(event) => updateField('isActive', event.target.value === 'true')} disabled={isEditingSelf}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
              {isEditingSelf ? <span className="field-helper">No podés desactivar tu propio usuario.</span> : null}
            </label>
          </div>

          <div className="nested-card page-stack-sm">
            <h2>Roles</h2>
            <div className="toolbar-inline">
              {ROLE_OPTIONS.map((role) => (
                <label key={role.value} className="checkbox-field checkbox-field-compact">
                  <input type="checkbox" checked={selectedRoles.has(role.value)} onChange={() => toggleRole(role.value)} />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
          </div>


          {canChangePasswords ? (
            <div className="nested-card page-stack-sm">
              <div>
                <h2>Contraseña</h2>
                <p className="muted-copy">Solo SUPER_ADMIN puede definir una nueva contraseña. La contraseña actual no se muestra porque se guarda hasheada.</p>
              </div>
              <div className="admin-filter-grid">
                <label className="field-group">
                  <span>Nueva contraseña</span>
                  <input
                    className="input"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
                <div className="field-group field-group-actions">
                  <span>Visibilidad</span>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setShowNewPassword((current) => !current)}
                  >
                    {showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  </button>
                </div>
              </div>
              <div className="toolbar-inline">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handlePasswordSubmit}
                  disabled={passwordSaving || !newPassword}
                >
                  {passwordSaving ? 'Actualizando...' : 'Modificar contraseña'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="toolbar-inline">
            <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
            <Link to="/admin/users" className="button button-secondary">Cancelar</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
