import { useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useLookups } from "../contexts/LookupsContext.jsx";
import { apiFetch } from "../lib/api.js";

const initialLeadForm = {
  firstName: "",
  email: "",
  phone: "",
  instagram: "",
  preferredCategory: "",
  preferredBrand: "",
  preferredSize: "",
  preferredColor: "",
};

export default function NewsletterPage() {
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();
  const [leadForm, setLeadForm] = useState(initialLeadForm);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadSuccess, setLeadSuccess] = useState("");

  function updateLeadField(name, value) {
    setLeadForm((current) => ({ ...current, [name]: value }));
  }

  async function handleLeadSubmit(event) {
    event.preventDefault();

    try {
      setLeadSubmitting(true);
      setLeadError("");
      setLeadSuccess("");

      await apiFetch("/api/public/leads/newsletter", {
        method: "POST",
        body: {
          firstName: leadForm.firstName || null,
          email: leadForm.email || null,
          phone: leadForm.phone || null,
          instagram: leadForm.instagram || null,
          preferredCategories: leadForm.preferredCategory
            ? [leadForm.preferredCategory]
            : [],
          preferredBrands: leadForm.preferredBrand
            ? [leadForm.preferredBrand]
            : [],
          preferredSizes: leadForm.preferredSize
            ? [leadForm.preferredSize]
            : [],
          preferredColors: leadForm.preferredColor
            ? [leadForm.preferredColor]
            : [],
        },
      });

      setLeadSuccess(
        "Te vamos a avisar cuando entren prendas que encajen con tu estilo.",
      );
      setLeadForm(initialLeadForm);
    } catch (err) {
      setLeadError(err.message || "No pudimos guardar tu preferencia ahora.");
    } finally {
      setLeadSubmitting(false);
    }
  }

  return (
    <div className="container page-stack newsletter-page-shell">
      <SeoHead
        title="ESADAR | Avisos de ropa nueva"
        description="Recibi avisos cuando entren prendas second hand seleccionadas segun tus preferencias."
      />

      <nav className="breadcrumb-row" aria-label="Breadcrumb">
        <Link to="/">Inicio</Link>
        <span>/</span>
        <strong>Avisos de ropa nueva</strong>
      </nav>

      <section className="section-card page-stack lead-capture-card lead-capture-card--page">
        <div className="lead-capture-copy">
          <p className="section-kicker">¡Ey!</p>
          <h1>¿Queres enterarte cuando entra ropa nueva?</h1>
          <p className="muted-copy">
            Dejanos un contacto y tus preferencias. Te avisamos cuando aparezcan
            prendas que encajen con tu estilo.
          </p>
        </div>

        <form className="lead-capture-form" onSubmit={handleLeadSubmit}>
          <div className="form-grid-two">
            <label className="field-group">
              <span>Nombre</span>
              <input
                className="input"
                value={leadForm.firstName}
                onChange={(event) =>
                  updateLeadField("firstName", event.target.value)
                }
              />
            </label>
            <label className="field-group">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={leadForm.email}
                onChange={(event) =>
                  updateLeadField("email", event.target.value)
                }
              />
            </label>
            <label className="field-group">
              <span>WhatsApp</span>
              <input
                className="input"
                value={leadForm.phone}
                onChange={(event) =>
                  updateLeadField("phone", event.target.value)
                }
              />
            </label>
            <label className="field-group">
              <span>Instagram</span>
              <input
                className="input"
                value={leadForm.instagram}
                onChange={(event) =>
                  updateLeadField("instagram", event.target.value)
                }
              />
            </label>
            <label className="field-group">
              <span>Categoria</span>
              <select
                className="input"
                value={leadForm.preferredCategory}
                onChange={(event) =>
                  updateLeadField("preferredCategory", event.target.value)
                }
              >
                <option value="">Sin preferencia</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Marca</span>
              <select
                className="input"
                value={leadForm.preferredBrand}
                onChange={(event) =>
                  updateLeadField("preferredBrand", event.target.value)
                }
              >
                <option value="">Sin preferencia</option>
                {brandOptions.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Talle</span>
              <select
                className="input"
                value={leadForm.preferredSize}
                onChange={(event) =>
                  updateLeadField("preferredSize", event.target.value)
                }
              >
                <option value="">Sin preferencia</option>
                {sizeOptions.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Color</span>
              <input
                className="input"
                value={leadForm.preferredColor}
                onChange={(event) =>
                  updateLeadField("preferredColor", event.target.value)
                }
                placeholder="Ej: negro, azul, neutros"
              />
            </label>
          </div>

          {leadError ? <p className="error-copy">{leadError}</p> : null}
          {leadSuccess ? <p className="success-copy">{leadSuccess}</p> : null}

          <div className="inline-action-group">
            <button
              className="button button-primary"
              type="submit"
              disabled={leadSubmitting}
            >
              {leadSubmitting ? "Guardando…" : "Avisarme"}
            </button>
            <Link className="button button-secondary" to="/articles">
              Volver al catalogo
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
