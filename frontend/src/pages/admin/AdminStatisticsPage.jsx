import { useEffect, useMemo, useState } from "react";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiDownload, apiFetch } from "../../lib/api.js";
import { buildQueryString } from "../../lib/query.js";
import { formatCurrency, formatDate } from "../../lib/format.js";
import AppLoader from "../../components/AppLoader.jsx";

const initialFilters = {
  dateFrom: "",
  dateTo: "",
  categoryId: "",
  lotId: "",
  brandId: "",
  status: "",
  paymentMethod: "",
  shippingMethod: "",
  groupBy: "month",
};

const EMPTY_MARKET_STUDY = {
  categoryDemand: [],
  brandDemand: [],
  sizeDemand: [],
  colors: [],
  materials: [],
  highInterestLowConversion: [],
  lowRotation: [],
  soldOutWithDemand: [],
  offers: null,
  paymentShipping: [],
};

const SALES_GROUP_OPTIONS = [
  { value: "month", label: "Mes" },
  { value: "week", label: "Semana" },
  { value: "day", label: "Día" },
];

const ARTICLE_MARGIN_STATUSES = new Set(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);

function getGroupByLabel(groupBy) {
  return SALES_GROUP_OPTIONS.find((option) => option.value === groupBy)?.label || "Mes";
}

function formatCompactCurrency(value) {
  const numeric = Number(value || 0);
  const absolute = Math.abs(numeric);

  if (absolute >= 1000000) {
    return `$${(numeric / 1000000).toFixed(1)}M`;
  }

  if (absolute >= 1000) {
    return `$${Math.round(numeric / 1000)}k`;
  }

  return `$${Math.round(numeric)}`;
}

function formatPeriodLabel(periodLabel, groupBy) {
  const label = String(periodLabel || "");

  if (groupBy === "day") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
    return match ? `${match[3]}/${match[2]}` : label;
  }

  if (groupBy === "week") {
    const match = /^(\d{4})-W(\d{2})$/.exec(label);
    return match ? `S${Number(match[2])} ${match[1]}` : label;
  }

  if (groupBy === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(label);
    return match ? `${match[2]}/${match[1]}` : label;
  }

  return label;
}

function buildArticleMarginsQuery(filters) {
  const queryFilters = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    categoryId: filters.categoryId,
    lotId: filters.lotId,
    brandId: filters.brandId,
    q: filters.q,
  };

  if (ARTICLE_MARGIN_STATUSES.has(filters.status)) {
    queryFilters.status = filters.status;
  }

  return buildQueryString(queryFilters);
}

function HorizontalBars({
  items,
  valueKey,
  labelKey,
  formatter = (value) => value,
  emptyLabel = "Sin datos.",
}) {
  const maxValue = Math.max(
    ...items.map((item) => Number(item[valueKey] || 0)),
    0,
  );

  if (!items.length) {
    return <p className="muted-copy">{emptyLabel}</p>;
  }

  return (
    <div className="stats-bars">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = maxValue > 0 ? Math.max(8, (value / maxValue) * 100) : 8;
        return (
          <div key={`${item[labelKey]}-${value}`} className="stats-bar-row">
            <div className="stats-bar-copy">
              <strong>{item[labelKey]}</strong>
              <span>{formatter(value, item)}</span>
            </div>
            <div className="stats-bar-track">
              <span className="stats-bar-fill" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({
  items,
  valueKey = "revenue",
  groupBy = "month",
  valueFormatter = formatCurrency,
}) {
  const chartItems = Array.isArray(items)
    ? items.filter((item) => item?.periodLabel)
    : [];

  if (!chartItems.length) {
    return (
      <p className="muted-copy">No hay datos en el periodo seleccionado.</p>
    );
  }

  const height = 240;
  const topPadding = 18;
  const rightPadding = 18;
  const bottomPadding = 42;
  const leftPadding = 62;
  const stepWidth = groupBy === "day" ? 72 : groupBy === "week" ? 88 : 96;
  const width = Math.max(
    560,
    leftPadding + rightPadding + Math.max(chartItems.length - 1, 1) * stepWidth,
  );
  const plotWidth = width - leftPadding - rightPadding;
  const plotHeight = height - topPadding - bottomPadding;
  const values = chartItems.map((item) => Number(item[valueKey] || 0));
  const maxValue = Math.max(...values, 0);
  const chartMax = maxValue > 0 ? maxValue : 1;
  const totalValue = values.reduce((sum, value) => sum + value, 0);
  const totalOrders = chartItems.reduce(
    (sum, item) => sum + Number(item.ordersCount || 0),
    0,
  );
  const totalItems = chartItems.reduce(
    (sum, item) => sum + Number(item.itemsSold || 0),
    0,
  );
  const points = chartItems.map((item, index) => {
    const value = Number(item[valueKey] || 0);
    const x = chartItems.length === 1
      ? leftPadding + plotWidth / 2
      : leftPadding + (index / (chartItems.length - 1)) * plotWidth;
    const y = topPadding + plotHeight - (value / chartMax) * plotHeight;
    return { item, value, x, y };
  });
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const yTicks = maxValue > 0
    ? [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
        value: chartMax * (1 - ratio),
        y: topPadding + ratio * plotHeight,
      }))
    : [{ value: 0, y: topPadding + plotHeight }];

  return (
    <div
      className="stats-line-chart"
      style={{ "--stats-chart-width": `${width}px` }}
    >
      <div className="stats-line-chart__summary">
        <span>
          <strong>{valueFormatter(totalValue)}</strong>
          <small>Total</small>
        </span>
        <span>
          <strong>{totalOrders}</strong>
          <small>Órdenes</small>
        </span>
        <span>
          <strong>{totalItems}</strong>
          <small>Unidades</small>
        </span>
      </div>

      <div className="stats-line-chart__canvas">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Gráfica de ventas por ${getGroupByLabel(groupBy).toLowerCase()}`}
        >
          <title>{`Ventas por ${getGroupByLabel(groupBy).toLowerCase()}`}</title>
          {yTicks.map((tick) => (
            <g key={`${tick.value}-${tick.y}`}>
              <line
                className="stats-line-chart__grid"
                x1={leftPadding}
                x2={width - rightPadding}
                y1={tick.y}
                y2={tick.y}
              />
              <text
                className="stats-line-chart__axis-label"
                x={leftPadding - 10}
                y={tick.y + 4}
                textAnchor="end"
              >
                {formatCompactCurrency(tick.value)}
              </text>
            </g>
          ))}

          <line
            className="stats-line-chart__axis"
            x1={leftPadding}
            x2={width - rightPadding}
            y1={topPadding + plotHeight}
            y2={topPadding + plotHeight}
          />

          {points.length > 1 ? (
            <polyline
              className="stats-line-chart__line"
              points={polylinePoints}
              fill="none"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          ) : null}

          {points.map((point) => (
            <rect
              key={point.item.periodLabel}
              className="stats-line-chart__point"
              x={point.x - 5}
              y={point.y - 5}
              width="10"
              height="10"
            >
              <title>
                {`${formatPeriodLabel(point.item.periodLabel, groupBy)}: ${valueFormatter(point.value)} / ${point.item.ordersCount || 0} órdenes / ${point.item.itemsSold || 0} uds`}
              </title>
            </rect>
          ))}

          {points.map((point) => (
            <text
              key={`${point.item.periodLabel}-label`}
              className="stats-line-chart__x-label"
              x={point.x}
              y={height - 10}
              textAnchor="middle"
            >
              {formatPeriodLabel(point.item.periodLabel, groupBy)}
            </text>
          ))}
        </svg>
      </div>

      <div className="stats-line-chart__values" aria-label="Valores por periodo">
        {chartItems.map((item) => (
          <span key={item.periodLabel}>
            <strong>{valueFormatter(item[valueKey])}</strong>
            <small>
              {formatPeriodLabel(item.periodLabel, groupBy)} / {item.ordersCount || 0} ord.
            </small>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminStatisticsPage() {
  const {
    categoryOptions,
    brandOptions,
    shippingMethodOptions,
    paymentMethodOptions,
  } = useLookups();
  const { notifyError } = useNotification();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [salesOverTime, setSalesOverTime] = useState([]);
  const [topArticles, setTopArticles] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [profit, setProfit] = useState(null);
  const [wishlist, setWishlist] = useState(null);
  const [marketStudy, setMarketStudy] = useState(null);
  const [marketStudyMessage, setMarketStudyMessage] = useState("");
  const [exporting, setExporting] = useState("");
  const [lotOptions, setLotOptions] = useState([]);
  const hasMarketStudyData = Boolean(
    marketStudy &&
    [
      ...(marketStudy.categoryDemand || []),
      ...(marketStudy.brandDemand || []),
      ...(marketStudy.sizeDemand || []),
      ...(marketStudy.colors || []),
      ...(marketStudy.materials || []),
      ...(marketStudy.highInterestLowConversion || []),
      ...(marketStudy.lowRotation || []),
      ...(marketStudy.soldOutWithDemand || []),
    ].length,
  );

  const activeQuery = useMemo(() => buildQueryString(filters), [filters]);
  const activeFiltersCount =
    [
      filters.dateFrom,
      filters.dateTo,
      filters.categoryId,
      filters.lotId,
      filters.brandId,
      filters.status,
      filters.paymentMethod,
      filters.shippingMethod,
    ].filter(Boolean).length +
    (filters.groupBy !== initialFilters.groupBy ? 1 : 0);

  useEffect(() => {
    let ignore = false;

    async function loadLotOptions() {
      try {
        const response = await apiFetch("/api/admin/article-lots/options?includeArchived=true");
        if (!ignore) setLotOptions(response.items || []);
      } catch {
        if (!ignore) setLotOptions([]);
      }
    }

    loadLotOptions();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadStatistics() {
      try {
        setLoading(true);
        setError("");
        setMarketStudyMessage("");
        const [
          summaryResponse,
          salesResponse,
          topArticlesResponse,
          topCustomersResponse,
          topCategoriesResponse,
          profitResponse,
          wishlistResponse,
        ] = await Promise.all([
          apiFetch(`/api/admin/statistics/summary?${activeQuery}`),
          apiFetch(`/api/admin/statistics/sales-over-time?${activeQuery}`),
          apiFetch(`/api/admin/statistics/top-articles?${activeQuery}`),
          apiFetch(`/api/admin/statistics/top-customers?${activeQuery}`),
          apiFetch(`/api/admin/statistics/top-categories?${activeQuery}`),
          apiFetch(`/api/admin/statistics/profit?${activeQuery}`),
          apiFetch(`/api/admin/statistics/wishlist?${activeQuery}`),
        ]);

        let marketResponse = { marketStudy: EMPTY_MARKET_STUDY };
        try {
          marketResponse = await apiFetch(
            `/api/admin/statistics/market-study?${activeQuery}`,
          );
        } catch (marketError) {
          if (!ignore) {
            setMarketStudyMessage(
              marketError.message ||
                "No pudimos cargar el estudio de mercado ahora.",
            );
          }
        }

        if (ignore) return;

        setSummary(summaryResponse.summary || null);
        setSalesOverTime(salesResponse.items || []);
        setTopArticles(topArticlesResponse.items || []);
        setTopCustomers(topCustomersResponse.items || []);
        setTopCategories(topCategoriesResponse.items || []);
        setProfit(profitResponse.profit || null);
        setWishlist(wishlistResponse.wishlist || null);
        setMarketStudy(marketResponse.marketStudy || EMPTY_MARKET_STUDY);
      } catch (err) {
        if (!ignore) {
          const errorMessage = err.message || "No se pudieron cargar las estadisticas.";
          setError(errorMessage);
          notifyError(errorMessage);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadStatistics();
    return () => {
      ignore = true;
    };
  }, [activeQuery]);

  function updateDraft(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    setFilters(draftFilters);
  }

  function clearFilters() {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
  }

  function updateSalesGroupBy(groupBy) {
    setDraftFilters((current) => ({ ...current, groupBy }));
    setFilters((current) => ({ ...current, groupBy }));
  }

  async function handleExport(type) {
    try {
      setExporting(type);
      const query = buildQueryString({ ...filters, type });
      await apiDownload(`/api/admin/statistics/export.xlsx?${query}`, {
        fileName: `esadar-${type}.xlsx`,
        extension: "xlsx",
      });
    } catch (err) {
      const errorMessage = err.message || "No se pudo exportar el reporte.";
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setExporting("");
    }
  }

  async function handleArticleMarginsPdfExport() {
    try {
      setExporting("article_margins_pdf");
      const query = buildArticleMarginsQuery(filters);
      await apiDownload(`/api/admin/statistics/article-margins.pdf?${query}`, {
        fileName: "esadar-margenes-articulos.pdf",
        extension: "pdf",
      });
    } catch (err) {
      const errorMessage = err.message || "No se pudo exportar el PDF de márgenes.";
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="container page-stack admin-page-shell admin-statistics-page">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>Estadísticas</h1>
          </div>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de estadísticas"
          description=""
          buttonLabel="Mostrar filtros"
          summary={
            activeFiltersCount
              ? `${activeFiltersCount} filtro(s) activos`
              : "Periodo base actual"
          }
          onApply={applyFilters}
          onClear={clearFilters}
          showClear={activeFiltersCount > 0}
        >
          <div className="admin-filter-grid">
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
              <span>Lote</span>
              <select
                className="input"
                value={draftFilters.lotId}
                onChange={(event) => updateDraft("lotId", event.target.value)}
              >
                <option value="">Todos</option>
                {lotOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} - {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Estado de orden</span>
              <select
                className="input"
                value={draftFilters.status}
                onChange={(event) => updateDraft("status", event.target.value)}
              >
                <option value="">Aprobadas y enviadas</option>
                <option value="PENDING">Pendiente</option>
                <option value="RESERVED">Reservada</option>
                <option value="APPROVED">Aprobada</option>
                <option value="SHIPPED">Enviada</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="EXPIRED">Expirada</option>
              </select>
            </label>
            <label className="field-group">
              <span>Pago</span>
              <select
                className="input"
                value={draftFilters.paymentMethod}
                onChange={(event) =>
                  updateDraft("paymentMethod", event.target.value)
                }
              >
                <option value="">Todos</option>
                {paymentMethodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Envío</span>
              <select
                className="input"
                value={draftFilters.shippingMethod}
                onChange={(event) =>
                  updateDraft("shippingMethod", event.target.value)
                }
              >
                <option value="">Todos</option>
                {shippingMethodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Agrupar por</span>
              <select
                className="input"
                value={draftFilters.groupBy}
                onChange={(event) => updateDraft("groupBy", event.target.value)}
              >
                {SALES_GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </ResponsiveFilterPanel>

        <div className="inline-action-group">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => handleExport("summary")}
            disabled={Boolean(exporting)}
          >
            {exporting === "summary" ? "Exportando..." : "Exportar resumen"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => handleExport("sales")}
            disabled={Boolean(exporting)}
          >
            {exporting === "sales" ? "Exportando..." : "Exportar ventas"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => handleExport("profits")}
            disabled={Boolean(exporting)}
          >
            {exporting === "profits" ? "Exportando..." : "Exportar ganancias"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleArticleMarginsPdfExport}
            disabled={Boolean(exporting)}
          >
            {exporting === "article_margins_pdf"
              ? "Exportando..."
              : "Exportar PDF márgenes artículos"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => handleExport("market_study")}
            disabled={Boolean(exporting)}
          >
            {exporting === "market_study"
              ? "Exportando..."
              : "Exportar estudio de mercado"}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => handleExport("full")}
            disabled={Boolean(exporting)}
          >
            {exporting === "full"
              ? "Exportando..."
              : "Exportar reporte completo"}
          </button>
        </div>

      </section>

      {loading ? (
        <section className="section-card">
          <AppLoader variant="card" label="Cargando estadísticas" />
        </section>
      ) : null}

      {error ? (
        <section className="section-card admin-empty-state">
          <p className="error-copy">{error}</p>
        </section>
      ) : null}

      {summary ? (
        <section className="section-card page-stack">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Resumen</p>
              <h2>Indicadores principales</h2>
            </div>
          </div>
          <div className="stats-kpi-grid">
            <article className="stats-kpi-card">
              <span>Ventas totales</span>
              <strong>{summary.totalOrders}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Ingresos brutos</span>
              <strong>{formatCurrency(summary.grossRevenue)}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Ganancia estimada</span>
              <strong>{formatCurrency(summary.estimatedProfit)}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Margen promedio</span>
              <strong>{summary.averageMargin}%</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Artículos vendidos</span>
              <strong>{summary.itemsSold}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Ticket promedio</span>
              <strong>{formatCurrency(summary.averageTicket)}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Cliente que más compró</span>
              <strong>{summary.topCustomer?.customerName || "Sin datos"}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Prenda más vendida</span>
              <strong>{summary.topArticle?.title || "Sin datos"}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Categoría más vendida</span>
              <strong>{summary.topCategory?.categoryName || "Sin datos"}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Wishlist destacada</span>
              <strong>{summary.topWishlistArticle?.title || "Sin datos"}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Conversión wishlist</span>
              <strong>{summary.wishlistConversionRate}%</strong>
            </article>
            <article className="stats-kpi-card">
              <span>Costos incompletos</span>
              <strong>{summary.incompleteCostRows}</strong>
            </article>
          </div>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <div className="page-stack">
          <section className="section-card page-stack">
            <div className="section-heading section-heading-wrap">
              <div>
                <p className="section-kicker">Tendencia</p>
                <h2>Cuándo se vendió más</h2>
                <p className="stats-chart-caption">
                  Ingresos por {getGroupByLabel(filters.groupBy).toLowerCase()}
                </p>
              </div>
              <div className="stats-chart-toolbar" role="group" aria-label="Agrupar ventas">
                {SALES_GROUP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`stats-group-button${
                      filters.groupBy === option.value ? " is-active" : ""
                    }`}
                    aria-pressed={filters.groupBy === option.value}
                    onClick={() => updateSalesGroupBy(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <LineChart
              items={salesOverTime}
              valueKey="revenue"
              groupBy={filters.groupBy}
            />
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Prendas</p>
                <h2>Ítems más comprados</h2>
              </div>
            </div>
            <HorizontalBars
              items={topArticles}
              valueKey="quantitySold"
              labelKey="title"
              formatter={(value, item) =>
                `${value} uds · ${formatCurrency(item.revenue)}`
              }
              emptyLabel="Todavía no hay ventas suficientes para calcular esta estadística."
            />
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Clientes</p>
                <h2>Top 10 usuarios que más compran</h2>
              </div>
            </div>
            <HorizontalBars
              items={topCustomers}
              valueKey="totalSpent"
              labelKey="customerName"
              formatter={(value, item) =>
                `${formatCurrency(value)} · ${item.ordersCount} órdenes`
              }
              emptyLabel="Todavía no hay ventas suficientes para calcular esta estadística."
            />
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Categorías</p>
                <h2>Tipos de prendas más vendidas</h2>
              </div>
            </div>
            <HorizontalBars
              items={topCategories}
              valueKey="quantitySold"
              labelKey="categoryName"
              formatter={(value, item) =>
                `${value} uds · ${formatCurrency(item.revenue)}`
              }
            />
          </section>
        </div>

        <div className="page-stack">
          <section className="section-card page-stack admin-detail-panel">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Ganancias</p>
                <h2>Rentabilidad estimada</h2>
              </div>
            </div>
            {profit ? (
              <>
                <p className="muted-copy">
                  La ganancia es estimada si faltan costos de compra, envío o
                  courier.
                </p>
                <div className="stats-kpi-grid stats-kpi-grid--compact">
                  <article className="stats-kpi-card">
                    <span>Ingresos</span>
                    <strong>{formatCurrency(profit.grossRevenue)}</strong>
                  </article>
                  <article className="stats-kpi-card">
                    <span>Ganancia</span>
                    <strong>{formatCurrency(profit.estimatedProfit)}</strong>
                  </article>
                  <article className="stats-kpi-card">
                    <span>Margen</span>
                    <strong>{profit.averageMargin}%</strong>
                  </article>
                  <article className="stats-kpi-card">
                    <span>Filas incompletas</span>
                    <strong>{profit.incompleteCostRows}</strong>
                  </article>
                </div>
                <HorizontalBars
                  items={profit.topProfitableArticles || []}
                  valueKey="estimatedProfit"
                  labelKey="title"
                  formatter={(value) => formatCurrency(value)}
                />
              </>
            ) : null}
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Wishlist / Guardados</p>
                <h2>Intención de compra</h2>
              </div>
            </div>
            {wishlist ? (
              <>
                <div className="stats-kpi-grid stats-kpi-grid--compact">
                  <article className="stats-kpi-card">
                    <span>Wishlists</span>
                    <strong>{wishlist.summary?.totalWishlists || 0}</strong>
                  </article>
                  <article className="stats-kpi-card">
                    <span>Guardados</span>
                    <strong>{wishlist.summary?.totalSavedItems || 0}</strong>
                  </article>
                  <article className="stats-kpi-card">
                    <span>Conversión</span>
                    <strong>{wishlist.summary?.conversionRate || 0}%</strong>
                  </article>
                  <article className="stats-kpi-card">
                    <span>Última actividad</span>
                    <strong>
                      {wishlist.summary?.lastActivity
                        ? formatDate(wishlist.summary.lastActivity)
                        : "Sin datos"}
                    </strong>
                  </article>
                </div>
                <HorizontalBars
                  items={wishlist.topArticles || []}
                  valueKey="savesCount"
                  labelKey="title"
                  formatter={(value) => `${value} guardados`}
                />
              </>
            ) : null}
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Estudio de mercado</p>
                <h2>Interés y rotación</h2>
              </div>
            </div>

            {marketStudyMessage ? (
              <p className="muted-copy">{marketStudyMessage}</p>
            ) : null}

            {hasMarketStudyData ? (
              <div className="page-stack">
                <div className="market-study-grid">
                  <div>
                    <h3>Demanda por categoría</h3>
                    <HorizontalBars
                      items={marketStudy.categoryDemand || []}
                      valueKey="soldCount"
                      labelKey="label"
                      formatter={(value, item) =>
                        `${value} ventas · ${item.savesCount} guardados`
                      }
                    />
                  </div>
                  <div>
                    <h3>Demanda por marca</h3>
                    <HorizontalBars
                      items={marketStudy.brandDemand || []}
                      valueKey="soldCount"
                      labelKey="label"
                      formatter={(value, item) =>
                        `${value} ventas · ${item.savesCount} guardados`
                      }
                    />
                  </div>
                  <div>
                    <h3>Demanda por talle</h3>
                    <HorizontalBars
                      items={marketStudy.sizeDemand || []}
                      valueKey="soldCount"
                      labelKey="label"
                      formatter={(value, item) =>
                        `${value} ventas · ${item.viewsCount} vistas`
                      }
                    />
                  </div>
                  <div>
                    <h3>Colores y materiales</h3>
                    <HorizontalBars
                      items={marketStudy.colors || []}
                      valueKey="soldCount"
                      labelKey="label"
                      formatter={(value, item) =>
                        `${value} ventas · ${item.savesCount} guardados`
                      }
                    />
                    <HorizontalBars
                      items={marketStudy.materials || []}
                      valueKey="soldCount"
                      labelKey="label"
                      formatter={(value, item) =>
                        `${value} ventas · ${item.savesCount} guardados`
                      }
                    />
                  </div>
                </div>

                <div>
                  <h3>Artículos con alto interés y baja conversión</h3>
                  <HorizontalBars
                    items={marketStudy.highInterestLowConversion || []}
                    valueKey="savesCount"
                    labelKey="title"
                    formatter={(value, item) =>
                      `${value} guardados · ${item.viewsCount} vistas`
                    }
                  />
                </div>

                <div>
                  <h3>Baja rotación</h3>
                  <HorizontalBars
                    items={marketStudy.lowRotation || []}
                    valueKey="daysPublished"
                    labelKey="title"
                    formatter={(value, item) =>
                      `${value} dias · ${item.viewsCount} vistas`
                    }
                  />
                </div>

                <div>
                  <h3>Agotados con demanda</h3>
                  <HorizontalBars
                    items={marketStudy.soldOutWithDemand || []}
                    valueKey="savesCount"
                    labelKey="title"
                    formatter={(value, item) =>
                      `${value} guardados · ${item.alertsCount} alertas`
                    }
                  />
                </div>
              </div>
            ) : (
              <p className="muted-copy">
                No hay datos en el periodo seleccionado.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
