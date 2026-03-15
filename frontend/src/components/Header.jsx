import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useCart } from "../contexts/CartContext.jsx";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount } = useCart();

  const isAdmin = user?.roles?.some((role) =>
    ["SUPER_ADMIN", "ADMIN", "OPERATOR"].includes(role),
  );

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand-mark">
          <span className="brand-kicker">ESADAR</span>
          <span className="brand-main">Curated Second Hand</span>
        </Link>

        <nav className="primary-nav">
          <NavLink to="/">Inicio</NavLink>
          {isAdmin ? <NavLink to="/admin/articles">Backoffice</NavLink> : null}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate("/checkout/resumen")}
          >
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
