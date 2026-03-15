import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useCart } from "../contexts/CartContext.jsx";
import esadarWordmark from "../assets/esadar-wordmark.png";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount } = useCart();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand-mark brand-mark-logo" aria-label="ESADAR · Inicio">
          <img src={esadarWordmark} alt="ESADAR" className="brand-logo-image" />
        </Link>

        <nav className="primary-nav" aria-label="Navegación principal" />

        <div className="header-actions">
          {isAuthenticated ? (
            <span className="user-greeting">Hola, {user.firstName}</span>
          ) : null}

          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate("/checkout/resumen")}
          >
            Carro <span className="badge">{cartCount}</span>
          </button>

          {isAuthenticated ? (
            <button type="button" className="ghost-button" onClick={logout}>
              Salir
            </button>
          ) : (
            <div className="header-user">
              <NavLink to="/login" className="ghost-button linklike">
                Ingresar
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
