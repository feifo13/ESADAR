import { statisticsExportQuerySchema, statisticsFiltersSchema, statisticsTopQuerySchema } from './statistics.schemas.js';
import {
  exportStatisticsReport,
  getStatisticsMarketStudy,
  getStatisticsProfit,
  getStatisticsSalesOverTime,
  getStatisticsSummary,
  getStatisticsTopArticles,
  getStatisticsTopCategories,
  getStatisticsTopCustomers,
  getStatisticsWishlist,
} from './statistics.service.js';

export async function getAdminStatisticsSummary(req, res) {
  const filters = statisticsFiltersSchema.parse(req.query);
  const summary = await getStatisticsSummary(filters);
  return res.json({ ok: true, summary });
}

export async function getAdminStatisticsSalesOverTime(req, res) {
  const filters = statisticsFiltersSchema.parse(req.query);
  const items = await getStatisticsSalesOverTime(filters);
  return res.json({ ok: true, items });
}

export async function getAdminStatisticsTopArticles(req, res) {
  const filters = statisticsTopQuerySchema.parse(req.query);
  const items = await getStatisticsTopArticles(filters, filters.limit);
  return res.json({ ok: true, items });
}

export async function getAdminStatisticsTopCustomers(req, res) {
  const filters = statisticsTopQuerySchema.parse(req.query);
  const items = await getStatisticsTopCustomers(filters, filters.limit);
  return res.json({ ok: true, items });
}

export async function getAdminStatisticsTopCategories(req, res) {
  const filters = statisticsTopQuerySchema.parse(req.query);
  const items = await getStatisticsTopCategories(filters, filters.limit);
  return res.json({ ok: true, items });
}

export async function getAdminStatisticsProfit(req, res) {
  const filters = statisticsFiltersSchema.parse(req.query);
  const profit = await getStatisticsProfit(filters);
  return res.json({ ok: true, profit });
}

export async function getAdminStatisticsWishlist(req, res) {
  const filters = statisticsFiltersSchema.parse(req.query);
  const wishlist = await getStatisticsWishlist(filters);
  return res.json({ ok: true, wishlist });
}

export async function getAdminStatisticsMarketStudy(req, res) {
  const filters = statisticsFiltersSchema.parse(req.query);
  const marketStudy = await getStatisticsMarketStudy(filters);
  return res.json({ ok: true, marketStudy });
}

export async function exportAdminStatisticsReport(req, res) {
  const query = statisticsExportQuerySchema.parse(req.query);
  const result = await exportStatisticsReport(query, query.type);

  res.setHeader('Content-Type', result.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.fileName}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
  );
  return res.send(result.payload);
}
