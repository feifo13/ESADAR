import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { env } from "../../../config/env.js";
import { fileURLToPath } from "node:url";

const PAGE = { width: 720, height: 960, margin: 30 };

const COLORS = {
  navy: "#08265a",
  navySoft: "#23447d",
  aqua: "#20b8c7",
  aquaSoft: "#edf9fb",
  orange: "#ff5a00",
  border: "#8aa3c9",
  text: "#0d244f",
  muted: "#667899",
  white: "#ffffff",
};

const LOGO_PATH = fileURLToPath(
  new URL("../../../assets/esadar-logo.png", import.meta.url),
);

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: "Transferencia bancaria",
  MERCADO_PAGO: "Mercado Pago",
};

const PAYMENT_STATUS_LABELS = {
  PENDING: "Pago pendiente",
  APPROVED: "Pago aprobado",
  REJECTED: "Pago rechazado",
  FAILED: "Pago fallido",
  REFUNDED: "Pago reintegrado",
  PAID: "Pago aprobado",
};

function asNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value, fallback = "-") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function fullName(customer = {}) {
  return (
    [customer.firstName, customer.lastName]
      .map((part) => clean(part, ""))
      .filter(Boolean)
      .join(" ") || "-"
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateParts(value) {
  if (!value) return { date: "-", time: "-" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };
  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())} hs`,
  };
}

function websiteLabel(url) {
  const normalized = clean(url || "", "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
  if (!normalized || /localhost|127\.0\.0\.1/i.test(normalized))
    return "www.esadar.com.uy";
  return normalized;
}

function drawText(doc, value, x, y, options = {}) {
  doc
    .font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.size || 10)
    .fillColor(options.color || COLORS.text)
    .text(clean(value, options.fallback || ""), x, y, {
      width: options.width,
      align: options.align || "left",
      lineGap: options.lineGap || 0,
      height: options.height,
      ellipsis: options.ellipsis || false,
      continued: options.continued || false,
    });
}

function drawRect(doc, x, y, w, h, options = {}) {
  doc.save();
  if (options.fill) {
    doc.rect(x, y, w, h).fill(options.fill);
  }
  doc
    .rect(x, y, w, h)
    .lineWidth(options.lineWidth || 0.8)
    .stroke(options.stroke || COLORS.border);
  doc.restore();
}

function drawHLine(doc, x1, y, x2, color = COLORS.border, lineWidth = 0.8) {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(lineWidth)
    .moveTo(x1, y)
    .lineTo(x2, y)
    .stroke()
    .restore();
}

function drawVLine(doc, x, y1, y2, color = COLORS.border, lineWidth = 0.8) {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(lineWidth)
    .moveTo(x, y1)
    .lineTo(x, y2)
    .stroke()
    .restore();
}

function drawSimpleIcon(doc, kind, x, y, color = COLORS.aqua) {
  doc.save().strokeColor(color).fillColor(color).lineWidth(1.7);

  if (kind === "order") {
    doc.rect(x, y + 4, 22, 24).stroke();
    doc
      .moveTo(x + 6, y + 4)
      .lineTo(x + 6, y)
      .lineTo(x + 16, y)
      .lineTo(x + 16, y + 4)
      .stroke();
    doc.circle(x + 11, y + 16, 4).stroke();
  } else if (kind === "date") {
    doc.rect(x, y + 5, 25, 23).stroke();
    doc
      .moveTo(x, y + 12)
      .lineTo(x + 25, y + 12)
      .stroke();
    doc
      .moveTo(x + 7, y)
      .lineTo(x + 7, y + 8)
      .stroke();
    doc
      .moveTo(x + 18, y)
      .lineTo(x + 18, y + 8)
      .stroke();
  } else if (kind === "cart") {
    doc
      .moveTo(x, y + 6)
      .lineTo(x + 4, y + 6)
      .lineTo(x + 8, y + 21)
      .lineTo(x + 24, y + 21)
      .stroke();
    doc
      .moveTo(x + 7, y + 11)
      .lineTo(x + 24, y + 11)
      .lineTo(x + 21, y + 18)
      .stroke();
    doc.circle(x + 10, y + 27, 2).stroke();
    doc.circle(x + 22, y + 27, 2).stroke();
  } else if (kind === "person") {
    doc.circle(x + 11, y + 7, 4).stroke();
    doc
      .moveTo(x + 3, y + 24)
      .bezierCurveTo(x + 6, y + 15, x + 16, y + 15, x + 19, y + 24)
      .stroke();
  } else if (kind === "mail") {
    doc.rect(x, y + 5, 22, 16).stroke();
    doc
      .moveTo(x, y + 5)
      .lineTo(x + 11, y + 14)
      .lineTo(x + 22, y + 5)
      .stroke();
  } else if (kind === "phone") {
    doc
      .moveTo(x + 4, y + 3)
      .bezierCurveTo(x + 1, y + 9, x + 6, y + 20, x + 12, y + 24)
      .stroke();
    doc
      .moveTo(x + 12, y + 24)
      .bezierCurveTo(x + 16, y + 27, x + 20, y + 25, x + 22, y + 20)
      .stroke();
    doc
      .moveTo(x + 6, y + 7)
      .lineTo(x + 10, y + 10)
      .stroke();
    doc
      .moveTo(x + 15, y + 18)
      .lineTo(x + 19, y + 21)
      .stroke();
  } else if (kind === "pin") {
    doc.circle(x + 11, y + 8, 5).stroke();
    doc
      .moveTo(x + 11, y + 13)
      .lineTo(x + 11, y + 26)
      .stroke();
    doc
      .moveTo(x + 7, y + 20)
      .lineTo(x + 11, y + 26)
      .lineTo(x + 15, y + 20)
      .stroke();
  } else if (kind === "home") {
    doc
      .moveTo(x + 1, y + 12)
      .lineTo(x + 11, y + 3)
      .lineTo(x + 21, y + 12)
      .stroke();
    doc.rect(x + 4, y + 12, 14, 12).stroke();
  } else if (kind === "clock") {
    doc.circle(x + 11, y + 14, 9).stroke();
    doc
      .moveTo(x + 11, y + 14)
      .lineTo(x + 11, y + 9)
      .stroke();
    doc
      .moveTo(x + 11, y + 14)
      .lineTo(x + 15, y + 16)
      .stroke();
  } else if (kind === "card") {
    doc.rect(x, y + 5, 28, 20).stroke();
    doc
      .moveTo(x, y + 12)
      .lineTo(x + 28, y + 12)
      .stroke();
  } else if (kind === "shield") {
    doc
      .moveTo(x + 12, y + 2)
      .lineTo(x + 22, y + 6)
      .lineTo(x + 20, y + 18)
      .lineTo(x + 12, y + 24)
      .lineTo(x + 4, y + 18)
      .lineTo(x + 2, y + 6)
      .closePath()
      .stroke();
    doc
      .moveTo(x + 8, y + 12)
      .lineTo(x + 11, y + 15)
      .lineTo(x + 16, y + 9)
      .stroke();
  } else if (kind === "tag") {
    doc
      .polygon(
        [x + 3, y + 3],
        [x + 17, y + 3],
        [x + 25, y + 11],
        [x + 12, y + 24],
        [x + 3, y + 15],
      )
      .stroke();
    doc.circle(x + 12, y + 9, 1.7).stroke();
  } else if (kind === "truck") {
    doc.rect(x, y + 10, 16, 10).stroke();
    doc.rect(x + 16, y + 13, 10, 7).stroke();
    doc.circle(x + 6, y + 22, 2).stroke();
    doc.circle(x + 20, y + 22, 2).stroke();
  } else if (kind === "wallet") {
    doc.rect(x, y + 7, 24, 15).stroke();
    doc.rect(x + 15, y + 11, 9, 8).stroke();
  } else if (kind === "heart") {
    doc
      .moveTo(x + 10, y + 20)
      .bezierCurveTo(x + 2, y + 14, x + 3, y + 6, x + 10, y + 8)
      .bezierCurveTo(x + 17, y + 6, x + 18, y + 14, x + 10, y + 20)
      .stroke();
  } else if (kind === "globe") {
    doc.circle(x + 10, y + 10, 8).stroke();
    doc
      .moveTo(x + 2, y + 10)
      .lineTo(x + 18, y + 10)
      .stroke();
    doc
      .moveTo(x + 10, y + 2)
      .lineTo(x + 10, y + 18)
      .stroke();
  } else if (kind === "whatsapp") {
    doc.circle(x + 10, y + 10, 8).stroke();
    doc
      .moveTo(x + 6, y + 18)
      .lineTo(x + 7, y + 14)
      .stroke();
    doc
      .moveTo(x + 8, y + 7)
      .bezierCurveTo(x + 7, y + 10, x + 9, y + 13, x + 13, y + 14)
      .stroke();
  } else if (kind === "insta" || kind === "facebook" || kind === "tiktok") {
    doc.rect(x, y, 20, 20).lineWidth(1.3).stroke(color);
    const label = kind === "insta" ? "IG" : kind === "facebook" ? "f" : "t";
    drawText(
      doc,
      label,
      x + (kind === "facebook" ? 7 : 4),
      y + (kind === "facebook" ? 3 : 4),
      {
        size: kind === "facebook" ? 11 : 8.5,
        bold: true,
        color,
        width: 12,
      },
    );
  }

  doc.restore();
}

function drawSectionHeader(doc, label, x, y, w) {
  doc.save().rect(x, y, w, 28).fill(COLORS.navy).restore();
  drawText(doc, label, x + 14, y + 8, {
    size: 12,
    bold: true,
    color: COLORS.white,
    width: w - 28,
  });
}

function drawFieldRow(doc, config) {
  const {
    label,
    value,
    x,
    y,
    width,
    valueX = x + 112,
    lineY,
    multiline = false,
  } = config;

  // Sin columna reservada para iconos: evita espacios/cuadros vacios.
  drawText(doc, label, x + 16, y + 10, {
    size: 9.2,
    bold: true,
    color: COLORS.navy,
    width: valueX - x - 24,
  });

  drawText(doc, value, valueX, y + 9, {
    size: 9.8,
    color: COLORS.text,
    width: width - (valueX - x) - 16,
    lineGap: multiline ? 2 : 0,
    height: multiline ? 34 : undefined,
    ellipsis: !multiline,
  });

  if (lineY != null) {
    drawHLine(doc, x + 16, lineY, x + width - 16);
  }
}

function drawHeader(doc, order) {
  const left = PAGE.margin;
  const top = 26;
  const { date, time } = formatDateParts(order.createdAt);

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, left, top + 2, {
      fit: [300, 112],
      align: "left",
      valign: "top",
    });
  } else {
    drawText(doc, "ESADAR", left, top + 30, {
      size: 36,
      bold: true,
      color: COLORS.orange,
    });
  }

  drawText(doc, "Comprobante de compra", 355, top + 28, {
    size: 23,
    bold: true,
    color: COLORS.navy,
    width: 335,
    align: "right",
  });

  // drawHLine(doc, 375, top + 79, 617, COLORS.aqua, 1.8);
  // drawHLine(doc, 617, top + 79, 686, COLORS.orange, 1.8);

  const stripY = 155;
  drawRect(doc, left, stripY, 660, 62, { stroke: COLORS.border });
  drawVLine(doc, 258, stripY + 10, stripY + 52);
  drawVLine(doc, 500, stripY + 10, stripY + 52);

  // Cada segmento tiene contenido; no quedan celdas vacias.
  drawText(doc, "Nº DE PEDIDO", left + 24, stripY + 17, {
    size: 10,
    bold: true,
    color: COLORS.navy,
  });
  drawText(doc, clean(order.orderNumber), left + 24, stripY + 36, {
    size: 15,
    bold: true,
    color: COLORS.navy,
  });

  drawText(doc, "FECHA", 282, stripY + 17, {
    size: 10,
    bold: true,
    color: COLORS.navy,
  });
  drawText(doc, `${date}  ·  ${time}`, 282, stripY + 36, {
    size: 11,
    color: COLORS.text,
    width: 190,
  });

  drawText(doc, "CANAL", 524, stripY + 17, {
    size: 10,
    bold: true,
    color: COLORS.navy,
  });
  drawText(doc, "Tienda Online", 524, stripY + 36, {
    size: 11,
    color: COLORS.text,
    width: 145,
  });
}

function drawInfoCards(doc, order, y) {
  const left = PAGE.margin;
  const gap = 20;
  const boxW = 320;
  const boxH = 145;
  const customer = order.customer || {};
  const address = clean(customer.address, "Sin dirección cargada");
  const shippingMethod = clean(order.shippingMethodDescription, "A coordinar");
  const paymentLabel =
    PAYMENT_METHOD_LABELS[order.paymentMethod] ||
    clean(order.paymentMethod, "Sin datos");
  const paymentStatus =
    PAYMENT_STATUS_LABELS[order.paymentStatus] ||
    clean(order.paymentStatus, "Pendiente");

  drawRect(doc, left, y, boxW, boxH);
  drawSectionHeader(doc, "DATOS DEL CLIENTE", left, y, boxW);
  drawFieldRow(doc, {
    label: "Nombre",
    value: fullName(customer),
    x: left,
    y: y + 40,
    width: boxW,
    lineY: y + 72,
  });
  drawFieldRow(doc, {
    label: "Email",
    value: clean(customer.email),
    x: left,
    y: y + 73,
    width: boxW,
    lineY: y + 105,
  });
  drawFieldRow(doc, {
    label: "Teléfono",
    value: clean(customer.phone),
    x: left,
    y: y + 106,
    width: boxW,
  });

  const right = left + boxW + gap;
  drawRect(doc, right, y, boxW, boxH);
  drawSectionHeader(doc, "DATOS DE ENVÍO", right, y, boxW);
  drawFieldRow(doc, {
    label: "Nombre",
    value: fullName(customer),
    x: right,
    y: y + 40,
    width: boxW,
    lineY: y + 72,
  });
  drawFieldRow(doc, {
    label: "Dirección",
    value: address,
    x: right,
    y: y + 73,
    width: boxW,
    multiline: true,
    lineY: y + 110,
  });
  drawFieldRow(doc, {
    label: "Envío",
    value: shippingMethod,
    x: right,
    y: y + 111,
    width: boxW,
  });

  const payY = y + boxH + 18;
  drawRect(doc, left, payY, 660, 46);
  drawText(doc, "MÉTODO DE PAGO", left + 18, payY + 15, {
    size: 11,
    bold: true,
    color: COLORS.navy,
    width: 140,
  });
  // drawText(doc, paymentLabel, left + 170, payY + 15, {
  //   size: 10,
  //   color: COLORS.text,
  //   width: 260,
  //   align: "left",
  // });
  drawText(doc, paymentLabel, left + 500, payY + 15, {
    size: 10,
    bold: true,
    color: COLORS.navy,
    width: 140,
    align: "right",
  });

  return payY + 70;
}

const ITEM_COLUMNS = {
  prenda: { x: PAGE.margin + 18, w: 210 },
  marca: { x: PAGE.margin + 245, w: 88 },
  talle: { x: PAGE.margin + 350, w: 48 },
  cantidad: { x: PAGE.margin + 420, w: 62 },
  precio: { x: PAGE.margin + 498, w: 86 },
  subtotal: { x: PAGE.margin + 600, w: 70 },
};

function drawItemsTableHeader(doc, y) {
  const x = PAGE.margin;
  doc.save().rect(x, y, 660, 30).fill(COLORS.navy).restore();

  const headers = [
    ["PRENDA", ITEM_COLUMNS.prenda],
    ["MARCA", ITEM_COLUMNS.marca],
    ["TALLE", ITEM_COLUMNS.talle],
    ["CANT.", ITEM_COLUMNS.cantidad],
    ["PRECIO UNIT.", ITEM_COLUMNS.precio],
    ["SUBTOTAL", ITEM_COLUMNS.subtotal],
  ];

  headers.forEach(([label, col]) => {
    drawText(doc, label, col.x, y + 10, {
      size: 8.6,
      bold: true,
      color: COLORS.white,
      width: col.w,
      align: "left",
    });
  });
}

function rowHeightForItem(item) {
  const title = clean(item.articleTitle, "Prenda");
  return title.length > 36 ? 66 : 58;
}

function drawCellValue(doc, value, col, y, options = {}) {
  drawText(doc, value, col.x, y, {
    size: options.size || 9.6,
    bold: Boolean(options.bold),
    color: options.color || COLORS.text,
    width: col.w,
    align: "left",
    height: options.height,
    lineGap: options.lineGap || 0,
    ellipsis: options.ellipsis || false,
  });
}

function drawItemRow(doc, item, y) {
  const x = PAGE.margin;
  const rowH = rowHeightForItem(item);
  drawRect(doc, x, y, 660, rowH, { stroke: COLORS.border, lineWidth: 0.55 });

  const title = clean(item.articleTitle, "Prenda");
  const hasMeta =
    item.articleId != null || item.articleSlug || item.categoryName;
  const meta = [
    item.articleId != null ? `SKU/ID: ${item.articleId}` : "",
    item.articleSlug || "",
    item.categoryName || "",
  ]
    .filter(Boolean)
    .join(" · ");

  // Celda prenda: titulo principal + metadato solo si existe. No se imprime texto vacio.
  drawCellValue(doc, title, ITEM_COLUMNS.prenda, y + 10, {
    size: 10.2,
    bold: true,
    height: hasMeta ? 25 : 36,
    lineGap: 1,
  });

  // if (hasMeta) {
  //   drawCellValue(doc, meta, ITEM_COLUMNS.prenda, y + rowH - 18, {
  //     size: 8.2,
  //     color: COLORS.muted,
  //     ellipsis: true,
  //   });
  // }

  const cellY = y + rowH / 2 - 6;
  drawCellValue(doc, clean(item.brandName, "-"), ITEM_COLUMNS.marca, cellY, {
    size: 9.7,
  });
  drawCellValue(doc, clean(item.size, "-"), ITEM_COLUMNS.talle, cellY, {
    size: 9.7,
  });
  drawCellValue(doc, clean(item.quantity, "0"), ITEM_COLUMNS.cantidad, cellY, {
    size: 9.7,
    bold: true,
  });
  const displayUnitPrice = item.acceptedOffer?.price != null
    ? Number(item.acceptedOffer.price)
    : item.finalUnitPrice;

  drawCellValue(
    doc,
    formatCurrency(displayUnitPrice),
    ITEM_COLUMNS.precio,
    cellY,
    { size: 9.4 },
  );
  drawCellValue(
    doc,
    formatCurrency(item.lineTotal),
    ITEM_COLUMNS.subtotal,
    cellY,
    {
      size: 9.6,
      bold: true,
      color: COLORS.orange,
    },
  );

  return y + rowH;
}

function addContinuationPage(doc, order) {
  doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
  drawText(doc, "Comprobante de compra", PAGE.margin, 28, {
    size: 16,
    bold: true,
    color: COLORS.navy,
    width: 330,
  });
  drawText(doc, `Orden ${clean(order.orderNumber)}`, PAGE.margin + 375, 31, {
    size: 10,
    color: COLORS.muted,
    width: 285,
    align: "right",
  });
  drawHLine(doc, PAGE.margin, 58, PAGE.width - PAGE.margin, COLORS.aqua, 1.2);
  drawItemsTableHeader(doc, 78);
  return 108;
}

function drawItems(doc, order, y) {
  drawItemsTableHeader(doc, y);
  y += 30;

  for (const item of order.items || []) {
    const rowH = rowHeightForItem(item);
    if (y + rowH > PAGE.height - 190) {
      y = addContinuationPage(doc, order);
    }
    y = drawItemRow(doc, item, y);
  }

  return y + 14;
}

function drawFooterAndTotals(doc, order, y) {
  if (y + 135 > PAGE.height - 60) {
    doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
    y = 60;
  }

  const left = PAGE.margin;
  const sx = left + 280;
  const sw = 380;

  // Solo queda el bloque de totales, sin caja de agradecimiento vacia.
  drawRect(doc, sx, y, sw, 108);

  drawText(doc, "DESCUENTOS", sx + 18, y + 14, {
    size: 10,
    bold: true,
    color: COLORS.navy,
    width: 160,
  });
  drawText(doc, `- ${formatCurrency(order.discountTotal)}`, sx + 210, y + 14, {
    size: 10,
    bold: true,
    color: COLORS.orange,
    width: 150,
    align: "right",
  });
  drawHLine(doc, sx, y + 36, sx + sw);

  drawText(doc, "ENVÍO", sx + 18, y + 50, {
    size: 10,
    bold: true,
    color: COLORS.navy,
    width: 160,
  });
  drawText(doc, formatCurrency(order.shippingCost), sx + 210, y + 50, {
    size: 10,
    color: COLORS.text,
    width: 150,
    align: "right",
  });
  drawHLine(doc, sx, y + 72, sx + sw);

  doc
    .save()
    .rect(sx, y + 72, sw, 36)
    .fill(COLORS.orange)
    .restore();
  drawText(doc, "TOTAL", sx + 18, y + 81, {
    size: 16,
    bold: true,
    color: COLORS.white,
    width: 160,
  });
  drawText(doc, formatCurrency(order.total), sx + 190, y + 81, {
    size: 16,
    bold: true,
    color: COLORS.white,
    width: 170,
    align: "right",
  });

  const footerY = PAGE.height - 62;
  drawHLine(doc, left, footerY, PAGE.width - left, COLORS.aqua, 1.7);
  // doc.save().lineWidth(1.8).strokeColor(COLORS.orange);
  // doc
  //   .moveTo(PAGE.width / 2 - 22, footerY + 8)
  //   .lineTo(PAGE.width / 2 - 6, footerY + 6)
  //   .lineTo(PAGE.width / 2 + 7, footerY + 2)
  //   .stroke();
  // doc.restore();

  const website = websiteLabel(env.publicSiteUrl);
  const email = clean(
    env.mail.replyTo || env.mail.fromEmail || "esadar.1323@gmail.com",
  );

  drawText(doc, website, left, footerY + 22, {
    size: 8.8,
    color: COLORS.text,
    width: 160,
  });
  drawText(doc, "|", left + 160, footerY + 21, {
    size: 12,
    color: COLORS.border,
  });
  drawText(doc, email, left + 190, footerY + 22, {
    size: 8.8,
    color: COLORS.text,
    width: 170,
  });
}

function normalizeOrder(order) {
  return {
    orderNumber: clean(order?.orderNumber),
    createdAt: order?.createdAt,
    paymentMethod: order?.paymentMethod,
    paymentStatus: order?.paymentStatus,
    shippingMethodDescription: order?.shippingMethodDescription,
    shippingCost: asNumber(order?.shippingCost),
    discountTotal: asNumber(order?.discountTotal),
    total: asNumber(order?.total),
    customer: {
      firstName: order?.customer?.firstName,
      lastName: order?.customer?.lastName,
      email: order?.customer?.email,
      phone: order?.customer?.phone,
      address: order?.customer?.address,
    },
    items: (order?.items || []).map((item) => ({
      articleId: item?.articleId,
      articleTitle: item?.articleTitle,
      articleSlug: item?.articleSlug,
      categoryName: item?.categoryName,
      brandName: item?.brandName,
      size: item?.size,
      quantity: item?.quantity,
      finalUnitPrice: asNumber(item?.finalUnitPrice),
      lineTotal: asNumber(item?.lineTotal),
      acceptedOffer: item?.acceptedOffer
        ? {
            id: item.acceptedOffer.id,
            price: asNumber(item.acceptedOffer.price),
            quantity: asNumber(item.acceptedOffer.quantity || 1),
          }
        : null,
    })),
  };
}

export async function generateOrderReceiptPdf(orderInput) {
  const order = normalizeOrder(orderInput);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE.width, PAGE.height],
      margin: 0,
      autoFirstPage: false,
      bufferPages: true,
      info: {
        Title: `Boleta ${order.orderNumber}`,
        Author: "ESADAR",
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
    drawHeader(doc, order);
    let y = drawInfoCards(doc, order, 248);
    y = drawItems(doc, order, y);
    drawFooterAndTotals(doc, order, y);

    doc.end();
  });
}
