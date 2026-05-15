import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { focusValidationTarget } from "../../lib/validation.js";
import AppLoader from "../../components/AppLoader.jsx";

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
  const { notifySuccess, notifyError } = useNotification();
  const [article, setArticle] = useState(null);
  const [form, setForm] = useState({
    quantityAvailable: "",
    reason: STOCK_ADJUSTMENT_REASONS[1],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadArticle() {
      try {
        setLoading(true);
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
          notifyError(errorMessage);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();

    return () => {
      ignore = true;
    };
  }, [id, notifyError]);

  async function handleSubmit(event) {
    event.preventDefault();

    const quantityAvailable = Number(form.quantityAvailable);
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
      const errorMessage = "El nuevo stock disponible debe ser un numero entero mayor o igual a cero.";
      focusValidationTarget("stock-quantity-available", event.currentTarget);
      notifyError(errorMessage);
      return;
    }

    try {
      setSaving(true);
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
      notifySuccess(successMessage);
    } catch (err) {
      const errorMessage = err.message || "No se pudo ajustar el stock";
      notifyError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container section-card centered-card">
        <AppLoader variant="card" label="Cargando artículo" />
      </div>
    );
  }

  const currentAvailable = Number(article?.quantityAvailable || 0);
  const nextAvailable = Number(form.quantityAvailable);
  const hasValidNextAvailable =
    Number.isFinite(nextAvailable) &&
    Number.isInteger(nextAvailable) &&
    nextAvailable >= 0;
  const stockDelta = hasValidNextAvailable ? nextAvailable - currentAvailable : 0;
  const stockDeltaLabel =
    stockDelta > 0 ? `+${stockDelta}` : String(stockDelta);

  return (
    <div className="container page-stack admin-page-shell admin-stock-page">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Inventario</p>
            <h1>Ajustar stock</h1>
            {article ? (
              <p className="muted-copy">
                {article.title} · {article.internalCode || "Sin código"}
              </p>
            ) : null}
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

        {article ? (
          <div className="admin-detail-grid admin-stock-layout">
            <form
              className="section-card nested-card page-stack admin-stock-form-card"
              onSubmit={handleSubmit}
            >
              <div>
                <p className="section-kicker">Stock</p>
                <h2>Movimiento manual</h2>
                <p className="muted-copy">
                  Reservado y vendido se actualizan automáticamente por órdenes.
                </p>
              </div>

              <div className="admin-stock-kpi-grid">
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

              <div className="form-grid-two admin-stock-form-grid">
                <label className="field-group">
                  <span>Nuevo stock disponible</span>
                  <input
                    className="input"
                    name="stock-quantity-available"
                    data-validation-field="stock-quantity-available"
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
                  <span className="field-helper">
                    Guardar registra un movimiento de stock manual.
                  </span>
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

              <div className="admin-stock-movement-preview">
                <span>Movimiento</span>
                <strong
                  className={[
                    "admin-stock-delta",
                    stockDelta > 0 ? "is-positive" : "",
                    stockDelta < 0 ? "is-negative" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {hasValidNextAvailable ? stockDeltaLabel : "Pendiente"}
                </strong>
              </div>

              {article.status === "INACTIVE" ? (
                <div className="inline-note">
                  Este artículo está inactivo. Ajustar stock no lo activa automáticamente.
                </div>
              ) : null}

              <div className="toolbar-inline toolbar-inline-end admin-stock-actions">
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

            <aside className="section-card nested-card page-stack-sm admin-detail-panel admin-stock-summary-card">
              <SmartImage
                src={
                  article.primaryImageDetail ||
                  article.primaryImageThumb ||
                  article.primaryImage
                }
                alt={article.primaryImageAlt || article.title}
                fallbackLabel={article.title}
                className="admin-stock-summary-image"
              />
              <div className="cell-stack admin-stock-summary-copy">
                <strong>{article.title}</strong>
                <span className="muted-copy">
                  Código: {article.internalCode || "Sin código"}
                </span>
                <StatusBadge
                  status={article.status}
                  labels={ARTICLE_STATUS_LABELS}
                />
              </div>
              <div className="admin-detail-meta">
                <div className="inline-note">
                  Disponible actual: <strong>{article.quantityAvailable}</strong>
                </div>
                <div className="inline-note">
                  Reservado: <strong>{article.quantityReserved}</strong> · Vendido:{" "}
                  <strong>{article.quantitySold}</strong>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}
