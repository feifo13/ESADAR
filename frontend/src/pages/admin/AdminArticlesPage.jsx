import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import SurfaceModal from "../../components/SurfaceModal.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { apiDownload, apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";

const ARTICLE_STATUS_LABELS = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  RESERVED: "Reservada",
  SOLD_OUT: "Agotada",
};

const initialFilters = {
  q: "",
  status: "",
  categoryId: "",
  brandId: "",
  sizeId: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "intakeDate",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

function formatPreviewList(values = []) {
  if (!values.length) return "Sin novedades";
  return values.join(" | ");
}

export default function AdminArticlesPage() {
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [createMissingLookups, setCreateMissingLookups] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [downloadingTemplate, setDownloadingTemplate] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(pagination.total || 0) /
        Number(pagination.pageSize || filters.pageSize || 25),
    ),
  );

  const activeQuery = useMemo(() => buildQueryString(filters), [filters]);
  const activeFiltersCount =
    [
      filters.q,
      filters.status,
      filters.categoryId,
      filters.brandId,
      filters.sizeId,
      filters.dateFrom,
      filters.dateTo,
    ].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadArticles() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/articles?${activeQuery}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) setError(err.message || "No se pudo cargar articulos");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticles();

    return () => {
      ignore = true;
    };
  }, [activeQuery, refreshNonce]);

  function updateDraft(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    setFilters((current) => ({
      ...current,
      ...draftFilters,
      page: 1,
    }));
  }

  function clearFilters() {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
  }

  function changePage(nextPage) {
    setFilters((current) => ({ ...current, page: nextPage }));
  }

  function changePageSize(nextPageSize) {
    const numericSize = Number(nextPageSize) || 25;
    setDraftFilters((current) => ({ ...current, pageSize: numericSize }));
    setFilters((current) => ({ ...current, pageSize: numericSize, page: 1 }));
  }

  function changeSort(sortBy) {
    const sortDir = filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setDraftFilters((current) => ({ ...current, sortBy, sortDir }));
    setFilters((current) => ({ ...current, sortBy, sortDir, page: 1 }));
  }

  async function handleExport(format) {
    try {
      setExportingFormat(format);
      setError("");
      setMessage("");
      const query = buildQueryString({ ...filters, format });
      const today = new Date().toISOString().slice(0, 10);
      await apiDownload(`/api/admin/articles/export?${query}`, {
        fileName: `esadar-articulos-${today}.${format}`,
        extension: format,
      });
      setMessage(`Exportacion ${format.toUpperCase()} generada correctamente.`);
    } catch (err) {
      setError(err.message || "No se pudo exportar el catalogo");
    } finally {
      setExportingFormat("");
    }
  }

  async function handleDownloadTemplate(format, type) {
    const key = `${type}-${format}`;

    try {
      setDownloadingTemplate(key);
      setError("");
      setMessage("");
      await apiDownload(
        `/api/admin/articles/import/template?format=${format}&type=${type}`,
        {
          fileName: `esadar-plantilla-${type}.${format}`,
          extension: format,
        },
      );
      setMessage(
        `Plantilla ${type === "simple" ? "simple" : "completa"} ${format.toUpperCase()} descargada.`,
      );
    } catch (err) {
      setError(err.message || "No se pudo descargar la plantilla");
    } finally {
      setDownloadingTemplate("");
    }
  }

  async function handlePreviewImport() {
    if (!importFile) {
      setError("Selecciona un archivo CSV o XLSX antes de previsualizar.");
      return;
    }

    try {
      setPreviewLoading(true);
      setError("");
      setMessage("");
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("updateExisting", updateExisting ? "true" : "false");
      formData.append(
        "createMissingLookups",
        createMissingLookups ? "true" : "false",
      );
      const response = await apiFetch("/api/admin/articles/import/preview", {
        method: "POST",
        body: formData,
      });
      setPreview(response);
    } catch (err) {
      setError(err.message || "No se pudo generar la previsualizacion");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRunImport() {
    if (!importFile) {
      setError("Selecciona un archivo CSV o XLSX antes de importar.");
      return;
    }

    try {
      setImporting(true);
      setError("");
      setMessage("");
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("updateExisting", updateExisting ? "true" : "false");
      formData.append(
        "createMissingLookups",
        createMissingLookups ? "true" : "false",
      );
      const response = await apiFetch("/api/admin/articles/import", {
        method: "POST",
        body: formData,
      });

      setMessage(
        `Importacion lista. Creados: ${response.summary?.rowsCreated || 0}, actualizados: ${response.summary?.rowsUpdated || 0}, omitidos: ${response.summary?.rowsSkipped || 0}, errores: ${response.summary?.rowsFailed || 0}, advertencias: ${response.summary?.warningsCount || 0}.`,
      );
      setPreview(null);
      setImportFile(null);
      setFileInputKey((current) => current + 1);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setError(err.message || "No se pudo completar la importacion");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Articulos</h1>
          </div>

          <div className="toolbar-inline toolbar-inline-end">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setImportModalOpen(true)}
            >
              Importar CSV/XLSX
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => handleExport("csv")}
              disabled={Boolean(exportingFormat)}
            >
              {exportingFormat === "csv" ? "Exportando CSV..." : "Exportar CSV"}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => handleExport("xlsx")}
              disabled={Boolean(exportingFormat)}
            >
              {exportingFormat === "xlsx"
                ? "Exportando XLSX..."
                : "Exportar XLSX"}
            </button>
            <Link
              to="/admin/articles/bulk-create"
              className="button button-secondary"
            >
              Crear multiples articulos desde UI
            </Link>
            <Link to="/admin/articles/new" className="button button-primary">
              Nuevo articulo
            </Link>
          </div>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de articulos"
          description=""
          buttonLabel="Mostrar filtros"
          summary={
            activeFiltersCount
              ? `${activeFiltersCount} filtro(s) activos`
              : "Sin filtros adicionales"
          }
          onApply={applyFilters}
          onClear={clearFilters}
        >
          <div className="admin-filter-grid">
            <label className="field-group">
              <span>Buscar</span>
              <input
                className="input"
                placeholder="Titulo, codigo, categoria, marca"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>Estado</span>
              <select
                className="input"
                value={draftFilters.status}
                onChange={(event) => updateDraft("status", event.target.value)}
              >
                <option value="">Todos</option>
                <option value="ACTIVE">Activas</option>
                <option value="INACTIVE">Inactivas</option>
                <option value="RESERVED">Reservadas</option>
                <option value="SOLD_OUT">Agotadas</option>
              </select>
            </label>

            <label className="field-group">
              <span>Categoria</span>
              <select
                className="input"
                value={draftFilters.categoryId}
                onChange={(event) =>
                  updateDraft("categoryId", event.target.value)
                }
              >
                <option value="">Todas</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Marca</span>
              <select
                className="input"
                value={draftFilters.brandId}
                onChange={(event) => updateDraft("brandId", event.target.value)}
              >
                <option value="">Todas</option>
                {brandOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Talle</span>
              <select
                className="input"
                value={draftFilters.sizeId}
                onChange={(event) => updateDraft("sizeId", event.target.value)}
              >
                <option value="">Todos</option>
                {sizeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Desde</span>
              <input
                className="input"
                type="date"
                value={draftFilters.dateFrom}
                onChange={(event) =>
                  updateDraft("dateFrom", event.target.value)
                }
              />
            </label>

            <label className="field-group">
              <span>Hasta</span>
              <input
                className="input"
                type="date"
                value={draftFilters.dateTo}
                onChange={(event) => updateDraft("dateTo", event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>Orden</span>
              <select
                className="input"
                value={draftFilters.sortBy}
                onChange={(event) => updateDraft("sortBy", event.target.value)}
              >
                <option value="intakeDate">Ingreso</option>
                <option value="title">Titulo</option>
                <option value="internalCode">Codigo</option>
                <option value="discountedPrice">Precio final</option>
                <option value="salePrice">Precio base</option>
                <option value="quantityAvailable">Stock disponible</option>
                <option value="status">Estado</option>
                <option value="categoryName">Categoria</option>
                <option value="brandName">Marca</option>
                <option value="updatedAt">Actualizacion</option>
              </select>
            </label>

            <label className="field-group">
              <span>Direccion</span>
              <select
                className="input"
                value={draftFilters.sortDir}
                onChange={(event) => updateDraft("sortDir", event.target.value)}
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </label>

            <label className="field-group">
              <span>Page size</span>
              <select
                className="input"
                value={draftFilters.pageSize}
                onChange={(event) => changePageSize(event.target.value)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
        </ResponsiveFilterPanel>

        <SurfaceModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title="Importar articulos"
          description="Carga CSV o XLSX sin ocupar espacio permanente del listado."
          wide
        >
          <div className="section-card nested-card page-stack">
            <div className="section-heading section-heading-wrap">
              <div>
                <p className="section-kicker">Batch</p>
                <h2>Importar articulos</h2>
                <p className="muted-copy">
                  Para carga rapida solo necesitas titulo y precio. El resto se
                  completa con valores seguros.
                </p>
              </div>
            </div>

            <div className="template-download-grid">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => handleDownloadTemplate("xlsx", "simple")}
                disabled={downloadingTemplate === "simple-xlsx"}
              >
                {downloadingTemplate === "simple-xlsx"
                  ? "Descargando..."
                  : "Descargar plantilla simple XLSX"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => handleDownloadTemplate("csv", "simple")}
                disabled={downloadingTemplate === "simple-csv"}
              >
                {downloadingTemplate === "simple-csv"
                  ? "Descargando..."
                  : "Descargar plantilla simple CSV"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => handleDownloadTemplate("xlsx", "full")}
                disabled={downloadingTemplate === "full-xlsx"}
              >
                {downloadingTemplate === "full-xlsx"
                  ? "Descargando..."
                  : "Descargar plantilla completa XLSX"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => handleDownloadTemplate("csv", "full")}
                disabled={downloadingTemplate === "full-csv"}
              >
                {downloadingTemplate === "full-csv"
                  ? "Descargando..."
                  : "Descargar plantilla completa CSV"}
              </button>
            </div>

            <div className="admin-import-grid">
              <label className="field-group">
                <span>Archivo</span>
                <input
                  key={fileInputKey}
                  className="input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    setImportFile(nextFile);
                    setPreview(null);
                  }}
                />
                <span className="field-helper">
                  {importFile
                    ? `Seleccionado: ${importFile.name}`
                    : "CSV o XLSX con columnas simples o completas."}
                </span>
              </label>

              <div className="page-stack stack-gap-sm">
                <label className="field-group checkbox-field checkbox-field-compact">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(event) =>
                      setUpdateExisting(event.target.checked)
                    }
                  />
                  <span>Actualizar por codigo si ya existe</span>
                </label>

                <label className="field-group checkbox-field checkbox-field-compact">
                  <input
                    type="checkbox"
                    checked={createMissingLookups}
                    onChange={(event) =>
                      setCreateMissingLookups(event.target.checked)
                    }
                  />
                  <span>Crear categorias, marcas y talles faltantes</span>
                </label>
              </div>
            </div>

            <div className="toolbar-inline">
              <button
                type="button"
                className="button button-secondary"
                onClick={handlePreviewImport}
                disabled={previewLoading || importing}
              >
                {previewLoading ? "Generando preview..." : "Previsualizar"}
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleRunImport}
                disabled={importing || previewLoading}
              >
                {importing ? "Importando..." : "Confirmar importacion"}
              </button>
            </div>

            {preview ? (
              <div className="page-stack">
                <div className="admin-kpi-grid">
                  <div className="nested-card admin-kpi-card">
                    <span>Filas recibidas</span>
                    <strong>{preview.summary?.rowsReceived || 0}</strong>
                  </div>
                  <div className="nested-card admin-kpi-card">
                    <span>Crear</span>
                    <strong>{preview.summary?.rowsCreated || 0}</strong>
                  </div>
                  <div className="nested-card admin-kpi-card">
                    <span>Actualizar</span>
                    <strong>{preview.summary?.rowsUpdated || 0}</strong>
                  </div>
                  <div className="nested-card admin-kpi-card">
                    <span>Omitir</span>
                    <strong>{preview.summary?.rowsSkipped || 0}</strong>
                  </div>
                  <div className="nested-card admin-kpi-card">
                    <span>Errores</span>
                    <strong>{preview.summary?.rowsFailed || 0}</strong>
                  </div>
                  <div className="nested-card admin-kpi-card">
                    <span>Advertencias</span>
                    <strong>{preview.summary?.warningsCount || 0}</strong>
                  </div>
                </div>

                <div className="inline-note">
                  Tipo detectado:{" "}
                  <strong>{preview.batchType || "Sin dato"}</strong>. La preview
                  muestra hasta 100 filas.
                </div>

                <div className="table-shell">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Accion</th>
                        <th>Codigo</th>
                        <th>Titulo</th>
                        <th>Errores</th>
                        <th>Advertencias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.rows || []).map((row) => (
                        <tr
                          key={`${row.rowNumber}-${row.internalCode || row.title || "row"}`}
                        >
                          <td>{row.rowNumber}</td>
                          <td>{row.action}</td>
                          <td>{row.internalCode || "Se genera automatico"}</td>
                          <td>{row.title || "Sin titulo"}</td>
                          <td>{formatPreviewList(row.errors || [])}</td>
                          <td>{formatPreviewList(row.warnings || [])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </SurfaceModal>

        {message ? <p className="success-copy">{message}</p> : null}
        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando...</div> : null}

        <AdminPagination
          className="pagination-row--top"
          page={Number(filters.page || 1)}
          totalPages={totalPages}
          totalItems={Number(pagination.total || 0)}
          loading={loading}
          onPrevious={() =>
            changePage(Math.max(1, Number(filters.page || 1) - 1))
          }
          onNext={() =>
            changePage(Math.min(totalPages, Number(filters.page || 1) + 1))
          }
        />

        {!loading ? (
          items.length ? (
            <div className="table-shell admin-table-shell">
              <table className="data-table admin-articles-table">
                <thead>
                  <tr>
                    <th>Imagen</th>
                    <SortableTh sortKey="title" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Articulo</SortableTh>
                    <SortableTh sortKey="categoryName" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Categoria</SortableTh>
                    <SortableTh sortKey="brandName" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Marca</SortableTh>
                    <th>Talle</th>
                    <SortableTh sortKey="discountedPrice" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Precio</SortableTh>
                    <SortableTh sortKey="quantityAvailable" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Stock</SortableTh>
                    <SortableTh sortKey="status" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Estado</SortableTh>
                    <SortableTh sortKey="updatedAt" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>Actualizado</SortableTh>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((article) => {
                    const categoryName =
                      article.category?.name || article.categoryName || "Sin categoria";
                    const brandName =
                      article.brand?.name || article.brandName || "Sin marca";
                    const sizeName =
                      article.size?.code ||
                      article.sizeText ||
                      article.sizeCode ||
                      "Sin talle";

                    return (
                      <tr key={article.id}>
                        <td>
                          <Link to={`/admin/articles/${article.id}/edit`} className="table-thumb-link" aria-label={`Editar ${article.title}`}>
                            <SmartImage
                              src={
                                article.primaryImageDetail ||
                                article.primaryImageThumb ||
                                article.primaryImage
                              }
                              alt={article.primaryImageAlt || article.title}
                              fallbackLabel={article.title}
                              className="table-thumb-image"
                            />
                          </Link>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <Link to={`/admin/articles/${article.id}/edit`} className="table-strong-link">
                              {article.title}
                            </Link>
                            <span className="muted-copy">Codigo: {article.internalCode || "Sin codigo"}</span>
                          </div>
                        </td>
                        <td>{categoryName}</td>
                        <td>{brandName}</td>
                        <td>{sizeName}</td>
                        <td>
                          <strong>{formatCurrency(article.discountedPrice || article.salePrice)}</strong>
                        </td>
                        <td>{article.quantityAvailable}</td>
                        <td><StatusBadge status={article.status} labels={ARTICLE_STATUS_LABELS} /></td>
                        <td>{formatDate(article.updatedAt || article.intakeDate)}</td>
                        <td>
                          <div className="table-actions">
                            <Link
                              to={`/admin/articles/${article.id}/edit`}
                              className="button button-secondary button-compact"
                            >
                              Editar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="centered-card nested-card">
              <p className="muted-copy">
                No hay articulos para los filtros seleccionados.
              </p>
            </div>
          )
        ) : null}

        <AdminPagination
          page={Number(filters.page || 1)}
          totalPages={totalPages}
          totalItems={Number(pagination.total || 0)}
          loading={loading}
          onPrevious={() =>
            changePage(Math.max(1, Number(filters.page || 1) - 1))
          }
          onNext={() =>
            changePage(Math.min(totalPages, Number(filters.page || 1) + 1))
          }
        />
      </section>
    </div>
  );
}
