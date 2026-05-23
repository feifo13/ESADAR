import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const PAGE = { width: 1180, height: 820, margin: 28 };

const COLORS = {
  navy: '#08265a',
  navySoft: '#23447d',
  aqua: '#20b8c7',
  aquaSoft: '#edf9fb',
  orange: '#ff5a00',
  border: '#8aa3c9',
  line: '#d8e2f0',
  text: '#0d244f',
  muted: '#667899',
  danger: '#b42318',
  white: '#ffffff',
};

const LOGO_PATH = fileURLToPath(
  new URL('../../../assets/esadar-logo.png', import.meta.url),
);

const TABLE_COLUMNS = [
  { key: 'intakeDate', label: 'Fecha ingreso', width: 55 },
  { key: 'internalCode', label: 'Código interno', width: 62 },
  { key: 'title', label: 'Artículo', width: 130 },
  { key: 'brandName', label: 'Marca', width: 58 },
  { key: 'categoryName', label: 'Categoría', width: 62 },
  { key: 'sizeLabel', label: 'Talle', width: 32 },
  { key: 'salePrice', label: 'Precio venta', width: 58, align: 'right', type: 'currency' },
  { key: 'effectiveSalePrice', label: 'Precio efectivo', width: 64, align: 'right', type: 'currency' },
  { key: 'purchasePriceItem', label: 'Costo artículo', width: 60, align: 'right', type: 'currency' },
  { key: 'purchasePriceShipping', label: 'Costo envío USA', width: 62, align: 'right', type: 'currency' },
  { key: 'purchasePriceCourier', label: 'Costo envío MVD', width: 62, align: 'right', type: 'currency' },
  { key: 'bankTax', label: 'Impuestos bancarios', width: 70, align: 'right', type: 'currency' },
  { key: 'purchasePriceTotal', label: 'Costo compra', width: 62, align: 'right', type: 'currency' },
  { key: 'totalCost', label: 'Costo total', width: 60, align: 'right', type: 'currency' },
  { key: 'estimatedProfit', label: 'Ganancia estimada', width: 68, align: 'right', type: 'currency' },
  { key: 'estimatedMargin', label: 'Margen %', width: 46, align: 'right', type: 'percent' },
  { key: 'totalPerArticle', label: 'Total por artículo', width: 68, align: 'right', type: 'currency' },
];

function asNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clean(value, fallback = '-') {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}

function formatPercent(value) {
  return `${asNumber(value).toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) return '-';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value || Date.now());
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
}

function drawText(doc, value, x, y, options = {}) {
  doc
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size || 9)
    .fillColor(options.color || COLORS.text)
    .text(clean(value, options.fallback || ''), x, y, {
      width: options.width,
      height: options.height,
      align: options.align || 'left',
      ellipsis: options.ellipsis || false,
      lineGap: options.lineGap || 0,
    });
}

function drawRect(doc, x, y, width, height, options = {}) {
  doc.save();
  if (options.fill) {
    doc.rect(x, y, width, height).fill(options.fill);
  }
  doc
    .rect(x, y, width, height)
    .lineWidth(options.lineWidth || 0.8)
    .stroke(options.stroke || COLORS.border);
  doc.restore();
}

function drawHeader(doc, report) {
  const { filters = {}, generatedAt = new Date() } = report;
  const left = PAGE.margin;
  const top = 24;

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, left, top, { width: 92 });
  }

  drawText(doc, 'Reporte de márgenes de artículos', left + 112, top + 2, {
    width: 470,
    size: 18,
    bold: true,
    color: COLORS.navy,
  });
  drawText(doc, 'Analítica administrativa de costos, precio efectivo y ganancia estimada.', left + 112, top + 29, {
    width: 520,
    size: 9,
    color: COLORS.muted,
  });

  const dateFrom = filters.dateFrom ? formatDate(filters.dateFrom) : 'Sin inicio';
  const dateTo = filters.dateTo ? formatDate(filters.dateTo) : 'Sin fin';
  const rightX = PAGE.width - PAGE.margin - 250;
  drawText(doc, `Rango: ${dateFrom} a ${dateTo}`, rightX, top + 5, {
    width: 250,
    size: 9,
    bold: true,
    color: COLORS.navySoft,
    align: 'right',
  });
  drawText(doc, `Generado: ${formatDateTime(generatedAt)}`, rightX, top + 24, {
    width: 250,
    size: 8.5,
    color: COLORS.muted,
    align: 'right',
  });

  doc
    .save()
    .moveTo(PAGE.margin, 78)
    .lineTo(PAGE.width - PAGE.margin, 78)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke()
    .restore();
}

function drawSummaryMetric(doc, label, value, x, y, width, height, accent = false) {
  drawRect(doc, x, y, width, height, {
    fill: accent ? '#fff4ed' : COLORS.aquaSoft,
    stroke: accent ? COLORS.orange : COLORS.border,
  });
  drawText(doc, label, x + 9, y + 8, {
    width: width - 18,
    size: 7.8,
    color: COLORS.muted,
    height: 18,
    ellipsis: true,
  });
  drawText(doc, value, x + 9, y + 27, {
    width: width - 18,
    size: 10,
    bold: true,
    color: accent ? COLORS.orange : COLORS.navy,
    height: 15,
    ellipsis: true,
  });
}

function drawSummary(doc, summary = {}) {
  const metrics = [
    ['Cantidad de artículos', clean(summary.articleCount ?? 0, '0')],
    ['Total precio efectivo venta', formatCurrency(summary.totalEffectiveSalePrice)],
    ['Total costo artículo', formatCurrency(summary.totalPurchasePriceItem)],
    ['Total costo envío USA', formatCurrency(summary.totalPurchasePriceShipping)],
    ['Total costo envío MVD', formatCurrency(summary.totalPurchasePriceCourier)],
    ['Total impuestos bancarios', formatCurrency(summary.totalBankTax)],
    ['Total costo compra', formatCurrency(summary.totalPurchasePrice)],
    ['Total costo total', formatCurrency(summary.totalCost)],
    ['Ganancia estimada total', formatCurrency(summary.totalEstimatedProfit), true],
    ['Margen total', formatPercent(summary.totalMargin), true],
  ];

  const gap = 8;
  const width = (PAGE.width - PAGE.margin * 2 - gap * 4) / 5;
  const height = 50;
  const startY = 95;

  metrics.forEach(([label, value, accent], index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    drawSummaryMetric(
      doc,
      label,
      value,
      PAGE.margin + column * (width + gap),
      startY + row * (height + gap),
      width,
      height,
      accent,
    );
  });

  return startY + 2 * height + gap + 24;
}

function drawTableHeader(doc, y) {
  const height = 26;
  let x = PAGE.margin;
  drawRect(doc, x, y, PAGE.width - PAGE.margin * 2, height, {
    fill: COLORS.navy,
    stroke: COLORS.navy,
  });

  TABLE_COLUMNS.forEach((column) => {
    drawText(doc, column.label, x + 3, y + 7, {
      width: column.width - 6,
      height: 15,
      size: 6.4,
      bold: true,
      color: COLORS.white,
      align: column.align || 'left',
      ellipsis: true,
    });
    x += column.width;
  });

  return y + height;
}

function formatCellValue(row, column) {
  if (column.type === 'currency') return formatCurrency(row[column.key]);
  if (column.type === 'percent') return formatPercent(row[column.key]);
  if (column.key === 'intakeDate') return formatDate(row[column.key]);
  return clean(row[column.key]);
}

function drawTableRow(doc, row, y, index, options = {}) {
  const height = 31;
  let x = PAGE.margin;
  const fill = options.total ? '#fff4ed' : (index % 2 === 0 ? '#ffffff' : '#f7fbff');

  drawRect(doc, x, y, PAGE.width - PAGE.margin * 2, height, {
    fill,
    stroke: options.total ? COLORS.orange : COLORS.line,
    lineWidth: options.total ? 0.8 : 0.45,
  });

  TABLE_COLUMNS.forEach((column) => {
    const isNegativeProfit = column.key === 'estimatedProfit' && asNumber(row.estimatedProfit) < 0;
    drawText(doc, formatCellValue(row, column), x + 3, y + 7, {
      width: column.width - 6,
      height: 18,
      size: 6.4,
      color: isNegativeProfit ? COLORS.danger : COLORS.text,
      bold: options.total || column.key === 'estimatedProfit' || column.key === 'estimatedMargin',
      align: column.align || 'left',
      ellipsis: true,
    });

    if (x > PAGE.margin) {
      doc
        .save()
        .moveTo(x, y)
        .lineTo(x, y + height)
        .strokeColor(options.total ? COLORS.orange : COLORS.line)
        .lineWidth(0.35)
        .stroke()
        .restore();
    }

    x += column.width;
  });

  return y + height;
}

function drawFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    drawText(doc, `ESADAR | Página ${index + 1} de ${range.count}`, PAGE.margin, PAGE.height - 22, {
      width: PAGE.width - PAGE.margin * 2,
      size: 7.5,
      color: COLORS.muted,
      align: 'center',
    });
  }
}

function addReportPage(doc) {
  doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
  return drawTableHeader(doc, PAGE.margin);
}

function buildTotalsRow(summary = {}) {
  return {
    intakeDate: 'Totales',
    internalCode: '',
    title: '',
    brandName: '',
    categoryName: '',
    sizeLabel: '',
    salePrice: summary.totalSalePrice,
    effectiveSalePrice: summary.totalEffectiveSalePrice,
    purchasePriceItem: summary.totalPurchasePriceItem,
    purchasePriceShipping: summary.totalPurchasePriceShipping,
    purchasePriceCourier: summary.totalPurchasePriceCourier,
    bankTax: summary.totalBankTax,
    purchasePriceTotal: summary.totalPurchasePrice,
    totalCost: summary.totalCost,
    estimatedProfit: summary.totalEstimatedProfit,
    estimatedMargin: summary.totalMargin,
    totalPerArticle: summary.totalPerArticle,
  };
}

export function generateArticleMarginsReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE.width, PAGE.height],
      margin: 0,
      bufferPages: true,
      info: {
        Title: 'Reporte de márgenes de artículos',
        Author: 'ESADAR',
      },
    });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, report);
    let y = drawSummary(doc, report.summary);

    drawText(doc, 'Detalle de artículos', PAGE.margin, y - 9, {
      width: PAGE.width - PAGE.margin * 2,
      size: 11,
      bold: true,
      color: COLORS.navy,
    });

    y = drawTableHeader(doc, y + 10);

    const items = Array.isArray(report.items) ? report.items : [];
    if (!items.length) {
      drawText(doc, 'No hay artículos para los filtros seleccionados.', PAGE.margin, y + 20, {
        width: PAGE.width - PAGE.margin * 2,
        size: 10,
        color: COLORS.muted,
        align: 'center',
      });
    } else {
      items.forEach((item, index) => {
        if (y + 31 > PAGE.height - 36) {
          y = addReportPage(doc);
        }
        y = drawTableRow(doc, item, y, index);
      });
      if (y + 31 > PAGE.height - 36) {
        y = addReportPage(doc);
      }
      drawTableRow(doc, buildTotalsRow(report.summary), y, items.length, { total: true });
    }

    drawFooter(doc);
    doc.end();
  });
}
