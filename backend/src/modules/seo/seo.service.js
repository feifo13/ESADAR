import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { buildSqlPlaceholders } from "../../utils/sql-safety.js";
import { withTransaction } from "../../db/transaction.js";
import { notFound } from "../../utils/app-error.js";
import { joinPublicSiteUrl, toAbsoluteSiteUrl } from "../../utils/assets.js";
import { logAudit } from "../audit/audit.service.js";
import { getPublicArticleBySlugOrId } from "../articles/articles.service.js";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGoogleAvailability(article) {
  return Number(article.quantityAvailable || 0) > 0 &&
    article.status === "ACTIVE"
    ? "in stock"
    : "out of stock";
}

function buildSiteFallbackPages() {
  return [
    {
      route: "/",
      title: `${env.storeName} | Ropa seleccionada`,
      description:
        "Sportswear, vintage y prendas modernas elegidas una por una. Stock limitado y piezas únicas.",
      canonicalUrl: null,
      ogImage: null,
      isIndexable: true,
    },
    {
      route: "/about",
      title: `Sobre ${env.storeName} | Curaduría`,
      description:
        "Conocé la selección de ESADAR: prendas únicas, sportswear, vintage y ropa moderna elegida con criterio.",
      canonicalUrl: null,
      ogImage: null,
      isIndexable: true,
    },
    {
      route: "/contact",
      title: `Contacto | ${env.storeName}`,
      description:
        "Consultanos por una prenda, talles, ingresos nuevos o formas de entrega.",
      canonicalUrl: null,
      ogImage: null,
      isIndexable: true,
    },
  ];
}

export async function listSeoPages() {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        route,
        title,
        description,
        canonical_url AS canonicalUrl,
        og_image AS ogImage,
        is_indexable AS isIndexable,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM site_pages_seo
      ORDER BY route ASC
    `,
  );

  return rows.map((row) => ({
    ...row,
    isIndexable: Boolean(row.isIndexable),
  }));
}

export async function getPublicSiteSeo() {
  const pages = await listSeoPages();
  const pageMap = new Map(
    buildSiteFallbackPages().map((page) => [page.route, page]),
  );

  for (const page of pages) {
    pageMap.set(page.route, page);
  }

  return {
    site: {
      name: env.storeName,
      description: env.storeDescription,
      url: env.publicSiteUrl,
    },
    pages: [...pageMap.values()],
  };
}

export async function getPublicArticleSeo(slugOrId) {
  const article = await getPublicArticleBySlugOrId(slugOrId);
  return {
    articleId: article.id,
    slug: article.slug,
    title: article.seoTitle,
    description: article.seoDescription,
    canonicalUrl: article.canonicalUrl,
    image: toAbsoluteSiteUrl(
      article.primaryImageDetail || article.primaryImage,
    ),
    images: (article.images || [])
      .map((image) => toAbsoluteSiteUrl(image.detailFilePath || image.filePath))
      .filter(Boolean),
    noindex: false,
  };
}

export async function buildRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /login",
    "Disallow: /checkout",
    "Disallow: /api/admin",
    `Sitemap: ${joinPublicSiteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
}

async function listIndexableArticles() {
  const [rows] = await pool.execute(
    `
      SELECT
        a.id,
        a.slug,
        a.updated_at AS updatedAt
      FROM articles a
      WHERE a.status IN ('ACTIVE', 'SOLD_OUT')
      ORDER BY a.updated_at DESC, a.id DESC
    `,
  );

  return rows;
}

export async function buildSitemapXml() {
  const pages = await getPublicSiteSeo();
  const articles = await listIndexableArticles();
  const staticUrls = ["/", "/about", "/contact"];
  const pageOverrides = new Map(
    (pages.pages || []).map((page) => [page.route, page]),
  );

  const urlEntries = [
    ...staticUrls.map((route) => {
      const page = pageOverrides.get(route);
      return `
  <url>
    <loc>${escapeXml(page?.canonicalUrl || joinPublicSiteUrl(route))}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>`;
    }),
    ...articles.map(
      (article) => `
  <url>
    <loc>${escapeXml(joinPublicSiteUrl(`/articles/${article.slug || article.id}`))}</loc>
    <lastmod>${escapeXml(new Date(article.updatedAt || Date.now()).toISOString())}</lastmod>
  </url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join("\n")}
</urlset>`;
}

async function listFeedArticles() {
  const [rows] = await pool.execute(
    `
      SELECT
        a.id,
        a.internal_code AS internalCode,
        a.slug,
        a.title,
        a.seo_title AS seoTitle,
        a.seo_description AS seoDescription,
        a.description,
        a.sale_price AS salePrice,
        a.discounted_price AS discountedPrice,
        a.status,
        a.quantity_available AS quantityAvailable,
        a.google_product_category AS googleProductCategory,
        a.color,
        a.material,
        a.gender,
        a.age_group AS ageGroup,
        b.name AS brandName
      FROM articles a
      LEFT JOIN brands b ON b.id = a.brand_id
      WHERE a.status IN ('ACTIVE', 'SOLD_OUT')
      ORDER BY a.updated_at DESC, a.id DESC
    `,
  );

  if (!rows.length) {
    return [];
  }

  const articleIds = rows.map((row) => Number(row.id));
  const placeholders = buildSqlPlaceholders(articleIds);
  const [imageRows] = await pool.execute(
    `
      SELECT
        article_id AS articleId,
        file_path AS filePath,
        detail_file_path AS detailFilePath,
        original_file_path AS originalFilePath,
        is_primary AS isPrimary,
        sort_order AS sortOrder,
        id
      FROM article_images
      WHERE article_id IN (${placeholders})
      ORDER BY article_id ASC, is_primary DESC, sort_order ASC, id ASC
    `,
    articleIds,
  );

  const imageMap = new Map();
  for (const row of imageRows) {
    const list = imageMap.get(Number(row.articleId)) || [];
    list.push(row);
    imageMap.set(Number(row.articleId), list);
  }

  return rows.map((row) => ({
    ...row,
    images: (imageMap.get(Number(row.id)) || [])
      .map((image) =>
        toAbsoluteSiteUrl(
          image.detailFilePath || image.filePath || image.originalFilePath,
        ),
      )
      .filter(Boolean),
  }));
}

export async function buildGoogleProductsFeedXml() {
  const articles = await listFeedArticles();
  const items = articles.map((article) => {
    const title = article.seoTitle || article.title;
    const description =
      article.seoDescription || article.description || env.storeDescription;
    const price = Number(
      article.discountedPrice || article.salePrice || 0,
    ).toFixed(2);
    const images = article.images || [];
    const primaryImage = images[0] || "";
    const extraImages = images.slice(1);

    return `
    <item>
      <g:id>${escapeXml(article.internalCode || article.id)}</g:id>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(joinPublicSiteUrl(`/articles/${article.slug || article.id}`))}</link>
      <g:image_link>${escapeXml(primaryImage)}</g:image_link>
      ${extraImages.map((image) => `<g:additional_image_link>${escapeXml(image)}</g:additional_image_link>`).join("\n      ")}
      <g:availability>${escapeXml(buildGoogleAvailability(article))}</g:availability>
      <g:price>${escapeXml(`${price} UYU`)}</g:price>
      <g:brand>${escapeXml(article.brandName || env.storeName)}</g:brand>
      <g:condition>used</g:condition>
      ${article.googleProductCategory ? `<g:google_product_category>${escapeXml(article.googleProductCategory)}</g:google_product_category>` : ""}
      ${article.color ? `<g:color>${escapeXml(article.color)}</g:color>` : ""}
      ${article.material ? `<g:material>${escapeXml(article.material)}</g:material>` : ""}
      ${article.gender ? `<g:gender>${escapeXml(article.gender)}</g:gender>` : ""}
      ${article.ageGroup ? `<g:age_group>${escapeXml(article.ageGroup)}</g:age_group>` : ""}
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(env.storeName)}</title>
    <link>${escapeXml(env.publicSiteUrl)}</link>
    <description>${escapeXml(env.storeDescription)}</description>
${items.join("\n")}
  </channel>
</rss>`;
}

export async function updateSeoPage(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const [beforeRows] = await connection.execute(
      `
        SELECT
          id,
          route,
          title,
          description,
          canonical_url AS canonicalUrl,
          og_image AS ogImage,
          is_indexable AS isIndexable
        FROM site_pages_seo
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    if (!beforeRows.length) {
      throw notFound("SEO page not found");
    }

    const before = {
      ...beforeRows[0],
      isIndexable: Boolean(beforeRows[0].isIndexable),
    };

    await connection.execute(
      `
        UPDATE site_pages_seo
        SET
          title = ?,
          description = ?,
          canonical_url = ?,
          og_image = ?,
          is_indexable = ?
        WHERE id = ?
      `,
      [
        input.title,
        input.description,
        input.canonicalUrl || null,
        input.ogImage || null,
        input.isIndexable ? 1 : 0,
        id,
      ],
    );

    const [afterRows] = await connection.execute(
      `
        SELECT
          id,
          route,
          title,
          description,
          canonical_url AS canonicalUrl,
          og_image AS ogImage,
          is_indexable AS isIndexable
        FROM site_pages_seo
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    const after = {
      ...afterRows[0],
      isIndexable: Boolean(afterRows[0].isIndexable),
    };

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: "SEO_PAGE_UPDATED",
        entityType: "site_pages_seo",
        entityId: id,
        beforeJson: before,
        afterJson: after,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}
