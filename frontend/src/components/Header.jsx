import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function Header() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount } = useCart();
  const { theme, toggleTheme } = useTheme();

  const isAdmin = user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(role));

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand-mark">
          <span className="brand-kicker">Miami Closet</span>
          <span className="brand-main">Curated Second Hand</span>
        </Link>

        <nav className="primary-nav">
          <NavLink to="/">Inicio</NavLink>
          <NavLink to="/about">Nosotros</NavLink>
          <NavLink to="/contact">Contacto</NavLink>
          {isAdmin ? <NavLink to="/admin/articles">Backoffice</NavLink> : null}
        </nav>

        <div className="header-actions">
          <button type="button" className="ghost-button" onClick={toggleTheme}>
            {theme === 'default' ? 'Modo alternativo' : 'Modo default'}
          </button>

          <button type="button" className="ghost-button" onClick={() => navigate('/checkout/resumen')}>
            Carro <span className="badge">{cartCount}</span>
          </button>

          {isAuthenticated ? (
            <div className="header-user">
              <span className="user-greeting">Hola, {user.firstName}</span>
              <button type="button" className="ghost-button" onClick={logout}>
                Salir
              </button>
            </div>
          ) : (
            <div className="header-user">
              <NavLink to="/login" className="ghost-button linklike">
                Ingresar
              </NavLink>
              <NavLink to="/register" className="button button-primary">
                Crear usuario
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
