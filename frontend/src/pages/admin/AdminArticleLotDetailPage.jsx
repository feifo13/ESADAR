import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiDownload, apiFetch } from "../../lib/api.js";
import { formatCurrency } from "../../lib/format.js";

const LOT_STATUS_LABELS = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

function SummaryMetric({ label, value, currency = false, suffix = "" }) {
  return (
    <div className="nested-card admin-kpi-card">
      <span>{label}</span>
      <strong>{currency ? formatCurrency(value) : `${value ?? 0}${suffix}`}</strong>
    </div>
  );
}

export default function AdminArticleLotDetailPage() {
  const { id } = useParams();
  const { notifyError, notifySuccess } = useNotification();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/article-lots/${id}/report`);
        if (!ignore) setReport(response);
      } catch (err) {
        if (!ignore) {
          const message = err.message || "No se pudo cargar el lote.";
          setError(message);
          notifyError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadReport();
    return () => {
      ignore = true;
    };
  }, [id]);

  async function exportProjection(format) {
    try {
      setExporting(format);
      await apiDownload(`/api/admin/article-lots/${id}/profit-projection/export?format=${format}`, {
        extension: format,
      });
      notifySuccess(`Export ${format.toUpperCase()} generado.`);
    } catch (err) {
      notifyError(err.message || "No se pudo exportar la proyeccion.");
    } finally {
      setExporting("");
    }
  }

  const lot = report?.lot;
  const summary = report?.summary || {};

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Lote</p>
            <h1>{lot ? `${lot.code} - ${lot.name}` : "Detalle de lote"}</h1>
            {lot ? <StatusBadge status={lot.status} labels={LOT_STATUS_LABELS} /> : null}
          </div>
          <div className="inline-action-group">
            <Link to={`/admin/articles?lotId=${id}`} className="button button-secondary">
              Ver articulos
            </Link>
            <Link to="/admin/article-lots" className="button button-secondary">
              Volver
            </Link>
          </div>
        </div>

        {loading ? <p className="muted-copy">Cargando lote...</p> : null}
        {error ? <p className="error-copy">{error}</p> : null}

        {lot ? (
          <div className="admin-detail-grid">
            <p><strong>Codigo:</strong> {lot.code}</p>
            <p><strong>Nombre:</strong> {lot.name}</p>
            <p><strong>Origen:</strong> {lot.sourceLabel || "-"}</p>
            <p><strong>Compra:</strong> {lot.acquisitionDate || "-"}</p>
            <p><strong>Llegada:</strong> {lot.arrivalDate || "-"}</p>
            <p><strong>Descripcion:</strong> {lot.description || "-"}</p>
            <p><strong>Notas:</strong> {lot.notes || "-"}</p>
          </div>
        ) : null}
      </section>

      {lot ? (
        <section className="section-card page-stack">
          <div className="section-heading section-heading-wrap">
            <div>
              <p className="section-kicker">Balance</p>
              <h2>Resumen economico</h2>
            </div>
            <div className="inline-action-group">
              <button type="button" className="button button-secondary" disabled={Boolean(exporting)} onClick={() => exportProjection("csv")}>
                {exporting === "csv" ? "Exportando..." : "Exportar CSV"}
              </button>
              <button type="button" className="button button-primary" disabled={Boolean(exporting)} onClick={() => exportProjection("xlsx")}>
                {exporting === "xlsx" ? "Exportando..." : "Exportar XLSX"}
              </button>
            </div>
          </div>

          <div className="admin-kpi-grid">
            <SummaryMetric label="Articulos" value={summary.articleCount} />
            <SummaryMetric label="Stock total" value={summary.stockTotal} />
            <SummaryMetric label="Disponible" value={summary.stockAvailable} />
            <SummaryMetric label="Vendido" value={summary.stockSold} />
            <SummaryMetric label="Costo compra" value={summary.totalPurchasePriceTotal} currency />
            <SummaryMetric label="Impuestos bancarios" value={summary.totalBankTax} currency />
            <SummaryMetric label="Costo total" value={summary.totalCost} currency />
            <SummaryMetric label="Precio efectivo" value={summary.totalEffectiveSalePrice} currency />
            <SummaryMetric label="Ganancia proyectada" value={summary.totalEstimatedProfit} currency />
            <SummaryMetric label="Margen proyectado" value={summary.weightedEstimatedMargin} suffix="%" />
            <SummaryMetric label="Con ganancia" value={summary.profitCount} />
            <SummaryMetric label="En perdida" value={summary.lossCount} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
