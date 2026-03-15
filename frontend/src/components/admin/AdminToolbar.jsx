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
    </div>
  );
}
