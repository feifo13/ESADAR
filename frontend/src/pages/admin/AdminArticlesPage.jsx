import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminPagination from '../../components/admin/AdminPagination.jsx';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import SmartImage from '../../components/SmartImage.jsx';
import { useLookups } from '../../contexts/LookupsContext.jsx';
import { apiDownload, apiFetch } from '../../lib/api.js';
import { formatCurrency } from '../../lib/format.js';
import { buildQueryString } from '../../lib/query.js';

const ARTICLE_STATUS_LABELS = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
  RESERVED: 'Reservada',
  SOLD_OUT: 'Agotada',
};

const initialFilters = {
  q: '',
  status: '',
  categoryId: '',
  brandId: '',
  sizeId: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'intakeDate',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function AdminArticlesPage() {
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const totalPages = Math.max(
    1,
    Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || filters.pageSize || 25)),
  );

  const activeQuery = useMemo(() => buildQueryString(filters), [filters]);

  useEffect(() => {
    let ignore = false;

    async function loadArticles() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch(`/api/admin/articles?${activeQuery}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar articulos');
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

  async function handleExport(format) {
    try {
      setExportingFormat(format);
      setError('');
      setMessage('');
      const query = buildQueryString({ ...filters, format });
      await apiDownload(`/api/admin/articles/export?${query}`);
      setMessage(`Exportacion ${format.toUpperCase()} generada correctamente.`);
    } catch (err) {
      setError(err.message || 'No se pudo exportar el catalogo');
    } finally {
      setExportingFormat('');
    }
  }

  async function handlePreviewImport() {
    if (!importFile) {
      setError('Selecciona un archivo CSV o XLSX antes de previsualizar.');
      return;
    }

    try {
      setPreviewLoading(true);
      setError('');
      setMessage('');
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('updateExisting', updateExisting ? 'true' : 'false');
      const response = await apiFetch('/api/admin/articles/import/preview', {
        method: 'POST',
        body: formData,
      });
      setPreview(response);
    } catch (err) {
      setError(err.message || 'No se pudo generar la previsualizacion');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRunImport() {
    if (!importFile) {
      setError('Selecciona un archivo CSV o XLSX antes de importar.');
      return;
    }

    try {
      setImporting(true);
      setError('');
      setMessage('');
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('updateExisting', updateExisting ? 'true' : 'false');
      const response = await apiFetch('/api/admin/articles/import', {
        method: 'POST',
        body: formData,
      });

      setMessage(
        `Importacion lista. Creados: ${response.summary?.rowsCreated || 0}, actualizados: ${response.summary?.rowsUpdated || 0}, omitidos: ${response.summary?.rowsSkipped || 0}, errores: ${response.summary?.rowsFailed || 0}.`,
      );
      setPreview(null);
      setImportFile(null);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setError(err.message || 'No se pudo completar la importacion');
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
            <p className="muted-copy">Busqueda, filtros reales, importacion batch y exportacion del catalogo.</p>
          </div>

          <div className="toolbar-inline toolbar-inline-end">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => handleExport('csv')}
              disabled={Boolean(exportingFormat)}
            >
              {exportingFormat === 'csv' ? 'Exportando CSV...' : 'Exportar CSV'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => handleExport('xlsx')}
              disabled={Boolean(exportingFormat)}
            >
              {exportingFormat === 'xlsx' ? 'Exportando XLSX...' : 'Exportar XLSX'}
            </button>
            <Link to="/admin/articles/new" className="button button-primary">Nuevo articulo</Link>
          </div>
        </div>

        <div className="admin-filter-grid">
          <label className="field-group">
            <span>Buscar</span>
            <input
              className="input"
              placeholder="Titulo, codigo, categoria, marca"
              value={draftFilters.q}
              onChange={(event) => updateDraft('q', event.target.value)}
            />
          </label>

          <label className="field-group">
            <span>Estado</span>
            <select className="input" value={draftFilters.status} onChange={(event) => updateDraft('status', event.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVE">Activas</option>
              <option value="INACTIVE">Inactivas</option>
              <option value="RESERVED">Reservadas</option>
              <option value="SOLD_OUT">Agotadas</option>
            </select>
          </label>

          <label className="field-group">
            <span>Categoria</span>
            <select className="input" value={draftFilters.categoryId} onChange={(event) => updateDraft('categoryId', event.target.value)}>
              <option value="">Todas</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Marca</span>
            <select className="input" value={draftFilters.brandId} onChange={(event) => updateDraft('brandId', event.target.value)}>
              <option value="">Todas</option>
              {brandOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Talle</span>
            <select className="input" value={draftFilters.sizeId} onChange={(event) => updateDraft('sizeId', event.target.value)}>
              <option value="">Todos</option>
              {sizeOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Desde</span>
            <input className="input" type="date" value={draftFilters.dateFrom} onChange={(event) => updateDraft('dateFrom', event.target.value)} />
          </label>

          <label className="field-group">
            <span>Hasta</span>
            <input className="input" type="date" value={draftFilters.dateTo} onChange={(event) => updateDraft('dateTo', event.target.value)} />
          </label>

          <label className="field-group">
            <span>Orden</span>
            <select className="input" value={draftFilters.sortBy} onChange={(event) => updateDraft('sortBy', event.target.value)}>
              <option value="intakeDate">Ingreso</option>
              <option value="title">Titulo</option>
              <option value="internalCode">Codigo</option>
              <option value="discountedPrice">Precio final</option>
              <option value="salePrice">Precio base</option>
              <option value="quantityAvailable">Stock disponible</option>
              <option value="status">Estado</option>
              <option value="categoryName">Categoria</option>
              <option value="brandName">Marca</option>
            </select>
          </label>

          <label className="field-group">
            <span>Direccion</span>
            <select className="input" value={draftFilters.sortDir} onChange={(event) => updateDraft('sortDir', event.target.value)}>
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </label>

          <label className="field-group">
            <span>Page size</span>
            <select className="input" value={draftFilters.pageSize} onChange={(event) => changePageSize(event.target.value)}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>

        <div className="toolbar-inline">
          <button type="button" className="button button-primary" onClick={applyFilters}>Aplicar filtros</button>
          <button type="button" className="button button-secondary" onClick={clearFilters}>Limpiar</button>
        </div>

        <div className="section-card nested-card page-stack">
          <div className="section-heading section-heading-wrap">
            <div>
              <p className="section-kicker">Batch</p>
              <h2>Importar articulos</h2>
            </div>
            <p className="muted-copy">Compatible con CSV y XLSX. El import no se corta si alguna fila falla.</p>
          </div>

          <div className="admin-import-grid">
            <label className="field-group">
              <span>Archivo</span>
              <input
                className="input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  setImportFile(nextFile);
                  setPreview(null);
                }}
              />
            </label>

            <label className="field-group checkbox-field">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(event) => setUpdateExisting(event.target.checked)}
              />
              <span>Actualizar por codigo si ya existe</span>
            </label>
          </div>

          <div className="toolbar-inline">
            <button type="button" className="button button-secondary" onClick={handlePreviewImport} disabled={previewLoading || importing}>
              {previewLoading ? 'Generando preview...' : 'Previsualizar'}
            </button>
            <button type="button" className="button button-primary" onClick={handleRunImport} disabled={importing || previewLoading}>
              {importing ? 'Importando...' : 'Confirmar importacion'}
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
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.rows || []).map((row) => (
                      <tr key={`${row.rowNumber}-${row.internalCode}`}>
                        <td>{row.rowNumber}</td>
                        <td>{row.action}</td>
                        <td>{row.internalCode || 'Sin codigo'}</td>
                        <td>{row.title || 'Sin titulo'}</td>
                        <td>{row.errors?.length ? row.errors.join(' | ') : 'Sin errores'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {message ? <p className="success-copy">{message}</p> : null}
        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando...</div> : null}

        {!loading ? (
          <div className="admin-list">
            {items.map((article) => {
              const categoryName = article.category?.name || 'Sin categoria';
              const brandName = article.brand?.name || 'Sin marca';
              const sizeName = article.size?.code || article.sizeText || 'Sin talle';

              return (
                <article key={article.id} className="admin-row-card admin-row-card-wide">
                  <SmartImage src={article.primaryImage} alt={article.title} fallbackLabel={article.title} />

                  <div className="page-stack stack-gap-xs">
                    <div>
                      <p className="eyebrow">{categoryName} - {brandName}</p>
                      <h3>{article.title}</h3>
                    </div>
                    <p className="muted-copy">
                      Codigo: <strong>{article.internalCode}</strong> - Talle: {sizeName}
                    </p>
                    <p className="muted-copy">
                      Estado: {ARTICLE_STATUS_LABELS[article.status] || article.status} - Stock disponible: {article.quantityAvailable}
                    </p>
                  </div>

                  <div className="admin-row-actions">
                    <strong>{formatCurrency(article.discountedPrice || article.salePrice)}</strong>
                    <Link to={`/admin/articles/${article.id}/edit`} className="button button-secondary">Editar</Link>
                  </div>
                </article>
              );
            })}

            {!items.length ? (
              <div className="centered-card nested-card">
                <p className="muted-copy">No hay articulos para los filtros seleccionados.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <AdminPagination
          page={Number(filters.page || 1)}
          totalPages={totalPages}
          totalItems={Number(pagination.total || 0)}
          loading={loading}
          onPrevious={() => changePage(Math.max(1, Number(filters.page || 1) - 1))}
          onNext={() => changePage(Math.min(totalPages, Number(filters.page || 1) + 1))}
        />
      </section>
    </div>
  );
}
