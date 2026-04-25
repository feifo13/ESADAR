import { NavLink } from 'react-router-dom';

export default function AdminToolbar() {
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
      <NavLink to="/admin/audit" className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')}>
        Auditoria
      </NavLink>
    </div>
  );
}
