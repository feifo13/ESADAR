import { NavLink } from 'react-router-dom';

export default function AdminToolbar() {
  return (
    <div className="admin-toolbar">
      <NavLink to="/admin/articles" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')} end>
        Artículos
      </NavLink>
      <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Órdenes
      </NavLink>
      <NavLink to="/admin/offers" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Ofertas
      </NavLink>
      <NavLink to="/admin/contact-messages" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Contactos
      </NavLink>
      <NavLink to="/admin/audit" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Auditoría
      </NavLink>
    </div>
  );
}
