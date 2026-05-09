import { useEffect, useMemo, useState } from "react";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiDownload, apiFetch } from "../../lib/api.js";
import { buildQueryString } from "../../lib/query.js";
import { formatCurrency, formatDate } from "../../lib/format.js";

const initialFilters = {
  dateFrom: "",
  dateTo: "",
  categoryId: "",
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

function LineChart({ items, valueKey = "revenue" }) {
  if (!items.length) {
    return (
      <p className="muted-copy">No hay datos en el periodo seleccionado.</p>
    );
  }

  const width = 480;
  const height = 160;
  const values = items.map((item) => Number(item[valueKey] || 0));
  const maxValue = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(items.length - 1, 1)) * (width - 24) + 12;
      const y = height - ((value / maxValue) * (height - 24) + 12);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="stats-line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Grafica de ventas"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="stats-line-chart__labels">
        {items.map((item) => (
          <span key={item.periodLabel}>{item.periodLabel}</span>
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
      filters.brandId,
      filters.status,
      filters.paymentMethod,
      filters.shippingMethod,
    ].filter(Boolean).length +
    (filters.groupBy !== initialFilters.groupBy ? 1 : 0);

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

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Estadisticas</h1>
          </div>
        </div>

        <ResponsiveFilterPanel
          title="Filtros de estadisticas"
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
              <span>Envio</span>
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
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="year">Ano</option>
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
        <div className="section-card">Cargando estadisticas...</div>
      ) : null}

      {summary ? (
        <section className="stats-kpi-grid">
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
            <span>Articulos vendidos</span>
            <strong>{summary.itemsSold}</strong>
          </article>
          <article className="stats-kpi-card">
            <span>Ticket promedio</span>
            <strong>{formatCurrency(summary.averageTicket)}</strong>
          </article>
          <article className="stats-kpi-card">
            <span>Cliente que mas compro</span>
            <strong>{summary.topCustomer?.customerName || "Sin datos"}</strong>
          </article>
          <article className="stats-kpi-card">
            <span>Prenda mas vendida</span>
            <strong>{summary.topArticle?.title || "Sin datos"}</strong>
          </article>
          <article className="stats-kpi-card">
            <span>Categoria mas vendida</span>
            <strong>{summary.topCategory?.categoryName || "Sin datos"}</strong>
          </article>
          <article className="stats-kpi-card">
            <span>Wishlist destacada</span>
            <strong>{summary.topWishlistArticle?.title || "Sin datos"}</strong>
          </article>
          <article className="stats-kpi-card">
            <span>Conversion wishlist</span>
            <strong>{summary.wishlistConversionRate}%</strong>
          </article>
          <article className="stats-kpi-card">
            <span>Costos incompletos</span>
            <strong>{summary.incompleteCostRows}</strong>
          </article>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <div className="page-stack">
          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Tendencia</p>
                <h2>Cuando se vendio mas</h2>
              </div>
            </div>
            <LineChart items={salesOverTime} valueKey="revenue" />
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Prendas</p>
                <h2>Items mas comprados</h2>
              </div>
            </div>
            <HorizontalBars
              items={topArticles}
              valueKey="quantitySold"
              labelKey="title"
              formatter={(value, item) =>
                `${value} uds · ${formatCurrency(item.revenue)}`
              }
              emptyLabel="Todavia no hay ventas suficientes para calcular esta estadistica."
            />
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Clientes</p>
                <h2>Top 10 usuarios que mas compran</h2>
              </div>
            </div>
            <HorizontalBars
              items={topCustomers}
              valueKey="totalSpent"
              labelKey="customerName"
              formatter={(value, item) =>
                `${formatCurrency(value)} · ${item.ordersCount} ordenes`
              }
              emptyLabel="Todavia no hay ventas suficientes para calcular esta estadistica."
            />
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Categorias</p>
                <h2>Tipos de prendas mas vendidas</h2>
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
                  La ganancia es estimada si faltan costos de compra, envio o
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
                <h2>Intencion de compra</h2>
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
                    <span>Conversion</span>
                    <strong>{wishlist.summary?.conversionRate || 0}%</strong>
                  </article>
                  <article className="stats-kpi-card">
                    <span>Ultima actividad</span>
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
                <h2>Interes y rotacion</h2>
              </div>
            </div>

            {marketStudyMessage ? (
              <p className="muted-copy">{marketStudyMessage}</p>
            ) : null}

            {hasMarketStudyData ? (
              <div className="page-stack">
                <div className="market-study-grid">
                  <div>
                    <h3>Demanda por categoria</h3>
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
                  <h3>Articulos con alto interes y baja conversion</h3>
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
                  <h3>Baja rotacion</h3>
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
