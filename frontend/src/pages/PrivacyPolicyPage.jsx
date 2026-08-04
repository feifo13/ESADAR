import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { toAbsoluteUrl } from "../lib/seo.js";

const lastUpdated = "4 de agosto de 2026";

const sections = [
  {
    title: "1. Alcance y responsable",
    copy: [
      "Esta Política de Privacidad explica cómo ESADAR recopila, utiliza, conserva y protege datos personales cuando navegás por esadar.com.uy, creás una cuenta, iniciás sesión con Google, realizás una compra, enviás una oferta, guardás prendas o te comunicás con nosotros.",
      "ESADAR es responsable del tratamiento de los datos utilizados para operar la tienda y sus servicios. Podés contactarnos por cualquier consulta de privacidad en contacto@esadar.com.uy.",
    ],
  },
  {
    title: "2. Datos que podemos tratar",
    copy: [
      "Datos de cuenta y perfil: nombre, apellido, correo electrónico y, cuando los proporcionás, fecha de nacimiento, teléfono o WhatsApp, Instagram, dirección, ciudad, departamento, código postal y preferencias de compra, pago o envío.",
      "Datos de actividad comercial: carrito, prendas guardadas, ofertas, órdenes, comprobantes, estado de pago, opción de entrega, mensajes y solicitudes de contacto o avisos.",
      "Datos técnicos y de seguridad: dirección IP, navegador, dispositivo, identificadores de sesión, fechas de acceso, registros de auditoría, eventos de seguridad y datos básicos de navegación o medición del sitio.",
    ],
  },
  {
    title: "3. Inicio de sesión con Google",
    copy: [
      "Cuando elegís Continuar con Google, ESADAR recibe de Google únicamente los datos básicos necesarios para identificarte y crear o encontrar tu cuenta: identificador único de la cuenta, correo electrónico, estado de verificación del correo, nombre y apellido.",
      "ESADAR no recibe ni almacena tu contraseña de Google, contactos, archivos de Drive, fotografías, mensajes ni otros contenidos de tu cuenta. Tampoco almacenamos tokens de acceso de Google.",
      "Los datos de Google se usan exclusivamente para autenticarte, vincular la identidad con tu cuenta de cliente, mantener la seguridad del acceso y registrar la fecha del último ingreso. No los vendemos, alquilamos ni utilizamos para crear publicidad basada en la información de tu cuenta Google.",
    ],
  },
  {
    title: "4. Para qué usamos los datos",
    copy: [
      "Utilizamos los datos para crear y administrar cuentas, autenticar accesos, procesar órdenes y ofertas, coordinar pagos y entregas, responder consultas, enviar comunicaciones solicitadas, prevenir fraude o abuso, mantener la seguridad, atender reclamos y cumplir obligaciones legales, contables o comerciales.",
      "También podemos utilizar información agregada o estadísticas de navegación para comprender el funcionamiento del sitio y mejorar la experiencia. Las comunicaciones promocionales se enviarán únicamente cuando hayan sido solicitadas o estén permitidas, y podrán dejar de recibirse por los medios informados en cada mensaje.",
    ],
  },
  {
    title: "5. Cookies, sesión y medición",
    copy: [
      "ESADAR utiliza cookies y tecnologías similares necesarias para mantener la sesión, proteger la cuenta, recordar acciones del sitio y permitir funciones como el carrito. Bloquear estas tecnologías puede impedir el ingreso o afectar funciones esenciales.",
      "También podemos utilizar herramientas de medición y analítica para conocer de forma general cómo se usa el sitio. Google Identity Services y los servicios de analítica que correspondan pueden aplicar sus propias tecnologías y políticas de privacidad.",
      "Podés administrar o eliminar cookies desde la configuración de tu navegador. La eliminación de cookies de sesión puede cerrar tu cuenta en el dispositivo.",
    ],
  },
  {
    title: "6. Proveedores y comunicación de datos",
    copy: [
      "ESADAR no vende ni alquila datos personales. Podemos facilitar la información estrictamente necesaria a proveedores que colaboran con la operación del servicio, como infraestructura y alojamiento, autenticación, correo electrónico, analítica, medios de pago y empresas de entrega.",
      "Cuando un pago se procesa mediante un proveedor externo, los datos financieros sensibles son tratados por ese proveedor bajo sus propios términos. ESADAR no solicita ni almacena números completos de tarjeta o credenciales bancarias del cliente.",
      "También podremos comunicar información cuando exista una obligación legal, una orden de autoridad competente o sea necesario para proteger derechos, prevenir fraude o responder a un incidente de seguridad. Algunos proveedores pueden procesar información fuera de Uruguay conforme a sus condiciones y a las garantías aplicables.",
    ],
  },
  {
    title: "7. Conservación",
    copy: [
      "Conservamos los datos mientras la cuenta permanezca activa y durante el tiempo necesario para prestar los servicios, mantener la seguridad, resolver consultas y cumplir obligaciones legales, contables, fiscales, contractuales o de auditoría.",
      "Una solicitud de eliminación de cuenta no implica necesariamente la supresión inmediata de información vinculada a órdenes, pagos, comprobantes, prevención de fraude o registros que debamos conservar por una obligación legítima. Cuando la conservación ya no sea necesaria, la información será eliminada, anonimizada o bloqueada según corresponda.",
    ],
  },
  {
    title: "8. Seguridad",
    copy: [
      "Aplicamos medidas técnicas y organizativas razonables para proteger la confidencialidad, integridad y disponibilidad de la información, limitar accesos y registrar acciones sensibles.",
      "Ningún sistema conectado a Internet puede garantizar seguridad absoluta. Ante un incidente relevante, actuaremos de acuerdo con la normativa aplicable y adoptaremos medidas para reducir sus efectos.",
    ],
  },
  {
    title: "9. Tus derechos",
    copy: [
      "De acuerdo con la normativa uruguaya, podés solicitar información sobre los datos que tratamos y ejercer, cuando corresponda, los derechos de acceso, rectificación, actualización, inclusión o supresión, así como retirar un consentimiento u oponerte a determinados usos.",
      "Para ejercer estos derechos, escribí a contacto@esadar.com.uy indicando tu solicitud y el correo asociado a la cuenta. Podremos pedir información razonable para verificar tu identidad y proteger tus datos. Responderemos dentro de los plazos legales aplicables.",
    ],
  },
  {
    title: "10. Personas menores de edad",
    copy: [
      "El servicio no está dirigido específicamente a niñas o niños. Las personas menores de edad deben utilizarlo con la participación y autorización de su madre, padre o representante responsable cuando corresponda.",
    ],
  },
  {
    title: "11. Cambios y normativa aplicable",
    copy: [
      `Última actualización: ${lastUpdated}. Podemos actualizar esta política para reflejar cambios legales, técnicos u operativos. La versión vigente estará siempre publicada en esta página.`,
      "Esta política se rige por las leyes de la República Oriental del Uruguay, especialmente la Ley Nº 18.331 de Protección de Datos Personales y su reglamentación.",
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

export default function PrivacyPolicyPage() {
  const { site, pagesByRoute } = useSiteSeo();
  const privacySeo = pagesByRoute["/politica-de-privacidad"] || null;

  return (
    <div className="container page-stack terms-page-shell">
      <SeoHead
        title={privacySeo?.title || `Política de privacidad | ${site.name}`}
        description={
          privacySeo?.description ||
          "Cómo ESADAR recopila, usa, protege y conserva datos personales, incluido el acceso mediante Google."
        }
        canonical={
          privacySeo?.canonicalUrl ||
          toAbsoluteUrl("/politica-de-privacidad", site)
        }
        url={toAbsoluteUrl("/politica-de-privacidad", site)}
      />

      <section className="section-card page-stack terms-hero-card">
        <p className="section-kicker">Privacidad y datos personales</p>
        <h1>Política de privacidad</h1>
        <p className="muted-copy">
          Queremos que sepas qué información utilizamos, por qué la necesitamos
          y cómo podés ejercer tus derechos cuando usás ESADAR.
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
          <a
            href="mailto:contacto@esadar.com.uy"
            className="button button-primary"
          >
            Consultar por mis datos
          </a>
          <Link to="/terminos-y-condiciones" className="button button-secondary">
            Ver términos y condiciones
          </Link>
        </div>
      </section>
    </div>
  );
}
