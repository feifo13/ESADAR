import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { buildOrganizationJsonLd, toAbsoluteUrl } from "../lib/seo.js";

export default function AboutPage() {
  const { site, pagesByRoute } = useSiteSeo();
  const aboutSeo = pagesByRoute["/about"] || null;

  return (
    <div className="container page-stack">
      <SeoHead
        title={aboutSeo?.title || `Sobre ${site.name} | Selección`}
        description={
          aboutSeo?.description ||
          "Prendas unicas, sportswear, vintage y ropa moderna elegida una por una."
        }
        canonical={aboutSeo?.canonicalUrl || toAbsoluteUrl("/about", site)}
        url={toAbsoluteUrl("/about", site)}
        jsonLd={[
          { id: "organization-about", data: buildOrganizationJsonLd(site) },
        ]}
      />

      <section className="section-card page-stack">
        <div>
          <p className="section-kicker">Sobre nosotros</p>
          <h1></h1>
        </div>
        <p className="muted-copy">
          Creemos que la ropa con historia tiene un valor que la moda pasajera
          nunca va a poder igualar.
          <p className="muted-copy">
            En Esadar nos dedicamos a rescatar piezas clásicas y contemporáneas,
            dándole una nueva vida a prendas que para algunos ya recorrieron su
            camino, pero que para vos esté a punto de comenzar su mejor etapa.
          </p>
          <p className="muted-copy">
            Cada prenda es elegida con cuidado, pensando no solo en cómo se ve,
            sino también en lo que transmite. Porque para nosotros vestir no es
            solamente usar ropa: es conectar con una historia, apropiarse de
            ella y darle un lugar en la tuya.
          </p>
          <p className="muted-copy">
            Gracias por elegir piezas con identidad, carácter y darle una nueva
            oportunidad.
          </p>
          <p className="muted-copy">
            <strong>Esadar:</strong>
          </p>
          <p className="muted-copy">
            Selecciones por y para{" "}
            <strong className="checkbox-row-accent">HUMANOS/AS</strong>.
          </p>
        </p>
        {/* <p className="muted-copy">
          Nos interesan las piezas unicas, el sportswear, lo vintage y las
          prendas modernas que todavia tienen mucho para dar. Cada ingreso se
          elige una por una.
        </p>
        <p className="muted-copy">
          No hay stock infinito ni referencias repetidas. Esa es parte de la
          gracia: el catálogo cambia, las prendas vuelan y cada pieza entra
          porque vale la pena.
        </p> */}
      </section>
    </div>
  );
}
