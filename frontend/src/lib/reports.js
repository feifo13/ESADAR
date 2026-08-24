import { buildQueryString } from './query.js';

const FIELD_DEFINITIONS = Object.freeze({
  q: { label: 'Buscar', type: 'search', placeholder: 'Orden, artículo o código' },
  dateFrom: { label: 'Desde', type: 'date' },
  dateTo: { label: 'Hasta', type: 'date' },
  lotId: { label: 'Lote', type: 'lot' },
  categoryId: { label: 'Categoría', type: 'category' },
  brandId: { label: 'Marca', type: 'brand' },
  sizeId: { label: 'Talle', type: 'size' },
  paymentMethod: {
    label: 'Método de pago',
    type: 'select',
    options: [
      { value: 'BANK_TRANSFER', label: 'Transferencia bancaria' },
      { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
    ],
  },
  shippingMethod: { label: 'Método de envío', type: 'shipping' },
  publicationStatus: {
    label: 'Estado de publicación',
    type: 'select',
    options: [
      { value: 'DRAFT', label: 'Borrador' },
      { value: 'ACTIVE', label: 'Activo' },
      { value: 'INACTIVE', label: 'Inactivo' },
      { value: 'ARCHIVED', label: 'Archivado' },
    ],
  },
  stockStatus: {
    label: 'Estado de stock',
    type: 'select',
    options: [
      { value: 'ACTIVE', label: 'Disponible' },
      { value: 'RESERVED', label: 'Reservado' },
      { value: 'SOLD_OUT', label: 'Agotado' },
    ],
  },
  featured: {
    label: 'Destacado',
    type: 'select',
    options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }],
  },
  offerable: {
    label: 'Acepta ofertas',
    type: 'select',
    options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }],
  },
  dataQuality: {
    label: 'Calidad de datos',
    type: 'select',
    options: [
      { value: 'COMPLETE', label: 'Completa' },
      { value: 'INCOMPLETE', label: 'Incompleta' },
    ],
  },
  minDays: { label: 'Antigüedad mínima (días)', type: 'number', min: 0 },
  historyScope: {
    label: 'Cobertura histórica',
    type: 'select',
    options: [
      { value: 'RECORDED_LEDGER', label: 'Historial registrado' },
      { value: 'MIGRATED_BASELINE', label: 'Base migrada' },
      { value: 'PARTIAL_HISTORY', label: 'Historial parcial' },
    ],
  },
  hasRecordedSale: {
    label: 'Con venta registrada',
    type: 'select',
    options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }],
  },
  scope: {
    label: 'Alcance',
    type: 'select',
    options: [
      { value: 'CURRENT_ARTICLES', label: 'Artículos actuales' },
      { value: 'HISTORICAL_SALES', label: 'Ventas históricas' },
      { value: 'ALL', label: 'Todos' },
    ],
  },
  issueCode: {
    label: 'Tipo de problema',
    type: 'select',
    options: [
      { value: 'MISSING_ITEM_COST', label: 'Falta costo del artículo' },
      { value: 'MISSING_HISTORICAL_SNAPSHOT', label: 'Falta snapshot histórico' },
      { value: 'INVALID_ITEM_COST', label: 'Costo del artículo inválido' },
      { value: 'INVALID_COST_COMPONENT', label: 'Componente de costo inválido' },
      { value: 'INVALID_BANK_TAX_SNAPSHOT', label: 'Impuesto histórico inválido' },
      { value: 'INVALID_SALE_PRICE', label: 'Precio de venta inválido' },
      { value: 'CURRENT_COST_FALLBACK_FORBIDDEN', label: 'Fallback a costo actual prohibido' },
      { value: 'UNCOMPUTABLE_PROFIT', label: 'Ganancia no calculable' },
    ],
  },
  unreliableOnly: {
    label: 'Solo datos no confiables',
    type: 'select',
    options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }],
  },
});

function fields(...keys) {
  return keys.map((key) => Object.freeze({ key, ...FIELD_DEFINITIONS[key] }));
}

export const REPORT_CATALOG = Object.freeze([
  {
    id: 'sales',
    title: 'Ventas',
    description: 'Detalle de ventas concretadas en el período seleccionado.',
    endpoint: '/api/admin/reports/sales',
    fields: fields('dateFrom', 'dateTo', 'lotId', 'paymentMethod', 'shippingMethod', 'q'),
  },
  {
    id: 'profit-projection',
    title: 'Proyección de ganancias',
    description: 'Rentabilidad proyectada del stock según costos y precios actuales.',
    endpoint: '/api/admin/reports/profit-projection',
    fields: fields('q', 'lotId', 'categoryId', 'brandId', 'sizeId', 'publicationStatus', 'stockStatus', 'featured', 'offerable', 'dateFrom', 'dateTo'),
  },
  {
    id: 'realized-profits',
    title: 'Ganancias',
    description: 'Ganancias realizadas a partir de datos históricos confiables.',
    endpoint: '/api/admin/reports/realized-profits',
    fields: fields('dateFrom', 'dateTo', 'lotId', 'paymentMethod', 'shippingMethod', 'dataQuality', 'q'),
  },
  {
    id: 'stock',
    title: 'Stock',
    description: 'Estado actual del inventario.',
    endpoint: '/api/admin/reports/stock',
    fields: fields('q', 'lotId', 'categoryId', 'brandId', 'sizeId', 'publicationStatus', 'stockStatus'),
  },
  {
    id: 'stock-rotation',
    title: 'Rotación de stock',
    description: 'Antigüedad y movimiento del stock según el historial disponible.',
    endpoint: '/api/admin/reports/stock-rotation',
    fields: fields('q', 'dateFrom', 'dateTo', 'lotId', 'categoryId', 'brandId', 'publicationStatus', 'stockStatus', 'minDays', 'historyScope', 'hasRecordedSale'),
  },
  {
    id: 'cost-integrity',
    title: 'Integridad de costos',
    description: 'Detecta datos incompletos o inconsistentes que afectan la rentabilidad.',
    endpoint: '/api/admin/reports/cost-integrity',
    defaults: { scope: 'ALL', unreliableOnly: 'true' },
    fields: fields('scope', 'issueCode', 'unreliableOnly', 'q', 'lotId', 'categoryId', 'brandId', 'dateFrom', 'dateTo'),
  },
]);

export function getReportDefinition(reportId) {
  return REPORT_CATALOG.find((report) => report.id === reportId) || null;
}

export function createReportFilters(reportId) {
  const report = getReportDefinition(reportId);
  if (!report) throw new Error('Reporte desconocido.');
  return Object.fromEntries(report.fields.map(({ key }) => [key, report.defaults?.[key] ?? '']));
}

export function getVisibleReportFields(reportId, values = {}) {
  const report = getReportDefinition(reportId);
  if (!report) return [];
  if (reportId !== 'cost-integrity' || values.scope === 'CURRENT_ARTICLES') return report.fields;
  return report.fields.filter(({ key }) => !['categoryId', 'brandId'].includes(key));
}

export function buildReportDownloadRequest(reportId, filters = {}, format = 'xlsx') {
  const report = getReportDefinition(reportId);
  if (!report) throw new Error('Reporte desconocido.');
  if (!['csv', 'xlsx'].includes(format)) throw new Error('Formato de reporte inválido.');

  const allowedKeys = new Set(getVisibleReportFields(reportId, filters).map(({ key }) => key));
  const safeFilters = Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => allowedKeys.has(key) && value !== '' && value != null),
  );
  const query = buildQueryString({ ...safeFilters, format });
  return { path: `${report.endpoint}?${query}`, extension: format };
}
