import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminBatchSnackbar from "../../components/admin/AdminBatchSnackbar.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import {
  ArchiveIcon,
  BanIcon,
  CheckIcon,
  EditIcon,
  EyeIcon,
  StockIcon,
  XIcon,
} from "../../components/ActionIcons.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { useMobileMenu } from "../../contexts/MobileMenuContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiDownload, apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";
import { focusValidationTarget, notifyFormStatus } from "../../lib/validation.js";
import AppLoader from "../../components/AppLoader.jsx";

const ARTICLE_STATUS_LABELS = {
  DRAFT: "Borrador",
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  ARCHIVED: "Archivada",
  RESERVED: "Reservada",
  SOLD_OUT: "Agotada",
};

const STOCK_STATUS_LABELS = {
  ACTIVE: "Disponible",
  RESERVED: "Reservada",
  SOLD_OUT: "Agotada",
};

const STOCK_STATUS_FILTERS = new Set(["RESERVED", "SOLD_OUT"]);

const initialFilters = {
  q: "",
  status: "",
  featured: "",
  offerable: "",
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

function asBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes", "si", "sí"].includes(String(value || "").toLowerCase());
}

function normalizeArticleFlags(article) {
  if (!article) return article;
  return {
    ...article,
    isFeatured: asBooleanFlag(article.isFeatured),
    allowOffers: asBooleanFlag(article.allowOffers),
  };
}

function getPublicationStatus(article) {
  return article?.publicationStatus || article?.status || "ACTIVE";
}

function getStockStatus(article) {
  return article?.stockStatus || "ACTIVE";
}

function articleStillMatchesVisibleFilters(article, filters) {
  if (!article) return false;
  if (filters.status) {
    const visibleStatus = STOCK_STATUS_FILTERS.has(filters.status)
      ? getStockStatus(article)
      : getPublicationStatus(article);
    if (visibleStatus !== filters.status) return false;
  }
  if (filters.featured !== "" && asBooleanFlag(article.isFeatured) !== (filters.featured === "true")) return false;
  if (filters.offerable !== "" && asBooleanFlag(article.allowOffers) !== (filters.offerable === "true")) return false;
  return true;
}

function QuickToggle({ checked, label, onText, offText, onClick, disabled = false, pending = false }) {
  const stateText = checked ? onText : offText;

  return (
    <div className="quick-toggle-control">
      <span className="quick-toggle-control__label">{label}</span>
      <button
        type="button"
        className={[checked ? "quick-toggle-switch is-on" : "quick-toggle-switch", pending ? "is-pending" : ""].filter(Boolean).join(" ")}
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${pending ? "Actualizando" : stateText}`}
        title={`${label}: ${pending ? "Actualizando" : stateText}`}
        onClick={onClick}
        disabled={disabled || pending}
      >
        <span className="quick-toggle-switch__track" aria-hidden="true">
          <span className="quick-toggle-switch__thumb" />
        </span>
        <span className="quick-toggle-switch__state">{pending ? "..." : stateText}</span>
      </button>
    </div>
  );
}

export default function AdminArticlesPage() {
  const { user } = useAuth();
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();
  const { notifyMobileStatus } = useMobileMenu();
  const { notifySuccess, notifyError } = useNotification();
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
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [pendingToggles, setPendingToggles] = useState({});
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const isSuperAdmin = user?.roles?.includes("SUPER_ADMIN");

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
      filters.featured,
      filters.offerable,
      filters.categoryId,
      filters.brandId,
      filters.sizeId,
      filters.dateFrom,
      filters.dateTo,
    ].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);

  const selectedArticleIdSet = useMemo(
    () => new Set(selectedArticleIds),
    [selectedArticleIds],
  );
  const selectableArticleIds = useMemo(
    () => items.map((article) => article.id),
    [items],
  );
  const allSelectableArticlesChecked =
    selectableArticleIds.length > 0 &&
    selectableArticleIds.every((id) => selectedArticleIdSet.has(id));

  useEffect(() => {
    let ignore = false;

    async function loadArticles() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/articles?${activeQuery}`);
        if (ignore) return;
        setItems((response.items || []).map(normalizeArticleFlags));
        setPagination(
          response.pagination || { page: 1, pageSize: 25, total: 0 },
        );
      } catch (err) {
        if (!ignore) {
          const errorMessage = err.message || "No se pudo cargar artículos";
          setError(errorMessage);
          notifyFormStatus(notifyMobileStatus, "error", errorMessage);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticles();

    return () => {
      ignore = true;
    };
  }, [activeQuery, refreshNonce]);

  useEffect(() => {
    setSelectedArticleIds((current) =>
      current.filter((id) => items.some((article) => article.id === id)),
    );
  }, [items]);

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
    const sortDir =
      filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setDraftFilters((current) => ({ ...current, sortBy, sortDir }));
    setFilters((current) => ({ ...current, sortBy, sortDir, page: 1 }));
  }

  function toggleArticleSelection(articleId) {
    setSelectedArticleIds((current) =>
      current.includes(articleId)
        ? current.filter((id) => id !== articleId)
        : [...current, articleId],
    );
  }

  function toggleAllSelectableArticles() {
    setSelectedArticleIds((current) => {
      if (selectableArticleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !selectableArticleIds.includes(id));
      }
      return Array.from(new Set([...current, ...selectableArticleIds]));
    });
  }

  function clearSelection() {
    setSelectedArticleIds([]);
  }

  async function handleBatchArticles(action) {
    if (!selectedArticleIds.length) return;

    const actionLabels = {
      ACTIVATE: "activar",
      DEACTIVATE: "desactivar",
      FEATURE: "marcar como destacados",
      UNFEATURE: "quitar de destacados",
      ALLOW_OFFERS: "habilitar ofertas",
      DISALLOW_OFFERS: "deshabilitar ofertas",
    };

    const confirmed = window.confirm(
      `Vas a ${actionLabels[action] || "actualizar"} ${selectedArticleIds.length} artículo(s). ¿Continuar?`,
    );
    if (!confirmed) return;

    try {
      setBatchBusy(true);
      setError("");
      setMessage("");
      const response = await apiFetch("/api/admin/articles/batch", {
        method: "PATCH",
        body: { action, ids: selectedArticleIds },
      });

      const successMessage = `${response.succeeded || 0} artículo(s) procesado(s).${
        response.failed ? ` ${response.failed} con error.` : ""
      }`;
      if (response.failed) {
        notifyError(successMessage);
      } else {
        notifySuccess(successMessage);
      }
      clearSelection();
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo ejecutar la acción batch";
      notifyError(errorMessage);
      clearSelection();
    } finally {
      setBatchBusy(false);
    }
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
      const successMessage = `Exportacion ${format.toUpperCase()} generada correctamente.`;
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
    } catch (err) {
      const errorMessage = err.message || "No se pudo exportar el catálogo";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
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
      const successMessage = `Plantilla ${type === "simple" ? "simple" : "completa"} ${format.toUpperCase()} descargada.`;
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
    } catch (err) {
      const errorMessage = err.message || "No se pudo descargar la plantilla";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setDownloadingTemplate("");
    }
  }

  async function handlePreviewImport() {
    if (!importFile) {
      const errorMessage =
        "Selecciona un archivo CSV antes de previsualizar.";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      focusValidationTarget("articles-import-file");
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
      const errorMessage =
        err.message || "No se pudo generar la previsualizacion";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRunImport() {
    if (!importFile) {
      const errorMessage =
        "Selecciona un archivo CSV antes de importar.";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      focusValidationTarget("articles-import-file");
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

      const successMessage = `Importacion lista. Creados: ${response.summary?.rowsCreated || 0}, actualizados: ${response.summary?.rowsUpdated || 0}, omitidos: ${response.summary?.rowsSkipped || 0}, errores: ${response.summary?.rowsFailed || 0}, advertencias: ${response.summary?.warningsCount || 0}.`;
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
      setPreview(null);
      setImportFile(null);
      setFileInputKey((current) => current + 1);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const errorMessage = err.message || "No se pudo completar la importacion";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setImporting(false);
    }
  }

  async function handleSoftDeleteArticle(article) {
    try {
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/articles/${article.id}/status`,
        {
          method: "PATCH",
          body: { status: "INACTIVE" },
        },
      );
      const nextArticle = normalizeArticleFlags({
        ...article,
        ...(response.article || {}),
        status: response.article?.status || "INACTIVE",
      });
      setItems((current) => {
        const nextItems = articleStillMatchesVisibleFilters(nextArticle, filters)
          ? current.map((item) => (Number(item.id) === Number(article.id) ? nextArticle : item))
          : current.filter((item) => Number(item.id) !== Number(article.id));
        if (nextItems.length < current.length) {
          setPagination((currentPagination) => ({
            ...currentPagination,
            total: Math.max(0, Number(currentPagination.total || 0) - 1),
          }));
        }
        return nextItems;
      });
      const successMessage = "El artículo fue enviado a inactivos.";
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
    } catch (err) {
      const errorMessage = err.message || "No se pudo desactivar el artículo.";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    }
  }


  async function handleDeleteArticle(article) {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente el artículo "${article.title}"? Esta acción solo se permite si no tiene órdenes, ofertas ni movimientos históricos vinculados.`,
    );
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      await apiFetch(`/api/admin/articles/${article.id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => Number(item.id) !== Number(article.id)));
      const successMessage = "El artículo fue eliminado correctamente.";
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);
    } catch (err) {
      const errorMessage =
        err.message ||
        "No se puede eliminar porque tiene movimientos/órdenes/ofertas asociadas. Se recomienda desactivarlo.";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    }
  }

  async function handleQuickToggle(article, field) {
    const config = {
      status: {
        payload: {
          status: getPublicationStatus(article) === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        },
        success:
          getPublicationStatus(article) === "ACTIVE"
            ? "Artículo desactivado correctamente."
            : "Artículo activado correctamente.",
        fallbackError: "No se pudo actualizar el estado del artículo.",
      },
      isFeatured: {
        payload: { isFeatured: !asBooleanFlag(article.isFeatured) },
        success: !asBooleanFlag(article.isFeatured)
          ? "Artículo marcado como destacado."
          : "Artículo quitado de destacados.",
        fallbackError: "No se pudo actualizar destacado.",
      },
      allowOffers: {
        payload: { allowOffers: !asBooleanFlag(article.allowOffers) },
        success: !asBooleanFlag(article.allowOffers)
          ? "El artículo ahora acepta ofertas."
          : "El artículo ya no acepta ofertas.",
        fallbackError: "No se pudo actualizar aceptación de ofertas.",
      },
    }[field];

    if (!config) return;

    const pendingKey = `${article.id}:${field}`;

    try {
      setPendingToggles((current) => ({ ...current, [pendingKey]: true }));
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/articles/${article.id}/quick-flags`,
        {
          method: "PATCH",
          body: config.payload,
        },
      );

      const nextArticle = normalizeArticleFlags({ ...article, ...(response.article || {}) });
      setItems((current) => {
        const nextItems = articleStillMatchesVisibleFilters(nextArticle, filters)
          ? current.map((item) => (Number(item.id) === Number(article.id) ? nextArticle : item))
          : current.filter((item) => Number(item.id) !== Number(article.id));
        if (nextItems.length < current.length) {
          setPagination((currentPagination) => ({
            ...currentPagination,
            total: Math.max(0, Number(currentPagination.total || 0) - 1),
          }));
        }
        return nextItems;
      });
      setMessage(config.success);
      notifySuccess(config.success);
    } catch (err) {
      const errorMessage = err.message || config.fallbackError;
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setPendingToggles((current) => {
        const { [pendingKey]: _removed, ...rest } = current;
        return rest;
      });
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Artículos</h1>
          </div>

          <div className="toolbar-inline toolbar-inline-end">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setImportPanelOpen((current) => !current)}
            >
              {importPanelOpen ? "Ocultar importacion" : "Importar CSV"}
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
            {/* <Link
              to="/admin/articles/bulk-create"
              className="button button-secondary"
            >
              Crear múltiples artículos desde UI
            </Link> */}
            <Link to="/admin/articles/new" className="button button-primary">
              Nuevo artículo
            </Link>
          </div>
        </div>

        {isSuperAdmin ? (
          <AdminBatchSnackbar
            selectedCount={selectedArticleIds.length}
            entityLabel="artículo"
            entityPluralLabel="artículos"
            busy={batchBusy}
            onClear={clearSelection}
            actions={[
              {
                key: "activate",
                label: "Activar",
                icon: CheckIcon,
                variant: "success",
                onClick: () => handleBatchArticles("ACTIVATE"),
              },
              {
                key: "deactivate",
                label: "Desactivar",
                icon: ArchiveIcon,
                onClick: () => handleBatchArticles("DEACTIVATE"),
              },
              {
                key: "feature",
                label: "Destacar",
                icon: EyeIcon,
                onClick: () => handleBatchArticles("FEATURE"),
              },
              {
                key: "unfeature",
                label: "Quitar destacado",
                icon: BanIcon,
                onClick: () => handleBatchArticles("UNFEATURE"),
              },
              {
                key: "allow-offers",
                label: "Aceptar ofertas",
                icon: StockIcon,
                onClick: () => handleBatchArticles("ALLOW_OFFERS"),
              },
              {
                key: "disallow-offers",
                label: "No aceptar ofertas",
                icon: XIcon,
                variant: "danger",
                onClick: () => handleBatchArticles("DISALLOW_OFFERS"),
              },
            ]}
          />
        ) : null}

        <ResponsiveFilterPanel
          title="Filtros de artículos"
          description=""
          buttonLabel="Mostrar filtros"
          summary={
            activeFiltersCount
              ? `${activeFiltersCount} filtro(s) activos`
              : "Sin filtros adicionales"
          }
          onApply={applyFilters}
          onClear={clearFilters}
          showClear={activeFiltersCount > 0}
        >
          <div className="admin-filter-grid">
            <label className="field-group">
              <span>Buscar</span>
              <input
                className="input"
                placeholder="Título, código, categoría, marca"
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
                <option value="DRAFT">Borradores</option>
                <option value="ACTIVE">Activas</option>
                <option value="INACTIVE">Inactivas</option>
                <option value="ARCHIVED">Archivadas</option>
                <option value="RESERVED">Reservadas</option>
                <option value="SOLD_OUT">Agotadas</option>
              </select>
            </label>

            <label className="field-group">
              <span>Destacado</span>
              <select
                className="input"
                value={draftFilters.featured}
                onChange={(event) =>
                  updateDraft("featured", event.target.value)
                }
              >
                <option value="">Todos</option>
                <option value="true">Destacados</option>
                <option value="false">No destacados</option>
              </select>
            </label>

            <label className="field-group">
              <span>Acepta ofertas</span>
              <select
                className="input"
                value={draftFilters.offerable}
                onChange={(event) =>
                  updateDraft("offerable", event.target.value)
                }
              >
                <option value="">Todos</option>
                <option value="true">Acepta ofertas</option>
                <option value="false">No acepta ofertas</option>
              </select>
            </label>

            <label className="field-group">
              <span>Categoría</span>
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
                <option value="title">Título</option>
                <option value="internalCode">Código</option>
                <option value="discountedPrice">Precio final</option>
                <option value="salePrice">Precio base</option>
                <option value="quantityAvailable">Stock disponible</option>
                <option value="status">Estado</option>
                <option value="categoryName">Categoría</option>
                <option value="brandName">Marca</option>
                <option value="updatedAt">Actualización</option>
              </select>
            </label>

            <label className="field-group">
              <span>Dirección</span>
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
              <span>Por página</span>
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

        {importPanelOpen ? (
          <div className="section-card nested-card page-stack">
            <div className="section-heading section-heading-wrap">
              <div>
                <p className="section-kicker">Batch</p>
                <h2>Importar artículos</h2>
                <p className="muted-copy">
                  Para carga rapida solo necesitas titulo y precio. El resto se
                  completa con valores seguros.
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setImportPanelOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="template-download-grid">
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
                  name="articles-import-file"
                  data-validation-field="articles-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    setImportFile(nextFile);
                    setPreview(null);
                  }}
                />
                <span className="field-helper">
                  {importFile
                    ? `Seleccionado: ${importFile.name}`
                    : "CSV con columnas simples o completas."}
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
                  <span>Actualizar por código si ya existe</span>
                </label>

                <label className="field-group checkbox-field checkbox-field-compact">
                  <input
                    type="checkbox"
                    checked={createMissingLookups}
                    onChange={(event) =>
                      setCreateMissingLookups(event.target.checked)
                    }
                  />
                  <span>Crear categorías, marcas y talles faltantes</span>
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
                        <th>Código</th>
                        <th>Título</th>
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
        ) : null}

        {loading ? <AppLoader variant="card" label="Cargando artículos" /> : null}

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
                    {isSuperAdmin ? (
                      <th className="batch-select-cell">
                        <input
                          type="checkbox"
                          className="batch-select-checkbox"
                          checked={allSelectableArticlesChecked}
                          disabled={!selectableArticleIds.length || batchBusy}
                          onChange={toggleAllSelectableArticles}
                          aria-label="Seleccionar artículos visibles"
                        />
                      </th>
                    ) : null}
                    <th>Imagen</th>
                    <SortableTh
                      sortKey="title"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Articulo
                    </SortableTh>
                    <SortableTh
                      sortKey="categoryName"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Categoría
                    </SortableTh>
                    <SortableTh
                      sortKey="brandName"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Marca
                    </SortableTh>
                    <th>Talle</th>
                    <SortableTh
                      sortKey="discountedPrice"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Precio
                    </SortableTh>
                    <SortableTh
                      sortKey="quantityAvailable"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Stock
                    </SortableTh>
                    <SortableTh
                      sortKey="status"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Estado
                    </SortableTh>
                    <th>Controles</th>
                    <SortableTh
                      sortKey="updatedAt"
                      sort={{ key: filters.sortBy, direction: filters.sortDir }}
                      onSort={changeSort}
                    >
                      Actualizado
                    </SortableTh>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((article) => {
                    const categoryName =
                      article.category?.name ||
                      article.categoryName ||
                      "Sin categoría";
                    const brandName =
                      article.brand?.name || article.brandName || "Sin marca";
                    const sizeName =
                      article.size?.code ||
                      article.sizeText ||
                      article.sizeCode ||
                      "Sin talle";

                    return (
                      <tr key={article.id}>
                        {isSuperAdmin ? (
                          <td className="batch-select-cell" data-label="Seleccionar">
                            <input
                              type="checkbox"
                              className="batch-select-checkbox"
                              checked={selectedArticleIdSet.has(article.id)}
                              disabled={batchBusy}
                              onChange={() => toggleArticleSelection(article.id)}
                              aria-label={`Seleccionar artículo ${article.title}`}
                            />
                          </td>
                        ) : null}
                        <td>
                          <Link
                            to={`/admin/articles/${article.id}/edit`}
                            className="table-thumb-link"
                            aria-label={`Editar ${article.title}`}
                          >
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
                            <Link
                              to={`/admin/articles/${article.id}/edit`}
                              className="table-strong-link"
                            >
                              {article.title}
                            </Link>
                            <span className="muted-copy">
                              Código: {article.internalCode || "Sin código"}
                            </span>
                          </div>
                        </td>
                        <td>{categoryName}</td>
                        <td>{brandName}</td>
                        <td>{sizeName}</td>
                        <td>
                          <strong>
                            {formatCurrency(
                              article.discountedPrice || article.salePrice,
                            )}
                          </strong>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{article.quantityAvailable}</strong>
                            <StatusBadge
                              status={getStockStatus(article)}
                              labels={STOCK_STATUS_LABELS}
                            />
                          </div>
                        </td>
                        <td>
                          <StatusBadge
                            status={getPublicationStatus(article)}
                            labels={ARTICLE_STATUS_LABELS}
                          />
                        </td>
                        <td>
                          <div className="admin-article-toggles">
                            <QuickToggle
                              checked={getPublicationStatus(article) === "ACTIVE"}
                              pending={Boolean(pendingToggles[`${article.id}:status`])}
                              disabled={Boolean(pendingToggles[`${article.id}:status`])}
                              label="Activo"
                              onText="Sí"
                              offText="No"
                              onClick={() =>
                                void handleQuickToggle(article, "status")
                              }
                            />
                            <QuickToggle
                              checked={asBooleanFlag(article.isFeatured)}
                              pending={Boolean(pendingToggles[`${article.id}:isFeatured`])}
                              disabled={Boolean(pendingToggles[`${article.id}:isFeatured`])}
                              label="Destacado"
                              onText="Sí"
                              offText="No"
                              onClick={() =>
                                void handleQuickToggle(article, "isFeatured")
                              }
                            />
                            <QuickToggle
                              checked={asBooleanFlag(article.allowOffers)}
                              pending={Boolean(pendingToggles[`${article.id}:allowOffers`])}
                              disabled={Boolean(pendingToggles[`${article.id}:allowOffers`])}
                              label="Acepta ofertas"
                              onText="Sí"
                              offText="No"
                              onClick={() =>
                                void handleQuickToggle(article, "allowOffers")
                              }
                            />
                          </div>
                        </td>
                        <td>
                          {formatDate(article.updatedAt || article.intakeDate)}
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link
                              to={`/admin/articles/${article.id}/stock`}
                              className="button button-secondary button-compact admin-icon-action"
                              aria-label={`Ajustar stock de ${article.title}`}
                              title="Ajustar stock"
                            >
                              <StockIcon />
                            </Link>
                            <Link
                              to={`/admin/articles/${article.id}/edit`}
                              className="button button-secondary button-compact admin-icon-action"
                              aria-label={`Editar ${article.title}`}
                              title="Editar"
                            >
                              <EditIcon />
                              {/* <span className="admin-action-label">Editar</span> */}
                            </Link>
                            {getPublicationStatus(article) !== "INACTIVE" ? (
                              <button
                                type="button"
                                className="button button-secondary button-compact admin-icon-action"
                                aria-label={`Desactivar ${article.title}`}
                                title="Desactivar"
                                onClick={() =>
                                  void handleSoftDeleteArticle(article)
                                }
                              >
                                <ArchiveIcon />
                                {/* <span className="admin-action-label">
                                  Desactivar
                                </span> */}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="button button-secondary button-compact admin-icon-action admin-icon-action--danger"
                              aria-label={`Eliminar definitivamente ${article.title}`}
                              title="Eliminar definitivamente"
                              onClick={() => void handleDeleteArticle(article)}
                            >
                              <XIcon />
                            </button>
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
                No hay artículos para los filtros seleccionados.
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
