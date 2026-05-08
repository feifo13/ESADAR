import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useMobileMenu } from "../../contexts/MobileMenuContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { notifyFormStatus } from "../../lib/validation.js";

const ARTICLE_STATUS_LABELS = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  RESERVED: "Reservada",
  SOLD_OUT: "Agotada",
};

const STOCK_ADJUSTMENT_REASONS = [
  "Ingreso inicial",
  "Reposicion",
  "Correccion de inventario",
  "Dano / baja",
  "Perdida",
  "Devolucion",
  "Ajuste administrativo",
];

function normalizeLabel(value) {
  return String(value || "").trim();
}

export default function AdminArticleStockPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notifyMobileStatus } = useMobileMenu();
  const [article, setArticle] = useState(null);
  const [form, setForm] = useState({
    quantityAvailable: "",
    reason: STOCK_ADJUSTMENT_REASONS[1],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadArticle() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/articles/${id}`);
        if (ignore) return;
        setArticle(response.article);
        setForm((current) => ({
          ...current,
          quantityAvailable: String(response.article?.quantityAvailable ?? 0),
        }));
      } catch (err) {
        if (!ignore) {
          const errorMessage = err.message || "No se pudo cargar el articulo";
          setError(errorMessage);
          notifyFormStatus(notifyMobileStatus, "error", errorMessage);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();

    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleSubmit(event) {
    event.preventDefault();

    const quantityAvailable = Number(form.quantityAvailable);
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
      const errorMessage = "El nuevo stock disponible debe ser un numero entero mayor o igual a cero.";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/articles/${id}/stock-adjustments`,
        {
          method: "POST",
          body: {
            quantityAvailable,
            reason: normalizeLabel(form.reason) || "Ajuste administrativo",
          },
        },
      );
      setArticle(response.article);
      setForm((current) => ({
        ...current,
        quantityAvailable: String(response.article?.quantityAvailable ?? quantityAvailable),
      }));
      const successMessage = "Stock ajustado correctamente.";
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
    } catch (err) {
      const errorMessage = err.message || "No se pudo ajustar el stock";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container section-card centered-card">
        Cargando articulo...
      </div>
    );
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Inventario</p>
            <h1>Ajustar stock</h1>
          </div>
          <div className="toolbar-inline toolbar-inline-end">
            <Link to={`/admin/articles/${id}/edit`} className="ghost-button linklike">
              Editar articulo
            </Link>
            <Link to="/admin/articles" className="ghost-button linklike">
              Volver
            </Link>
          </div>
        </div>

        {error ? <div className="error-copy">{error}</div> : null}
        {message ? <div className="success-copy">{message}</div> : null}

        {article ? (
          <div className="admin-detail-grid">
            <form className="section-card nested-card page-stack" onSubmit={handleSubmit}>
              <div>
                <p className="section-kicker">Stock</p>
                <h2>Movimiento manual</h2>
                <p className="muted-copy">
                  Reservado y vendido se actualizan automaticamente por ordenes.
                </p>
              </div>

              <div className="admin-kpi-grid">
                <div className="nested-card admin-kpi-card">
                  <span>Total</span>
                  <strong>{article.quantityTotal}</strong>
                </div>
                <div className="nested-card admin-kpi-card">
                  <span>Disponible</span>
                  <strong>{article.quantityAvailable}</strong>
                </div>
                <div className="nested-card admin-kpi-card">
                  <span>Reservado</span>
                  <strong>{article.quantityReserved}</strong>
                </div>
                <div className="nested-card admin-kpi-card">
                  <span>Vendido</span>
                  <strong>{article.quantitySold}</strong>
                </div>
              </div>

              <div className="form-grid-two">
                <label className="field-group">
                  <span>Nuevo stock disponible</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.quantityAvailable}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        quantityAvailable: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="field-group">
                  <span>Motivo</span>
                  <select
                    className="input"
                    value={form.reason}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                  >
                    {STOCK_ADJUSTMENT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {article.status === "INACTIVE" ? (
                <div className="inline-note">
                  Este articulo esta inactivo. Ajustar stock no lo activa automaticamente.
                </div>
              ) : null}

              <div className="toolbar-inline toolbar-inline-end">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => navigate("/admin/articles")}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar ajuste"}
                </button>
              </div>
            </form>

            <aside className="section-card nested-card page-stack-sm admin-detail-panel">
              <SmartImage
                src={
                  article.primaryImageDetail ||
                  article.primaryImageThumb ||
                  article.primaryImage
                }
                alt={article.primaryImageAlt || article.title}
                fallbackLabel={article.title}
                className="image-manager-card__media"
              />
              <div className="cell-stack">
                <strong>{article.title}</strong>
                <span className="muted-copy">
                  Codigo: {article.internalCode || "Sin codigo"}
                </span>
                <StatusBadge
                  status={article.status}
                  labels={ARTICLE_STATUS_LABELS}
                />
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}
