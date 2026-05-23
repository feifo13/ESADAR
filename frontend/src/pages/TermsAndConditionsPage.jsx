import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { toAbsoluteUrl } from "../lib/seo.js";

const sections = [
  {
    title: "1. Naturaleza de las prendas",
    copy: [
      "ESADAR comercializa prendas seleccionadas, en su mayoría de segunda mano, vintage, de archivo o de stock limitado. Cada artículo puede presentar señales propias de uso, antigüedad, conservación o manipulación normal.",
      "La publicación de cada prenda incluye la información disponible sobre fotos, medidas, estado, descripción y detalles relevantes. Las medidas pueden tener variaciones mínimas y los colores pueden percibirse de forma distinta según la luz, la pantalla o el dispositivo del cliente.",
    ],
  },
  {
    title: "2. Disponibilidad y stock",
    copy: [
      "El stock de ESADAR es limitado y, en muchos casos, unitario. La publicación de un artículo no garantiza disponibilidad permanente ni reserva automática.",
      "Agregar una prenda al carrito, guardarla en favoritos o iniciar una consulta no asegura su disponibilidad. La reserva queda asociada a una orden confirmada y se mantiene únicamente bajo las condiciones informadas durante el proceso de compra.",
    ],
  },
  {
    title: "3. Precios, ofertas y promociones",
    copy: [
      "Los precios se expresan en pesos uruguayos salvo indicación contraria. Las promociones, descuentos u ofertas especiales son válidas mientras se encuentren publicadas o hasta agotar stock.",
      "Algunas prendas pueden aceptar ofertas. La aceptación de una oferta queda sujeta a aprobación de ESADAR y puede tener vigencia limitada. ESADAR podrá corregir errores manifiestos de carga, precio o publicación antes de validar definitivamente una orden.",
    ],
  },
  {
    title: "4. Órdenes y reserva",
    copy: [
      "Al confirmar una compra, la orden queda registrada y puede permanecer pendiente de validación manual. Las prendas asociadas a la orden se reservan por 24 horas desde la confirmación.",
      "Si el pago no se completa, no se identifica correctamente, no puede validarse dentro del plazo informado o la información de contacto/envío es insuficiente, ESADAR podrá cancelar la orden y liberar nuevamente la prenda.",
    ],
  },
  {
    title: "5. Medios de pago",
    copy: [
      "ESADAR puede ofrecer, según disponibilidad, transferencia bancaria, Prex, Mercado Pago u otros medios configurados en el sistema.",
      "En pagos por transferencia o medios equivalentes, el cliente debe utilizar los datos informados al finalizar la compra y enviados por correo. También deberá indicar el número de orden en el motivo, concepto o referencia del pago para facilitar su validación.",
    ],
  },
  {
    title: "6. Validación del pago",
    copy: [
      "La aprobación de una orden depende de la validación del pago por parte de ESADAR. El envío de un comprobante no implica aprobación automática hasta que el pago sea confirmado correctamente.",
      "Una vez aprobada la orden, ESADAR enviará el correo de confirmación correspondiente y, cuando aplique, el comprobante de compra en PDF.",
    ],
  },
  {
    title: "7. Envíos",
    copy: [
      "El envío se gestiona después de la aprobación de la orden y del pago. Las condiciones de envío, costos y tiempos pueden variar según la opción seleccionada, la dirección indicada y la disponibilidad del proveedor logístico.",
      "El cliente es responsable de proporcionar datos de entrega completos y correctos. ESADAR podrá contactar al cliente si necesita confirmar información antes del despacho.",
      "El código de seguimiento podrá ser proporcionado cuando el proveedor del servicio de correo lo disponibilice. ESADAR informará la información de seguimiento disponible una vez despachada la orden, cuando corresponda.",
    ],
  },
  {
    title: "8. Cambios, devoluciones y revisión previa",
    copy: [
      "En ESADAR trabajamos con prendas seleccionadas, de stock limitado y, en muchos casos, únicas. Por esta razón, cada compra debe ser revisada cuidadosamente por el cliente antes de su confirmación, considerando fotos, medidas, estado, materialidad y descripción publicada.",
      "ESADAR no contempla cambios o devoluciones por motivos de talla, gusto, apreciación personal, arrepentimiento de compra o diferencias esperables propias de prendas previamente seleccionadas, vintage, de archivo o de segunda mano.",
      "Sin perjuicio de lo anterior, cualquier solicitud asociada a un error de despacho, diferencia sustancial entre el producto recibido y la descripción publicada, daño no informado previamente o derecho que corresponda conforme a la normativa vigente, será revisada por ESADAR según los antecedentes del caso.",
      "Al confirmar la compra, el cliente declara haber revisado fotos, medidas, estado y descripción del producto, y aceptar las condiciones particulares de la prenda seleccionada.",
    ],
  },
  {
    title: "9. Datos de contacto",
    copy: [
      "Para consultas sobre órdenes, pagos, envíos o condiciones particulares, el cliente puede comunicarse con ESADAR desde la vista de contacto.",
      "Para una mejor gestión, se recomienda indicar el número de orden y el correo utilizado en la compra. Las respuestas se realizarán por los canales oficiales de ESADAR.",
    ],
  },
];

function normalizeParagraphs(copy) {
  if (Array.isArray(copy)) {
    return copy.filter(Boolean);
  }

  return String(copy)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

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
        canonical={
          termsSeo?.canonicalUrl ||
          toAbsoluteUrl("/terminos-y-condiciones", site)
        }
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
              {normalizeParagraphs(section.copy).map((paragraph, index) => (
                <p className="muted-copy terms-copy-paragraph" key={index}>
                  {paragraph}
                </p>
              ))}
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
