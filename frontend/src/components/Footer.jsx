import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Footer() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.some((role) =>
    ["SUPER_ADMIN", "ADMIN", "OPERATOR"].includes(role),
  );

  return (
    <footer className="site-footer">
      <div className="container footer-grid footer-grid-nav">
        <div>
          <p className="footer-title">Navegación</p>
          <div className="footer-links">
            <Link to="/contact">Contacto</Link>
            <Link to="/about">Sobre nosotros</Link>
            {isAdmin ? <Link to="/admin/articles">Administración</Link> : null}
            <a href="#top">Volver arriba</a>
            <Link to="/terminos-y-condiciones" className="footer-terms-link">
              Términos y condiciones
            </Link>
          </div>
        </div>

        <div>
          <p className="footer-title">Firma</p>
          <p className="footer-copy">B-E-S-A-N-D-O-S-E</p>
        </div>
      </div>
    </footer>
  );
}
