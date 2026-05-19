import { useEffect, useMemo, useState } from "react";
import AdminPagination from "../../components/admin/AdminPagination.jsx";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import SortableTh from "../../components/SortableTh.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import {
  BanIcon,
  CheckIcon,
  EditIcon,
  XIcon,
} from "../../components/ActionIcons.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import { buildQueryString } from "../../lib/query.js";
import { formatWeightKg, usesWeightRanges } from "../../lib/shippingRates.js";
import AppLoader from "../../components/AppLoader.jsx";

const SHIPPING_STATUS_LABELS = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

const PRICING_TYPE_LABELS = {
  FIXED: "Costo fijo",
  WEIGHT_RANGES: "Por rangos de peso",
  AHIVA_CORREO_NACIONAL: "Por rangos de peso",
};

const initialFilters = {
  q: "",
  isActive: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

function createEmptyRate(index = 0) {
  return {
    id: null,
    minWeightKg: index === 0 ? "0.000" : "",
    maxWeightKg: "",
    price: "0",
    label: "",
    sortOrder: index + 1,
    isActive: true,
  };
}

const emptyForm = {
  id: null,
  description: "",
  baseCost: "0",
  pricingType: "FIXED",
  officialRatesLabel: "Ver tarifas oficiales",
  officialRatesLink: "",
  instructions: "",
  weightRates: [],
  isActive: true,
};

function normalizePricingType(value) {
  return value === "AHIVA_CORREO_NACIONAL" ? "WEIGHT_RANGES" : value || "FIXED";
}

function toForm(method = {}) {
  return {
    id: method.id || null,
    description: method.description || "",
    baseCost: String(method.baseCost ?? 0),
    pricingType: normalizePricingType(method.pricingType),
    officialRatesLabel: method.officialRatesLabel || "Ver tarifas oficiales",
    officialRatesLink: method.officialRatesUrl || method.officialRatesFilePath || "",
    instructions: method.instructions || "",
    weightRates: Array.isArray(method.rates)
      ? method.rates.map((rate, index) => ({
          id: rate.id || null,
          minWeightKg: String(rate.minWeightKg ?? 0),
          maxWeightKg: String(rate.maxWeightKg ?? ""),
          price: String(rate.price ?? 0),
          label: rate.label || "",
          sortOrder: Number(rate.sortOrder || index + 1),
          isActive: Boolean(rate.isActive ?? true),
        }))
      : [],
    isActive: Boolean(method.isActive ?? true),
  };
}

function getRateSummary(method) {
  if (!usesWeightRanges(method.pricingType)) {
    return formatCurrency(method.baseCost);
  }

  if (!method.rateCount) return "Sin rangos";
  const min = method.minWeightKg != null ? formatWeightKg(method.minWeightKg) : "0 kg";
  const max = method.maxWeightKg != null ? formatWeightKg(method.maxWeightKg) : "—";
  return `${method.rateCount} rango(s) · ${min} a ${max}`;
}

function splitOfficialRatesLink(value) {
  const link = String(value || "").trim();
  if (!link) {
    return { officialRatesUrl: null, officialRatesFilePath: null };
  }

  if (/^https?:\/\//i.test(link)) {
    return { officialRatesUrl: link, officialRatesFilePath: null };
  }

  return { officialRatesUrl: null, officialRatesFilePath: link };
}

function isValidOfficialRatesLink(value) {
  const link = String(value || "").trim();
  return !link || /^https?:\/\//i.test(link) || link.startsWith("/");
}

export default function AdminShippingPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [methods, setMethods] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
  });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionMethodId, setActionMethodId] = useState(null);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const query = useMemo(() => buildQueryString(filters), [filters]);
  const totalPages = Math.max(
    1,
    Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 25)),
  );
  const activeFiltersCount =
    [filters.q, filters.isActive].filter(Boolean).length +
    (filters.pageSize !== initialFilters.pageSize ? 1 : 0);
  const isWeightPricing = usesWeightRanges(form.pricingType);

  useEffect(() => {
    let ignore = false;

    async function loadMethods() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch(`/api/admin/shipping?${query}`);
        if (ignore) return;
        setMethods(response.items || []);
        setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
      } catch (err) {
        if (!ignore) {
          const message = err.message || "No se pudieron cargar los métodos de envío.";
          setError(message);
          notifyError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMethods();
    return () => {
      ignore = true;
    };
  }, [query, refreshNonce]);

  function updateDraft(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function updateForm(name, value) {
    setForm((current) => {
      if (name === "pricingType") {
        return {
          ...current,
          pricingType: value,
          weightRates: usesWeightRanges(value)
            ? current.weightRates.length
              ? current.weightRates
              : [createEmptyRate(0)]
            : current.weightRates,
        };
      }
      return { ...current, [name]: value };
    });
  }

  function updateRate(index, name, value) {
    setForm((current) => ({
      ...current,
      weightRates: current.weightRates.map((rate, rateIndex) =>
        rateIndex === index ? { ...rate, [name]: value } : rate,
      ),
    }));
  }

  function addRate() {
    setForm((current) => ({
      ...current,
      weightRates: [...current.weightRates, createEmptyRate(current.weightRates.length)],
    }));
  }

  function removeRate(index) {
    setForm((current) => ({
      ...current,
      weightRates: current.weightRates.filter((_, rateIndex) => rateIndex !== index),
    }));
  }

  function applyFilters() {
    setFilters((current) => ({ ...current, ...draftFilters, page: 1 }));
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

  function buildPayload() {
    const pricingType = normalizePricingType(form.pricingType);
    const officialRatesLink = splitOfficialRatesLink(form.officialRatesLink);
    const weightRates = usesWeightRanges(pricingType)
      ? form.weightRates
          .map((rate, index) => ({
            id: rate.id || null,
            minWeightKg: Number(rate.minWeightKg || 0),
            maxWeightKg: Number(rate.maxWeightKg || 0),
            price: Number(rate.price || 0),
            label: String(rate.label || "").trim(),
            sortOrder: Number(rate.sortOrder || index + 1),
            isActive: Boolean(rate.isActive),
          }))
          .filter((rate) => rate.isActive || rate.maxWeightKg > rate.minWeightKg)
      : [];

    return {
      description: form.description,
      baseCost: Number(form.baseCost || 0),
      pricingType,
      officialRatesLabel: String(form.officialRatesLabel || "").trim() || null,
      ...officialRatesLink,
      instructions: form.instructions,
      weightRates,
      isActive: form.isActive,
    };
  }

  function validateFormBeforeSubmit() {
    if (!isValidOfficialRatesLink(form.officialRatesLink)) {
      notifyError("El documento oficial debe ser una URL http(s) o un path interno que empiece con /.");
      return false;
    }

    const pricingType = normalizePricingType(form.pricingType);
    if (!usesWeightRanges(pricingType)) return true;

    const activeRates = form.weightRates
      .map((rate) => ({
        minWeightKg: Number(rate.minWeightKg || 0),
        maxWeightKg: Number(rate.maxWeightKg || 0),
        price: Number(rate.price || 0),
        isActive: Boolean(rate.isActive),
      }))
      .filter((rate) => rate.isActive);

    if (!activeRates.length) {
      notifyError("Agrega al menos un rango activo para calcular el envío por peso.");
      return false;
    }

    for (const rate of activeRates) {
      if (rate.maxWeightKg <= rate.minWeightKg) {
        notifyError("Cada rango activo debe tener un peso máximo mayor al mínimo.");
        return false;
      }
      if (rate.price < 0) {
        notifyError("El precio de los rangos no puede ser negativo.");
        return false;
      }
    }

    const sortedRates = [...activeRates].sort(
      (left, right) =>
        left.minWeightKg - right.minWeightKg ||
        left.maxWeightKg - right.maxWeightKg,
    );

    for (let index = 1; index < sortedRates.length; index += 1) {
      if (sortedRates[index].minWeightKg < sortedRates[index - 1].maxWeightKg) {
        notifyError("Los rangos activos se solapan. Ajusta desde/hasta antes de guardar.");
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.description.trim()) {
      notifyError("Ingresa una descripción para el método de envío.");
      return;
    }

    if (!validateFormBeforeSubmit()) return;

    try {
      setSaving(true);
      setError("");
      const path = form.id ? `/api/admin/shipping/${form.id}` : "/api/admin/shipping";
      const method = form.id ? "PUT" : "POST";
      await apiFetch(path, { method, body: buildPayload() });
      notifySuccess(form.id ? "Metodo de envio actualizado." : "Metodo de envio creado.");
      setForm(emptyForm);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const message = err.message || "No se pudo guardar el método de envío.";
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(method, isActive) {
    const actionLabel = isActive ? "activar" : "desactivar";
    const confirmed = window.confirm(`¿Seguro que quieres ${actionLabel} ${method.description}?`);
    if (!confirmed) return;

    try {
      setActionMethodId(method.id);
      setError("");
      await apiFetch(`/api/admin/shipping/${method.id}/status`, {
        method: "PATCH",
        body: { isActive },
      });
      notifySuccess(isActive ? "Metodo de envio activado." : "Metodo de envio desactivado.");
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const message = err.message || "No se pudo actualizar el método de envío.";
      setError(message);
      notifyError(message);
    } finally {
      setActionMethodId(null);
    }
  }

  async function handleDelete(method) {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar ${method.description}? Si ya tiene órdenes vinculadas, deberás desactivarlo.`,
    );
    if (!confirmed) return;

    try {
      setActionMethodId(method.id);
      setError("");
      await apiFetch(`/api/admin/shipping/${method.id}`, { method: "DELETE" });
      notifySuccess("Metodo de envio eliminado.");
      if (form.id === method.id) setForm(emptyForm);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      const message = err.message || "No se pudo eliminar el método de envío.";
      setError(message);
      notifyError(message);
    } finally {
      setActionMethodId(null);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Metodos de envio</h1>
          </div>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}

        <form className="section-card page-stack-sm" onSubmit={handleSubmit}>
          <div className="section-heading section-heading-wrap">
            <div>
              <p className="section-kicker">{form.id ? "Editar" : "Nuevo"}</p>
              <h2>{form.id ? "Editar método" : "Crear método"}</h2>
            </div>
            {form.id ? (
              <button type="button" className="button button-secondary" onClick={() => setForm(emptyForm)}>
                Cancelar edicion
              </button>
            ) : null}
          </div>

          <div className="form-grid-two">
            <label className="field-group">
              <span>Descripción</span>
              <input
                className="input"
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                required
              />
            </label>
            <label className="field-group">
              <span>Tipo de cálculo</span>
              <select
                className="input"
                value={form.pricingType}
                onChange={(event) => updateForm("pricingType", event.target.value)}
              >
                <option value="FIXED">Costo fijo</option>
                <option value="WEIGHT_RANGES">Rangos por peso</option>
              </select>
            </label>
            <label className="field-group">
              <span>{isWeightPricing ? "Costo base / respaldo" : "Costo fijo"}</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.baseCost}
                onChange={(event) => updateForm("baseCost", event.target.value)}
                required
              />
              {isWeightPricing ? (
                <span className="field-helper">
                  Para rangos por peso, el checkout usa la tabla. Este valor queda como referencia administrativa.
                </span>
              ) : null}
            </label>
            <label className="field-group">
              <span>Texto del documento oficial</span>
              <input
                className="input"
                value={form.officialRatesLabel}
                onChange={(event) => updateForm("officialRatesLabel", event.target.value)}
                placeholder="Ver tarifas oficiales"
                maxLength={120}
              />
            </label>
            <label className="field-group field-group-span-2">
              <span>Link o path del documento oficial</span>
              <input
                className="input"
                value={form.officialRatesLink}
                onChange={(event) => updateForm("officialRatesLink", event.target.value)}
                placeholder="/docs/tarifas-ahiva-correo.pdf o https://sitio-oficial.com/tarifas.pdf"
              />
              <span className="field-helper">
                Dejalo vacío si este método no tiene documento oficial.
              </span>
            </label>
            <label className="preference-check shipping-active-check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateForm("isActive", event.target.checked)}
              />
              <span>Activo</span>
            </label>
            <label className="field-group field-group-span-2">
              <span>Instrucciones</span>
              <textarea
                className="input textarea"
                rows="3"
                value={form.instructions}
                onChange={(event) => updateForm("instructions", event.target.value)}
              />
            </label>
          </div>

          {isWeightPricing ? (
            <div className="shipping-rates-editor">
              <div className="section-heading section-heading-wrap compact-heading">
                <div>
                  <p className="section-kicker">Tarifas por peso</p>
                  <h3>Rangos configurables</h3>
                </div>
                <button type="button" className="button button-secondary" onClick={addRate}>
                  Agregar rango
                </button>
              </div>

              <p className="muted-copy">
                El checkout usa estos rangos para calcular el envío según el peso aproximado total de la orden.
              </p>

              <div className="shipping-rates-grid" role="table" aria-label="Rangos de envío por peso">
                <div className="shipping-rates-grid__header" role="row">
                  <span>Desde kg</span>
                  <span>Hasta kg</span>
                  <span>Precio</span>
                  <span>Etiqueta</span>
                  <span>Activo</span>
                  <span>Acción</span>
                </div>
                {form.weightRates.map((rate, index) => (
                  <div className="shipping-rates-grid__row" role="row" key={`${rate.id || "new"}-${index}`}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.001"
                      value={rate.minWeightKg}
                      onChange={(event) => updateRate(index, "minWeightKg", event.target.value)}
                      aria-label="Peso mínimo"
                    />
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.001"
                      value={rate.maxWeightKg}
                      onChange={(event) => updateRate(index, "maxWeightKg", event.target.value)}
                      aria-label="Peso máximo"
                    />
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={rate.price}
                      onChange={(event) => updateRate(index, "price", event.target.value)}
                      aria-label="Precio"
                    />
                    <input
                      className="input"
                      value={rate.label}
                      onChange={(event) => updateRate(index, "label", event.target.value)}
                      placeholder="Hasta 2 kg"
                      aria-label="Etiqueta"
                    />
                    <label className="preference-check shipping-rate-check">
                      <input
                        type="checkbox"
                        checked={rate.isActive}
                        onChange={(event) => updateRate(index, "isActive", event.target.checked)}
                      />
                      <span>Activo</span>
                    </label>
                    <button
                      type="button"
                      className="ghost-button admin-icon-action"
                      onClick={() => removeRate(index)}
                      aria-label="Eliminar rango"
                      title="Eliminar rango"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
                {!form.weightRates.length ? (
                  <div className="shipping-rates-empty">
                    <p className="muted-copy">Todavía no hay rangos. Agregá al menos uno para guardar este método.</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="inline-action-group">
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear método"}
            </button>
          </div>
        </form>

        <ResponsiveFilterPanel
          title="Filtros de envio"
          description=""
          buttonLabel="Mostrar filtros"
          summary={activeFiltersCount ? `${activeFiltersCount} filtro(s) activos` : "Sin filtros adicionales"}
          onApply={applyFilters}
          onClear={clearFilters}
          showClear={activeFiltersCount > 0}
        >
          <div className="admin-filter-grid">
            <label className="field-group">
              <span>Buscar</span>
              <input
                className="input"
                placeholder="Descripción o instrucciones"
                value={draftFilters.q}
                onChange={(event) => updateDraft("q", event.target.value)}
              />
            </label>
            <label className="field-group">
              <span>Estado</span>
              <select className="input" value={draftFilters.isActive} onChange={(event) => updateDraft("isActive", event.target.value)}>
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </label>
            <label className="field-group">
              <span>Orden</span>
              <select className="input" value={draftFilters.sortBy} onChange={(event) => updateDraft("sortBy", event.target.value)}>
                <option value="createdAt">Fecha de alta</option>
                <option value="updatedAt">Última actualización</option>
                <option value="description">Descripción</option>
                <option value="baseCost">Costo</option>
                <option value="pricingType">Tipo de cálculo</option>
                <option value="status">Estado</option>
              </select>
            </label>
            <label className="field-group">
              <span>Dirección</span>
              <select className="input" value={draftFilters.sortDir} onChange={(event) => updateDraft("sortDir", event.target.value)}>
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </label>
            <label className="field-group">
              <span>Tamaño de página</span>
              <select className="input" value={draftFilters.pageSize} onChange={(event) => changePageSize(event.target.value)}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
        </ResponsiveFilterPanel>

        {loading ? <AppLoader variant="card" label="Cargando Shipping" /> : null}

        <AdminPagination
          className="pagination-row--top"
          page={Number(filters.page || 1)}
          totalPages={totalPages}
          totalItems={Number(pagination.total || 0)}
          loading={loading}
          onPrevious={() => changePage(Math.max(1, Number(filters.page || 1) - 1))}
          onNext={() => changePage(Math.min(totalPages, Number(filters.page || 1) + 1))}
        />

        {!loading ? (
          <div className="table-shell admin-table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh sortKey="description" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>
                    Metodo
                  </SortableTh>
                  <SortableTh sortKey="pricingType" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>
                    Tipo
                  </SortableTh>
                  <SortableTh sortKey="baseCost" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>
                    Costo / rangos
                  </SortableTh>
                  <SortableTh sortKey="status" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>
                    Estado
                  </SortableTh>
                  <th>Uso</th>
                  <SortableTh sortKey="updatedAt" sort={{ key: filters.sortBy, direction: filters.sortDir }} onSort={changeSort}>
                    Actualizado
                  </SortableTh>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => {
                  const isBusy = actionMethodId === method.id;
                  return (
                    <tr key={method.id}>
                      <td data-label="Metodo">
                        <div className="cell-stack">
                          <strong>{method.description}</strong>
                          {method.instructions ? <span className="muted-copy">{method.instructions}</span> : null}
                          {method.officialRatesUrl || method.officialRatesFilePath ? (
                            <span className="muted-copy">
                              Documento: {method.officialRatesLabel || "Ver tarifas oficiales"}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Tipo">{PRICING_TYPE_LABELS[method.pricingType] || method.pricingType}</td>
                      <td data-label="Costo / rangos">{getRateSummary(method)}</td>
                      <td data-label="Estado">
                        <StatusBadge status={method.isActive ? "ACTIVE" : "INACTIVE"} labels={SHIPPING_STATUS_LABELS} />
                      </td>
                      <td data-label="Uso">
                        <span className="muted-copy">Órdenes: {method.orderCount}</span>
                      </td>
                      <td data-label="Actualizado">{formatDate(method.updatedAt || method.createdAt)}</td>
                      <td data-label="Acciones">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="ghost-button admin-icon-action"
                            onClick={() => setForm(toForm(method))}
                            aria-label={`Editar ${method.description}`}
                            title="Editar"
                          >
                            <EditIcon />
                            <span className="admin-action-label">Editar</span>
                          </button>
                          {method.isActive ? (
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() => handleStatusChange(method, false)}
                              disabled={isBusy}
                              aria-label={`Desactivar ${method.description}`}
                              title="Desactivar"
                            >
                              <BanIcon />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost-button admin-icon-action"
                              onClick={() => handleStatusChange(method, true)}
                              disabled={isBusy}
                              aria-label={`Activar ${method.description}`}
                              title="Activar"
                            >
                              <CheckIcon />
                              <span className="admin-action-label">Activar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="ghost-button admin-icon-action"
                            onClick={() => handleDelete(method)}
                            disabled={isBusy}
                            aria-label={`Eliminar ${method.description}`}
                            title="Eliminar"
                          >
                            <XIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!methods.length ? (
                  <tr>
                    <td colSpan="7">
                      <p className="muted-copy">No hay métodos de envío para mostrar.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
