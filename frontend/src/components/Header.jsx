import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';

export default function Header() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount } = useCart();

  return (
    <header className="site-header">
      <div className="container header-inner header-inner-minimal">
        <Link to="/" className="brand-mark">
          <span className="brand-kicker">ESADAR</span>
          <span className="brand-main">Curated Second Hand</span>
        </Link>

        <div className="header-spacer" />

        <div className="header-actions header-actions-ordered">
          {isAuthenticated ? <span className="user-greeting">Hola, {user.firstName}</span> : null}

          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/checkout/resumen')}
          >
            Carro <span className="badge">{cartCount}</span>
          </button>

          {isAuthenticated ? (
            <button type="button" className="ghost-button" onClick={logout}>
              Salir
            </button>
          ) : (
            <NavLink to="/login" className="ghost-button linklike">
              Ingresar
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
