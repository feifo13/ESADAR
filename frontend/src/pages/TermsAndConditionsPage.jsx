import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { toAbsoluteUrl } from "../lib/seo.js";

const sections = [
  {
    title: "1. Naturaleza de las prendas",
    copy:
      "ESADAR comercializa prendas seleccionadas, en su mayoría de segunda mano, vintage, sportswear o piezas modernas curadas. Cada artículo puede presentar señales propias de uso, antigüedad o conservación, las cuales se informan en la publicación cuando corresponde.",
  },
  {
    title: "2. Disponibilidad y stock",
    copy:
      "El stock es limitado y generalmente unitario. La publicación de un artículo no garantiza disponibilidad permanente. Si una prenda queda agotada, reservada o inactiva, ESADAR puede impedir la compra y mostrar alternativas relacionadas.",
  },
  {
    title: "3. Precios, ofertas y promociones",
    copy:
      "Los precios se expresan en pesos uruguayos salvo indicación contraria. Algunas prendas pueden aceptar ofertas. La aceptación de una oferta queda sujeta a aprobación de ESADAR y puede tener vigencia limitada.",
  },
  {
    title: "4. Órdenes y reserva",
    copy:
      "Al confirmar una compra, la orden queda registrada y puede permanecer pendiente de validación manual. Las prendas asociadas a la orden se reservan por 24 horas. Si el pago no se completa o no se puede validar dentro de ese plazo, ESADAR puede cancelar la orden.",
  },
  {
    title: "5. Medios de pago",
    copy:
      "ESADAR puede ofrecer transferencia bancaria, Prex, Mercado Pago u otros medios configurados en el sistema. En pagos por transferencia, el cliente debe utilizar los datos informados al finalizar la compra y enviados por correo, incluyendo la referencia de la orden.",
  },
  {
    title: "6. Validación del pago",
    copy:
      "La aprobación de una orden depende de la validación del pago. Una vez aprobada, ESADAR enviará el correo de confirmación correspondiente y el comprobante de compra en PDF.",
  },
  {
    title: "7. Envíos y retiros",
    copy:
      "Las condiciones de envío, retiro, costos y tiempos pueden variar según la opción seleccionada y la información disponible al momento de la compra. ESADAR podrá coordinar detalles adicionales con el cliente cuando sea necesario.",
  },
  {
    title: "8. Cambios y devoluciones",
    copy:
      "Por tratarse de prendas seleccionadas y muchas veces únicas, los cambios o devoluciones se evaluarán caso a caso. El cliente debe revisar fotos, medidas, estado y descripción antes de confirmar la compra.",
  },
  {
    title: "9. Datos de contacto",
    copy:
      "Para consultas sobre órdenes, pagos, envíos o condiciones particulares, el cliente puede comunicarse con ESADAR desde la vista de contacto.",
  },
];

export default function TermsAndConditionsPage() {
  const { site, pagesByRoute } = useSiteSeo();
  const termsSeo = pagesByRoute["/terminos-y-condiciones"] || null;

  return (
    <div className="container page-stack terms-page-shell">
      <SeoHead
        title={termsSeo?.title || `Términos y condiciones | ${site.name}`}
        description={
          termsSeo?.description ||
          "Términos y condiciones de compra de ESADAR: stock, pagos, validación, envíos y consultas."
        }
        canonical={termsSeo?.canonicalUrl || toAbsoluteUrl("/terminos-y-condiciones", site)}
        url={toAbsoluteUrl("/terminos-y-condiciones", site)}
      />

      <section className="section-card page-stack terms-hero-card">
        <p className="section-kicker">Términos y condiciones</p>
        <h1>Términos y condiciones de compra</h1>
        <p className="muted-copy">
          Al navegar, reservar o comprar en ESADAR, aceptás estas condiciones
          generales. El objetivo es que el proceso sea claro, seguro y coherente
          con el tipo de prendas que ofrecemos.
        </p>
      </section>

      <section className="section-card terms-content-card">
        <div className="terms-content-list">
          {sections.map((section) => (
            <article className="terms-content-section" key={section.title}>
              <h2>{section.title}</h2>
              <p className="muted-copy">{section.copy}</p>
            </article>
          ))}
        </div>
        <div className="terms-actions">
          <Link to="/contact" className="button button-primary">
            Contactar a ESADAR
          </Link>
        </div>
      </section>
    </div>
  );
}
