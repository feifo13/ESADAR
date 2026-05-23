import { Link } from "react-router-dom";

export default function LeadCaptureCta({ className = "" }) {
  const sectionClassName = [
    "section-card",
    "lead-capture-card",
    "lead-capture-card--cta",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div className="lead-capture-copy">
        <p className="section-kicker">¡Ey!</p>
        <h2>¿Querés enterarte cuando entra ropa nueva?</h2>
        <p className="muted-copy">
          Dejanos tus preferencias en una vista dedicada y te avisamos cuando
          aparezcan prendas que encajen con tu estilo.
        </p>
      </div>
      <Link
        className="button button-primary lead-capture-cta-button"
        to="/avisos"
      >
        ¡Quiero!
      </Link>
    </section>
  );
}
