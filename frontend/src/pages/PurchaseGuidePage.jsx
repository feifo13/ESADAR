import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { toAbsoluteUrl } from "../lib/seo.js";

const guideIntro = [
  "Comprar en ESADAR es simple: elegís una prenda, revisás sus detalles, confirmás tu orden y completás el pago.",
  "Nosotros validamos la compra para asegurarnos de que todo esté correcto antes de aprobarla.",
];

const guideSteps = [
  {
    title: "1. Elegí tu prenda",
    emoji: "👕",
    copy: [
      "Navegá el catálogo y elegí esa prenda que gusta.",
      "Antes de agregarla al carrito, te recomendamos revisar fotos, medidas reales, estado, talle, descripción y disponibilidad.",
      "Trabajamos con prendas seleccionadas y muchas veces únicas, así que cada publicación está pensada para que puedas decidir con la mayor información posible.",
    ],
  },
  {
    title: "2. Ofertá si la prenda lo permite",
    emoji: "💬",
    copy: [
      "Algunas prendas tienen la opción de recibir ofertas.",
      "Si nos hacés una oferta y la aceptamos, vas a verla destacada en tu cuenta y podés comprar esa prenda con el precio aprobado.",
      "El precio también se conversa, siempre que la prenda tenga esta opción habilitada.",
    ],
  },
  {
    title: "3. Confirmá carrito y datos",
    emoji: "🛒",
    copy: [
      "Antes de avanzar, revisá bien tu carrito: prendas, cantidades, precios, medio de pago y datos de envío.",
      "Si una prenda se agota antes de finalizar la compra, el sistema te va a pedir quitarla para poder continuar.",
      "Agregar una prenda al carrito ayuda a organizar tu compra, pero la reserva se confirma recién al cerrar la orden.",
    ],
  },
  {
    title: "4. Pagá y dejá tu orden reservada",
    emoji: "⏳",
    copy: [
      "Si elegís transferencia, te mostramos los datos de pago al finalizar la compra y también te los enviamos por correo.",
      "En el motivo o concepto de la transferencia, indicá tu número de orden para que podamos identificar el pago correctamente.",
      "Cuando confirmás la orden, la prenda queda reservada por 24 horas mientras esperamos la validación del pago.",
    ],
  },
  {
    title: "5. Esperá nuestra confirmación",
    emoji: "✅",
    copy: [
      "Después de recibir la información de pago, revisamos la orden desde Administración.",
      "Cuando validamos el pago, te enviamos el mail de orden aprobada junto con el comprobante de compra en PDF.",
      "Este paso nos ayuda a cuidar el stock y confirmar que la compra quede bien registrada.",
    ],
  },
  {
    title: "6. Recibí y disfrutá tu compra",
    emoji: "📦",
    copy: [
      "Una vez aprobada y despachada tu orden, te enviamos la información de envío disponible.",
      "El código de seguimiento puede depender del proveedor del servicio de correo, pero siempre te compartimos la información que tengamos.",
      "Después solo queda lo mejor: recibir tu prenda y agregarla a tu ropero.",
    ],
  },
];

const guideNote = [
  "En ESADAR trabajamos con prendas seleccionadas, de stock limitado y, en muchos casos, únicas.",
  "Cuando confirmás una orden, la prenda queda reservada por 24 horas. Si el pago no se completa o no puede validarse dentro de ese plazo, la orden puede cancelarse y el artículo vuelve a estar disponible.",
  "Nuestro consejo: antes de confirmar, revisá bien fotos, medidas reales, estado y descripción. Queremos que compres con confianza y que sepas exactamente qué estás eligiendo.",
];

const guideThanks = [
  "Gracias por elegir ESADAR y por tomarte el tiempo de mirar cada prenda con atención.",
  "Sabemos que comprar ropa por internet implica revisar detalles, comparar medidas y confiar en lo que te mostramos. Por eso tratamos de publicar cada artículo con información clara, fotos reales y una descripción honesta.",
  "Cada compra nos ayuda a seguir buscando prendas especiales, cuidar mejor el stock y construir una tienda más clara, más simple y más fiel a lo que queremos hacer.",
];

function renderCopy(copy, className = "muted-copy") {
  if (Array.isArray(copy)) {
    return copy.map((paragraph, index) => (
      <p className={className} key={`${paragraph.slice(0, 24)}-${index}`}>
        {paragraph}
      </p>
    ));
  }

  return <p className={className}>{copy}</p>;
}

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

        <div className="guide-copy-stack">{renderCopy(guideIntro)}</div>
      </section>

      <section className="guide-steps-grid" aria-label="Pasos de compra">
        {guideSteps.map((step) => (
          <article className="section-card guide-step-card" key={step.title}>
            <h2>
              <span aria-hidden="true">{step.emoji}</span> {step.title}
            </h2>

            <div className="guide-copy-stack">{renderCopy(step.copy)}</div>
          </article>
        ))}
      </section>

      <section className="section-card page-stack guide-thanks-card">
        <p className="section-kicker">Gracias</p>
        <h2>Gracias por elegir ESADAR</h2>

        <div className="guide-copy-stack">{renderCopy(guideThanks)}</div>
      </section>

      <section className="section-card page-stack guide-note-card">
        <p className="section-kicker">Importante</p>
        <h2>Stock único y reserva por 24 horas</h2>

        <div className="guide-copy-stack">{renderCopy(guideNote)}</div>

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
