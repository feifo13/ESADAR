import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useCart } from "../contexts/CartContext.jsx";
import esadarWordmark from "../assets/esadar-wordmark.png";

export default function Header({ hideBrand = false }) {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount, cartFx } = useCart();
  const [cartPulse, setCartPulse] = useState(false);
  const [flyFx, setFlyFx] = useState(null);
  const cartButtonRef = useRef(null);

  useEffect(() => {
    if (!cartFx?.tick) return undefined;

    setCartPulse(true);
    const timeoutId = window.setTimeout(() => setCartPulse(false), 1100);

    const sourceRect = cartFx.sourceRect;
    const targetRect = cartButtonRef.current?.getBoundingClientRect();
    if (sourceRect && targetRect) {
      const startX = sourceRect.left + sourceRect.width / 2;
      const startY = sourceRect.top + sourceRect.height / 2;
      const endX = targetRect.left + targetRect.width / 2;
      const endY = targetRect.top + targetRect.height / 2;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const curveLift = Math.max(48, Math.min(160, Math.abs(deltaY) * 0.55 + 72));

      setFlyFx({
        id: cartFx.tick,
        style: {
          "--cart-fly-start-x": `${startX}px`,
          "--cart-fly-start-y": `${startY}px`,
          "--cart-fly-dx": `${deltaX}px`,
          "--cart-fly-dy": `${deltaY}px`,
          "--cart-fly-lift": `${curveLift}px`,
        },
      });

      const flyTimer = window.setTimeout(() => setFlyFx(null), 1180);
      return () => {
        window.clearTimeout(timeoutId);
        window.clearTimeout(flyTimer);
      };
    }

    return () => window.clearTimeout(timeoutId);
  }, [cartFx?.tick, cartFx?.sourceRect]);

  const isAdmin = user?.roles?.some((role) =>
    ["SUPER_ADMIN", "ADMIN", "OPERATOR"].includes(role),
  );

  return (
    <>
      <header className="site-header">
        <div className="container header-inner header-inner--compact">
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

          <div className="header-actions header-actions--ordered">
            {isAuthenticated ? (
              <>
                <span className="user-greeting">
                  Hola, {user?.firstName || ""}
                </span>
                {isAdmin ? (
                  <NavLink to="/admin/articles" className="ghost-button linklike">
                    ADMIN
                  </NavLink>
                ) : null}
                <button
                  ref={cartButtonRef}
                  type="button"
                  className={`ghost-button cart-button cart-button--icon-only${cartPulse ? " cart-button--pulse" : ""}`}
                  onClick={() => navigate('/checkout/resumen', { state: { replayIntro: true, replayIntroReason: 'cart' } })}
                  aria-label="Carrito"
                  title="Carrito"
                >
                  <svg className="cart-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M3 4h2.2l1.9 9.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H7.1" /></svg>
                  <span className={`badge${cartPulse ? " badge--pulse" : ""}`}>
                    {cartCount}
                  </span>
                </button>
                <button type="button" className="ghost-button" onClick={logout}>
                  SALIR
                </button>
              </>
            ) : (
              <>
                <button
                  ref={cartButtonRef}
                  type="button"
                  className={`ghost-button cart-button cart-button--icon-only${cartPulse ? " cart-button--pulse" : ""}`}
                  onClick={() => navigate('/checkout/resumen', { state: { replayIntro: true, replayIntroReason: 'cart' } })}
                  aria-label="Carrito"
                  title="Carrito"
                >
                  <svg className="cart-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M3 4h2.2l1.9 9.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H7.1" /></svg>
                  <span className={`badge${cartPulse ? " badge--pulse" : ""}`}>
                    {cartCount}
                  </span>
                </button>
                <NavLink to="/login" className="ghost-button linklike">
                  INGRESAR
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      {flyFx ? (
        <span key={flyFx.id} className="cart-fly-token" style={flyFx.style} aria-hidden="true">
          <span className="cart-fly-token__core" />
        </span>
      ) : null}
    </>
  );
}
