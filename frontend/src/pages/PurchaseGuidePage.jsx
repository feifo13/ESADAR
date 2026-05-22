import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { toAbsoluteUrl } from "../lib/seo.js";

const guideSteps = [
  {
    title: "1. Elegí tu prenda",
    copy: "Navegá el catálogo, revisá fotos, medidas reales, estado de la prenda, talle y disponibilidad antes de agregarla al carrito.",
  },
  {
    title: "2. Ofertá si la prenda lo permite",
    copy: "Algunas prendas aceptan ofertas. Si tu oferta es aprobada, la vas a ver destacada en tu cuenta y podés comprarla con ese precio.",
  },
  {
    title: "3. Confirmá carrito y datos",
    copy: "Antes de avanzar, revisá cantidades, precio final, medio de pago y envío. Si un artículo se agota, el sistema te pedirá quitarlo para continuar.",
  },
  {
    title: "4. Pagá y esperá validación",
    copy: "Si elegis transferencia, los datos de pago quedan visibles al finalizar la compra y tambien se envian por correo. En el motivo/concepto de la transferencia indica tu numero de orden. La orden queda reservada por 24 horas.",
  },
  {
    title: "5. Recibí la confirmación",
    copy: "Cuando la Administración de ESADAR valida el pago, recibís el mail de orden aprobada junto con el comprobante de compra en PDF.",
  },
  {
    title: "6. Recibi y disfruta tu compra",
    copy: "Cuando tu orden sea aprobada y despachada, te enviaremos la informacion de envio disponible. El codigo de seguimiento puede estar sujeto a disponibilidad del proveedor del servicio de correo.",
  },
];

export default function PurchaseGuidePage() {
  const { site, pagesByRoute } = useSiteSeo();
  const guideSeo = pagesByRoute["/guia-de-compra"] || null;

  return (
    <div className="container page-stack guide-page-shell">
      <SeoHead
        title={guideSeo?.title || `Guía de compra | ${site.name}`}
        description={
          guideSeo?.description ||
          "Cómo comprar en ESADAR: catálogo, ofertas, carrito, pago, validación y comprobante."
        }
        canonical={
          guideSeo?.canonicalUrl || toAbsoluteUrl("/guia-de-compra", site)
        }
        url={toAbsoluteUrl("/guia-de-compra", site)}
      />

      <section className="section-card page-stack guide-hero-card">
        <p className="section-kicker">Guía de compra</p>
        <h1>Cómo comprar en ESADAR</h1>
        <p className="muted-copy">
          Una guía simple para entender el flujo completo: elegir una prenda,
          ofertar si está habilitado, confirmar la orden, pagar y recibir la
          aprobación.
        </p>
      </section>

      <section className="guide-steps-grid" aria-label="Pasos de compra">
        {guideSteps.map((step) => (
          <article className="section-card guide-step-card" key={step.title}>
            <h2>{step.title}</h2>
            <p className="muted-copy">{step.copy}</p>
          </article>
        ))}
      </section>

      <section className="section-card page-stack guide-note-card">
        <p className="section-kicker">Importante</p>
        <h2>Stock único y reserva por 24 horas</h2>
        <p className="muted-copy">
          ESADAR trabaja con prendas seleccionadas y stock limitado. Cuando
          confirmás una orden, la prenda queda reservada por 24 horas. Si el
          pago no se completa o no puede validarse, la orden puede cancelarse y
          el artículo vuelve a estar disponible.
        </p>
        <div className="guide-actions">
          <Link to="/articles" className="button button-primary">
            Ver catálogo
          </Link>
          <Link to="/contact" className="button button-secondary">
            Hacer una consulta
          </Link>
        </div>
      </section>
    </div>
  );
}
