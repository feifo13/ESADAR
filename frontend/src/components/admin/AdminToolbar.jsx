import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function AdminToolbar() {
  const { user } = useAuth();
  const canManageUsers = user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));

  return (
    <div className="admin-toolbar">
      <NavLink to="/admin/articles" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')} end>
        Articulos
      </NavLink>
      <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Ordenes
      </NavLink>
      <NavLink to="/admin/offers" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Ofertas
      </NavLink>
      <NavLink to="/admin/contact-messages" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Contactos
      </NavLink>
      <NavLink to="/admin/leads" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Leads
      </NavLink>
      <NavLink to="/admin/wishlists" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Wishlists
      </NavLink>
      {canManageUsers ? (
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
          Usuarios
        </NavLink>
      ) : null}
      {canManageUsers ? (
        <NavLink to="/admin/collecting" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
          Cobros
        </NavLink>
      ) : null}
      <NavLink to="/admin/shipping" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Envios
      </NavLink>
      <NavLink to="/admin/statistics" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Estadisticas
      </NavLink>
      <NavLink to="/admin/audit" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Auditoria
      </NavLink>
    </div>
  );
}
