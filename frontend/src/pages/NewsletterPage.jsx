import { useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useLookups } from "../contexts/LookupsContext.jsx";
import { apiFetch } from "../lib/api.js";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import {
  firstValidationMessage,
  getEmailValidationMessage,
  getFriendlyErrorMessage,
  getRequiredSelectValidationMessage,
  getRequiredValidationMessage,
  notifyFormStatus,
} from "../lib/validation.js";

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
  const { notifyMobileStatus } = useMobileMenu();
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
      const validationMessage = firstValidationMessage(
        getRequiredValidationMessage(leadForm.firstName, "el nombre"),
        getRequiredValidationMessage(leadForm.email, "el email"),
        getEmailValidationMessage(leadForm.email),
        getRequiredValidationMessage(leadForm.phone, "el WhatsApp"),
        getRequiredSelectValidationMessage(
          leadForm.preferredCategory,
          "la categoría",
        ),
        getRequiredSelectValidationMessage(leadForm.preferredBrand, "la marca"),
        getRequiredSelectValidationMessage(leadForm.preferredSize, "el talle"),
      );
      if (validationMessage) {
        setLeadError(validationMessage);
        notifyFormStatus(notifyMobileStatus, "error", validationMessage, { focusInvalidRoot: event.currentTarget });
        return;
      }
      setLeadSubmitting(true);
      setLeadError("");
      setLeadSuccess("");

      await apiFetch("/api/public/leads/newsletter", {
        method: "POST",
        body: {
          firstName: leadForm.firstName,
          email: leadForm.email,
          phone: leadForm.phone,
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

      const successMessage =
        "Te vamos a avisar cuando entren prendas que encajen con tu estilo.";
      setLeadSuccess(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
      setLeadForm(initialLeadForm);
    } catch (err) {
      const errorMessage = getFriendlyErrorMessage(
        err,
        "No pudimos guardar tu preferencia ahora.",
      );
      setLeadError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setLeadSubmitting(false);
    }
  }

  return (
    <div className="container page-stack newsletter-page-shell">
      <SeoHead
        title="ESADAR | Avisos de ropa nueva"
        description="Recibi avisos cuando entren prendas segun tus preferencias."
      />

      {/* <nav className="breadcrumb-row" aria-label="Breadcrumb">
        <Link to="/">Inicio</Link>
        <span>/</span>
        <strong>Avisos de ropa nueva</strong>
      </nav> */}

      <section className="section-card page-stack lead-capture-card lead-capture-card--page">
        <div className="lead-capture-copy">
          <p className="section-kicker">¡Ey!</p>
          <h1>¿Querés enterarte cuando entra ropa nueva?</h1>
          <p className="muted-copy">
            Te avisaremos cuando aparezcan nuevos ingresos que se adapten a tus
            gustos.
          </p>
        </div>

        <form
          className="lead-capture-form"
          onSubmit={handleLeadSubmit}
          noValidate
        >
          <div className="form-grid-two">
            <label className="field-group">
              <span>Nombre</span>
              <input
                className="input"
                name="firstName"
                value={leadForm.firstName}
                onChange={(event) =>
                  updateLeadField("firstName", event.target.value)
                }
                required
              />
            </label>
            <label className="field-group">
              <span>Email</span>
              <input
                className="input"
                type="email"
                name="email"
                value={leadForm.email}
                onChange={(event) =>
                  updateLeadField("email", event.target.value)
                }
                required
              />
            </label>
            <label className="field-group">
              <span>WhatsApp</span>
              <input
                className="input"
                name="phone"
                value={leadForm.phone}
                onChange={(event) =>
                  updateLeadField("phone", event.target.value)
                }
                required
              />
            </label>
            <label className="field-group">
              <span>Instagram</span>
              <input
                className="input"
                name="instagram"
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
                name="preferredCategory"
                value={leadForm.preferredCategory}
                onChange={(event) =>
                  updateLeadField("preferredCategory", event.target.value)
                }
                required
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
                name="preferredBrand"
                value={leadForm.preferredBrand}
                onChange={(event) =>
                  updateLeadField("preferredBrand", event.target.value)
                }
                required
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
                name="preferredSize"
                value={leadForm.preferredSize}
                onChange={(event) =>
                  updateLeadField("preferredSize", event.target.value)
                }
                required
              >
                <option value="">Sin preferencia</option>
                {sizeOptions.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {/* <label className="field-group">
              <span>Color</span>
              <input
                className="input"
                value={leadForm.preferredColor}
                onChange={(event) =>
                  updateLeadField("preferredColor", event.target.value)
                }
                placeholder="Ej: negro, azul, neutros"
                required
              />
            </label> */}
          </div>

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
