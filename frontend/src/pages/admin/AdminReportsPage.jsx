import { useEffect, useMemo, useState } from 'react';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import ResponsiveFilterPanel from '../../components/ResponsiveFilterPanel.jsx';
import { useLookups } from '../../contexts/LookupsContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { apiDownload, apiFetch } from '../../lib/api.js';
import {
  REPORT_CATALOG,
  buildReportDownloadRequest,
  createReportFilters,
  getReportDefinition,
  getVisibleReportFields,
} from '../../lib/reports.js';

function optionListForField(field, lookups, lotOptions) {
  if (field.type === 'lot') {
    return lotOptions.map((option) => ({
      value: option.id,
      label: `${option.code} - ${option.name}`,
    }));
  }
  if (field.type === 'category') return lookups.categoryOptions.map(({ id, label }) => ({ value: id, label }));
  if (field.type === 'brand') return lookups.brandOptions.map(({ id, label }) => ({ value: id, label }));
  if (field.type === 'size') return lookups.sizeOptions.map(({ id, label }) => ({ value: id, label }));
  if (field.type === 'shipping') {
    return lookups.shippingMethodOptions.map(({ label }) => ({ value: label, label }));
  }
  return field.options || [];
}

function ReportField({ field, value, onChange, lookups, lotOptions }) {
  if (['select', 'lot', 'category', 'brand', 'size', 'shipping'].includes(field.type)) {
    return (
      <label className="field-group">
        <span>{field.label}</span>
        <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Todos</option>
          {optionListForField(field, lookups, lotOptions).map((option) => (
            <option key={`${field.key}-${option.value}`} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="field-group">
      <span>{field.label}</span>
      <input
        className="input"
        type={field.type}
        min={field.min}
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function AdminReportsPage() {
  const lookups = useLookups();
  const { notifyError, notifySuccess } = useNotification();
  const [selectedReportId, setSelectedReportId] = useState(REPORT_CATALOG[0].id);
  const [filters, setFilters] = useState(() => createReportFilters(REPORT_CATALOG[0].id));
  const [format, setFormat] = useState('xlsx');
  const [lotOptions, setLotOptions] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const selectedReport = getReportDefinition(selectedReportId);
  const visibleFields = useMemo(
    () => getVisibleReportFields(selectedReportId, filters),
    [filters, selectedReportId],
  );

  useEffect(() => {
    let ignore = false;
    apiFetch('/api/admin/article-lots/options?includeArchived=true')
      .then((response) => {
        if (!ignore) setLotOptions(response.items || []);
      })
      .catch(() => {
        if (!ignore) setLotOptions([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function selectReport(reportId) {
    setSelectedReportId(reportId);
    setFilters(createReportFilters(reportId));
    setFormat('xlsx');
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function downloadReport() {
    if (downloading) return;
    try {
      setDownloading(true);
      const request = buildReportDownloadRequest(selectedReportId, filters, format);
      await apiDownload(request.path, { extension: request.extension });
      notifySuccess(`${selectedReport.title}: archivo ${format.toUpperCase()} generado.`);
    } catch (error) {
      notifyError(error.message || 'No se pudo generar el reporte.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="container page-stack admin-page-shell admin-reports-page">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>Reportes</h1>
            <p className="muted-copy">Seleccioná un reporte, ajustá sus filtros y descargalo en el formato que necesites.</p>
          </div>
        </div>

        <div className="reports-catalog" aria-label="Reportes disponibles">
          {REPORT_CATALOG.map((report) => {
            const selected = report.id === selectedReportId;
            return (
              <button
                key={report.id}
                type="button"
                aria-pressed={selected}
                className={selected ? 'report-card is-selected' : 'report-card'}
                onClick={() => selectReport(report.id)}
              >
                <strong>{report.title}</strong>
                <span>{report.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section-card page-stack reports-configuration" aria-labelledby="selected-report-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Configurar reporte</p>
            <h2 id="selected-report-title">{selectedReport.title}</h2>
            <p className="muted-copy">{selectedReport.description}</p>
          </div>
        </div>

        <ResponsiveFilterPanel
          key={selectedReportId}
          title={`Filtros de ${selectedReport.title.toLowerCase()}`}
          buttonLabel="Configurar reporte"
          applyLabel={downloading ? 'Generando...' : 'Descargar reporte'}
          clearLabel="Limpiar filtros"
          defaultOpen
          onApply={downloadReport}
          onClear={() => {
            setFilters(createReportFilters(selectedReportId));
            setFormat('xlsx');
          }}
        >
          <div className="admin-filter-grid reports-filter-grid">
            {visibleFields.map((field) => (
              <ReportField
                key={field.key}
                field={field}
                value={filters[field.key] ?? ''}
                onChange={(value) => updateFilter(field.key, value)}
                lookups={lookups}
                lotOptions={lotOptions}
              />
            ))}
            <label className="field-group report-format-field">
              <span>Formato</span>
              <select className="input" value={format} onChange={(event) => setFormat(event.target.value)}>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
            </label>
          </div>
        </ResponsiveFilterPanel>
      </section>
    </div>
  );
}
