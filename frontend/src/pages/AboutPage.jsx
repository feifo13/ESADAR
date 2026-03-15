export default function AboutPage() {
  return (
    <div className="container page-stack">
      <section className="about-collage">
        <div className="about-card large">
          <span>Selección curada de segunda mano comprada en EE. UU.</span>
        </div>
        <div className="about-card">
          <span>Sportswear, streetwear y ropa moderna.</span>
        </div>
        {/* <div className="about-card">
          <span>Sin modelos. Sin ruido. Solo producto.</span>
        </div> */}
        <div className="about-card">
          <span>
            Prendas elegidas una a una con criterio visual y comercial.
          </span>
        </div>
      </section>

      <section className="section-card page-stack">
        <div>
          <p className="section-kicker">Sobre nosotros</p>
          <h1>Una tienda curada, no un marketplace.</h1>
        </div>
        <p className="muted-copy">
          ESADAR nace desde una idea simple: mostrar prendas seleccionadas con
          claridad, sin distraer con campañas o modelos. El valor está en la
          búsqueda, en la curaduría y en la honestidad visual de cada pieza.
        </p>
        <p className="muted-copy">
          Gracias a quienes apoyan este proyecto desde el primer catálogo:
          amistades, clientas, clientes y todas las personas que valoran la
          segunda mano bien presentada.
        </p>
      </section>
    </div>
  );
}
