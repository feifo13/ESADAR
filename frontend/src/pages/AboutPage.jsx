import SeoHead from "../components/SeoHead.jsx";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { buildOrganizationJsonLd, toAbsoluteUrl } from "../lib/seo.js";
import esadarLogo from "../assets/brand/esadar-logotipo.png";

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
          <p className="section-kicker"></p>
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
        </div>

        <footer
          aria-label="Firma Esadar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(14px, 3vw, 28px)",
            marginTop: "clamp(28px, 5vw, 52px)",
          }}
        >
          <img
            src={esadarLogo}
            alt="Esadar"
            style={{
              width: "clamp(84px, 12vw, 128px)",
              height: "auto",
              display: "block",
              flexShrink: 0,
            }}
          />

          <span
            aria-hidden="true"
            style={{
              display: "block",
              width: "100%",
              height: "3px",
              background:
                "linear-gradient(90deg, #41c7cf 0%, #071923 52%, #ff6a00 100%)",
            }}
          />
        </footer>
        <p>
          <span className="checkbox-row-accent">Por y para </span>
          <strong className="checkbox-row-accent">Humanos</strong>.
        </p>
      </section>
    </div>
  );
}
