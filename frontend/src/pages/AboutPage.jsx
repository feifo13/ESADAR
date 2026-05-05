import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { buildOrganizationJsonLd, toAbsoluteUrl } from "../lib/seo.js";

export default function AboutPage() {
  const { site, pagesByRoute } = useSiteSeo();
  const aboutSeo = pagesByRoute["/about"] || null;

  return (
    <div className="container page-stack">
      <SeoHead
        title={aboutSeo?.title || `Sobre ${site.name} | Curaduria second hand`}
        description={
          aboutSeo?.description ||
          "Prendas second hand unicas, sportswear, vintage y ropa moderna elegida una por una."
        }
        canonical={aboutSeo?.canonicalUrl || toAbsoluteUrl("/about", site)}
        url={toAbsoluteUrl("/about", site)}
        jsonLd={[
          { id: "organization-about", data: buildOrganizationJsonLd(site) },
        ]}
      />

      {/* <section className="about-collage">
        <div className="about-card large">
          <span>Ropa second hand curada para un catalogo con identidad propia.</span>
        </div>
        <div className="about-card">
          <span>Sportswear, vintage y prendas modernas seleccionadas con criterio.</span>
        </div>
        <div className="about-card">
          <span>Stock limitado, piezas unicas y una curaduria honesta.</span>
        </div>
      </section> */}

      <section className="section-card page-stack">
        <div>
          <p className="section-kicker">Sobre nosotros</p>
          <h1>Una tienda curada, no un marketplace.</h1>
        </div>
        <p className="muted-copy">
          ESADAR trabaja sobre una idea simple: mostrar ropa second hand
          seleccionada con claridad, con buenas fotos y con foco real en cada
          prenda.
        </p>
        <p className="muted-copy">
          Nos interesan las piezas unicas, el sportswear, lo vintage y las
          prendas modernas que todavia tienen mucho para dar. Cada ingreso se
          elige una por una.
        </p>
        <p className="muted-copy">
          No hay stock infinito ni referencias repetidas. Esa es parte de la
          gracia: el catalogo cambia, las prendas vuelan y cada pieza entra
          porque vale la pena.
        </p>
      </section>
    </div>
  );
}
