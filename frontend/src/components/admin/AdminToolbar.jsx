import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const leftLinks = [
  { to: '/admin/article-lots', label: 'Lotes' },
  { to: '/admin/articles', label: 'Artículos', end: true },
  { to: '/admin/orders', label: 'Órdenes' },
  { to: '/admin/offers', label: 'Ofertas' },
  { to: '/admin/contact-messages', label: 'Contactos' },
  { to: '/admin/leads', label: 'Leads' },
  { to: '/admin/wishlists', label: 'Wishlists' },
];

const rightLinks = [
  { to: '/admin/users', label: 'Usuarios', adminOnly: true },
  { to: '/admin/collecting', label: 'Cobros', adminOnly: true },
  { to: '/admin/shipping', label: 'Envíos' },
  { to: '/admin/site-hero', label: 'Hero / ticker', adminOnly: true },
  { to: '/admin/statistics', label: 'Estadísticas' },
  { to: '/admin/audit', label: 'Auditoría' },
];

function AdminTab({ to, label, end }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'admin-tab active' : 'admin-tab')} end={end}>
      {label}
    </NavLink>
  );
}

export default function AdminToolbar() {
  const { user } = useAuth();
  const canManageUsers = user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
  const visibleRightLinks = rightLinks.filter((link) => !link.adminOnly || canManageUsers);

  return (
    <div className="admin-toolbar" aria-label="Navegación de administración">
      <div className="admin-toolbar__group admin-toolbar__group--left">
        {leftLinks.map((link) => (
          <AdminTab key={link.to} {...link} />
        ))}
      </div>
      <div className="admin-toolbar__group admin-toolbar__group--right">
        {visibleRightLinks.map((link) => (
          <AdminTab key={link.to} {...link} />
        ))}
      </div>
    </div>
  );
}
