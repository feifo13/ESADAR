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
          "Prendas únicas, sportswear, vintage y ropa moderna elegida una por una."
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
          <h1>Sobre nosotros...</h1>
        </div>

        <div className="muted-copy">
          <p>Esadar nace de una idea simple: elegir mejor.</p>

          <p>
            No buscamos acumular stock ni seguir tendencias. Elegimos pieza por
            pieza, mirando calidad, forma, materiales, estado y carácter. No
            creemos en llenar percheros por llenar: preferimos elegir menos,
            pero mejor.
          </p>

          <p>
            Trabajamos con prendas clásicas, deportivas y contemporáneas,
            elegidas por lo que pueden aportar hoy.
          </p>

          <p>
            Tampoco seguimos una lógica de temporada. Nos interesa la ropa que
            todavía funciona, lo que se puede reinterpretar y lo que permite
            construir un estilo propio sin depender de lo nuevo como única
            opción.
          </p>

          <p>
            Cada prenda llega a la tienda porque alguien la eligió con atención.
          </p>

          <p>Gracias por elegir Esadar y confiar en nuestra selección.</p>

          <p>
            <strong>ESADAR: </strong>
            selecciones por y para{" "}
            <strong className="checkbox-row-accent">HUMANOS/AS</strong>.
          </p>
        </div>
      </section>
    </div>
  );
}
