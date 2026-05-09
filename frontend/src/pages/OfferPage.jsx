import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";
import { formatCurrency } from "../lib/format.js";
import { useSiteSeo } from "../contexts/SiteSeoContext.jsx";
import { toAbsoluteUrl } from "../lib/seo.js";
import ArticleImageGallery from "../components/ArticleImageGallery.jsx";
import ArticleCard from "../components/ArticleCard.jsx";
import ScrollRailControls from "../components/ScrollRailControls.jsx";
import { articlePath } from "../lib/routes.js";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import {
  focusValidationTarget,
  getAtLeastOneContactValidationMessage,
  getEmailValidationMessage,
  getPositiveNumberValidationMessage,
  getRequiredValidationMessage,
  notifyFormStatus,
} from "../lib/validation.js";

const initialGuest = {
  firstName: "",
  lastName: "",
  birthDate: "",
  email: "",
  phone: "",
  instagram: "",
};

export default function OfferPage() {
  const { slugOrId } = useParams();
  const relatedTrackRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const { site } = useSiteSeo();
  const { notifyMobileStatus } = useMobileMenu();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [guest, setGuest] = useState(initialGuest);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slugOrId]);

  useEffect(() => {
    let ignore = false;

    async function loadArticle() {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/public/articles/${slugOrId}`);
        if (ignore) return;
        setArticle(response.article);
        const relatedResponse = await apiFetch(
          "/api/public/articles?offerable=true&sort=intake_desc&page=1",
        );
        if (!ignore)
          setRelated(
            (relatedResponse.items || [])
              .filter((item) => item.id !== response.article.id)
              .slice(0, 8),
          );
      } catch (err) {
        if (!ignore) {
          setArticle(null);
          setError(
            err.message || "No se pudo cargar este articulo para ofertar.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      ignore = true;
    };
  }, [slugOrId]);

  function updateGuest(name, value) {
    setGuest((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit() {
    if (!article) return;

    try {
      const contactValidationMessage = !isAuthenticated
        ? getAtLeastOneContactValidationMessage(
            {
              email: guest.email,
              phone: guest.phone,
              instagram: guest.instagram,
            },
            "un email, telefono o Instagram",
          )
        : "";

      const validationChecks = [
        { target: "offer-first-name", message: !isAuthenticated ? getRequiredValidationMessage(guest.firstName, "el nombre") : "" },
        { target: "offer-last-name", message: !isAuthenticated ? getRequiredValidationMessage(guest.lastName, "el apellido") : "" },
        {
          target: guest.email ? "offer-email" : guest.phone ? "offer-phone" : "offer-email",
          message: contactValidationMessage,
        },
        { target: "offer-email", message: !isAuthenticated ? getEmailValidationMessage(guest.email) : "" },
        { target: "offer-amount", message: getPositiveNumberValidationMessage(offer, "una oferta") },
      ];
      const validationIssue = validationChecks.find((check) => Boolean(check.message));
      if (validationIssue) {
        setError(validationIssue.message);
        notifyFormStatus(notifyMobileStatus, "error", validationIssue.message);
        focusValidationTarget(validationIssue.target);
        return;
      }

      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        articleId: article.id,
        offeredAmount: Number(offer),
        message: message?.trim() || "Oferta enviada desde la web.",
      };

      if (!isAuthenticated) {
        payload.guest = {
          ...guest,
          birthDate: guest.birthDate || null,
          email: guest.email || null,
          phone: guest.phone || null,
          instagram: guest.instagram || null,
        };
      }

      const response = await apiFetch("/api/public/offers", {
        method: "POST",
        body: payload,
      });

      const successMessage = "Tu oferta quedo registrada. Te avisaremos cuando la respondamos.";
      setSuccess(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
      setOffer("");
      setMessage("");
      if (!isAuthenticated) setGuest(initialGuest);
    } catch (err) {
      const errorMessage = err.message || "No se pudo registrar la oferta";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container section-card centered-card">
        Cargando articulo…
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container section-card error-card">
        {error || "No se pudo cargar este articulo para ofertar."}
      </div>
    );
  }

  return (
    <div className="container article-page-shell page-stack offer-page">
      <SeoHead
        title={
          article?.title ? `Ofertar | ${article.title}` : "Ofertar | ESADAR"
        }
        description="Vista de oferta para una prenda de ESADAR."
        canonical={toAbsoluteUrl(
          `/articles/${article?.slug || slugOrId}/offer`,
          site,
        )}
        url={toAbsoluteUrl(
          `/articles/${article?.slug || slugOrId}/offer`,
          site,
        )}
        noindex
      />

      <section className="page-stack">
        <div className="detail-titlebar detail-titlebar-offer">
          <p className="section-kicker">¡Ofertá!</p>
          <h1>Estas ofertando por: {article.title}</h1>
        </div>

        <div className="ebay-article-layout ebay-article-layout--offer">
          <div className="ebay-article-layout__gallery">
            <ArticleImageGallery
              images={article.images}
              title={article.title}
              fallbackImage={article}
            />
          </div>

          <aside className="ebay-article-layout__sidebar section-card offer-sidebar-flat offer-sidebar-accent">
            <div className="page-stack-sm">
              <div className="page-stack-sm">
                <p className="section-kicker">¡Ofertá!</p>
                <h1>{article.title}</h1>
              </div>

              <div className="detail-meta-list">
                <div>
                  <span>Estado</span>
                  <strong>
                    <span className="status-badge status-available">
                      {article.conditionLabel || "Segunda mano seleccionada"}
                    </span>
                  </strong>
                </div>
                <div>
                  <span>Categoria</span>
                  <strong>{article.categoryName || "Sin categoria"}</strong>
                </div>
                <div>
                  <span>Talle</span>
                  <strong>
                    {article.sizeText || article.sizeCode || "No especificado"}
                  </strong>
                </div>
                <div>
                  <span>Marca</span>
                  <strong>{article.brandName || "Sin marca"}</strong>
                </div>
                <div>
                  <span>Medidas</span>
                  <strong>{article.measurementsText || "A confirmar"}</strong>
                </div>
                <div>
                  <span>Precio publicado</span>
                  <strong>{formatCurrency(article.salePrice)}</strong>
                </div>
                {article.description ? (
                  <div>
                    <span>Descripción de la prenda</span>
                    <strong>{article.description}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            {/* <div className="detail-pricing detail-pricing--hero offer-pricing-hero">
              <span className="article-mobile-cta__label">Precio publicado</span>
              <strong className="price-current price-current-large">{formatCurrency(article.salePrice)}</strong>
            </div> */}

            {/* {article.description ? (
              <p className="muted-copy">{article.description}</p>
            ) : null} */}

            {isAuthenticated ? (
              <div className="section-card nested-card">
                <p className="section-kicker">Cuenta autenticada</p>
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <p className="muted-copy">
                  {user.email || "Sin email"}{" "}
                  {user.phone ? `· ${user.phone}` : ""}
                </p>
              </div>
            ) : (
              <div className="form-grid-two">
                <label className="field-group">
                  <span>Nombre</span>
                  <input
                    className="input"
                    name="firstName"
                    data-validation-field="offer-first-name"
                    value={guest.firstName}
                    onChange={(event) =>
                      updateGuest("firstName", event.target.value)
                    }
                    required
                  />
                </label>
                <label className="field-group">
                  <span>Apellido</span>
                  <input
                    className="input"
                    name="lastName"
                    data-validation-field="offer-last-name"
                    value={guest.lastName}
                    onChange={(event) =>
                      updateGuest("lastName", event.target.value)
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
                    data-validation-field="offer-email"
                    value={guest.email}
                    onChange={(event) =>
                      updateGuest("email", event.target.value)
                    }
                  />
                </label>
                <label className="field-group">
                  <span>Telefono</span>
                  <input
                    className="input"
                    name="phone"
                    data-validation-field="offer-phone"
                    value={guest.phone}
                    onChange={(event) =>
                      updateGuest("phone", event.target.value)
                    }
                  />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Instagram</span>
                  <input
                    className="input"
                    name="instagram"
                    data-validation-field="offer-instagram"
                    value={guest.instagram}
                    onChange={(event) =>
                      updateGuest("instagram", event.target.value)
                    }
                  />
                </label>
              </div>
            )}

            <label className="field-group">
              <span>Tu oferta</span>
              <input
                type="number"
                min="1"
                className="input"
                name="offer"
                data-validation-field="offer-amount"
                value={offer}
                onChange={(event) => setOffer(event.target.value)}
                placeholder="Ej: 1200"
                required
              />
            </label>

            {/* <label className="field-group">
              <span>Mensaje</span>
              <textarea
                className="input textarea"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Cuentanos si quieres coordinar por algun canal o dejar un comentario."
                required
              />
            </label> */}

            <div className="detail-actions detail-actions--stacked">
              <button
                type="button"
                className="button button-primary button-compact"
                onClick={handleSubmit}
                disabled={submitting || !article.allowOffers}
              >
                {submitting ? "Enviando oferta…" : "Ofertar"}
              </button>

              <Link
                to={articlePath(article)}
                className="button button-secondary button-compact"
              >
                Volver al articulo
              </Link>
            </div>

            {!isAuthenticated ? (
              <p className="muted-copy">
                Si prefieres, tambien puedes <Link to="/login">ingresar</Link>{" "}
                antes de ofertar.
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="page-stack article-related-scroll-section article-offer-related-scroll-section">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Tambien permiten oferta</p>
            <h2>Mas prendas abiertas a negociacion</h2>
          </div>
          <ScrollRailControls targetRef={relatedTrackRef} />
        </div>

        <div ref={relatedTrackRef} className="article-grid article-horizontal-card-track">
          {related.map((item) => (
            <ArticleCard
              key={item.id}
              article={item}
              view="grid"
              variant="default"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
