import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { buildOrganizationJsonLd, toAbsoluteUrl } from "../lib/seo.js";
import esadarWordmark from "../assets/esadar-wordmark.webp";

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
        <div className="about-page-heading">
          <p className="section-kicker">Sobre nosotros</p>

          {/* <img
            src={esadarWordmark}
            alt="ESADAR"
            className="about-page-logo"
            decoding="async"
          /> */}
          <h1>Sobre nosotros...</h1>
        </div>

        <div className="muted-copy">
          <p className="muted-copy">
            Creemos que la ropa con historia tiene un valor que la moda pasajera
            nunca va a poder igualar.
          </p>

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
            <strong>ESADAR: </strong>
            Selecciones por y para{" "}
            <strong className="checkbox-row-accent">HUMANOS/AS</strong>.
          </p>

          <p className="muted-copy"></p>
        </div>
      </section>
    </div>
  );
}
