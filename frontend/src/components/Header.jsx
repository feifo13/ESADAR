import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useCart } from "../contexts/CartContext.jsx";
import esadarWordmark from "../assets/esadar-wordmark.png";

export default function Header({ hideBrand = false }) {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount, cartFx } = useCart();
  const [cartPulse, setCartPulse] = useState(false);

  useEffect(() => {
    if (!cartFx?.tick) return undefined;
    setCartPulse(true);
    const timeoutId = window.setTimeout(() => setCartPulse(false), 820);
    return () => window.clearTimeout(timeoutId);
  }, [cartFx?.tick]);

  const isAdmin = user?.roles?.some((role) =>
    ["SUPER_ADMIN", "ADMIN", "OPERATOR"].includes(role),
  );

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          to="/"
          className={`brand-mark ${hideBrand ? "brand-mark--hidden" : ""}`}
          aria-label="ESADAR"
        >
          <img
            src={esadarWordmark}
            alt="ESADAR"
            className="brand-mark__logo"
          />
        </Link>

        <nav className="primary-nav">
          <NavLink to="/">Inicio</NavLink>
          {isAdmin ? <NavLink to="/admin/articles">Administración</NavLink> : null}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className={`ghost-button cart-button${cartPulse ? " cart-button--pulse" : ""}`}
            onClick={() => navigate("/checkout/resumen")}
          >
            Carro <span className={`badge${cartPulse ? " badge--pulse" : ""}`}>{cartCount}</span>
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
