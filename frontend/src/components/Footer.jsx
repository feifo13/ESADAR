import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-title">Miami Closet</p>
          <p className="footer-copy">Segunda mano americana curada. Sin modelos. Solo prendas que hablan por sí mismas.</p>
        </div>
        <div>
          <p className="footer-title">Navegación</p>
          <div className="footer-links">
            <Link to="/contact">Contacto</Link>
            <Link to="/about">Sobre nosotros</Link>
            <a href="#top">Volver arriba</a>
          </div>
        </div>
        <div>
          <p className="footer-title">Firma</p>
          <p className="footer-copy">Sportswear + ropa moderna seleccionada en EE. UU.</p>
        </div>
      </div>
    </footer>
  );
}
