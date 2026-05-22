import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { logAudit } from '../audit/audit.service.js';
import { buildUploadPublicPathFromDiskPath, normalizePublicAssetPath } from '../../utils/assets.js';

const DEFAULT_HEIGHT_MODE = 'HALF_SCREEN';
const DEFAULT_DISPLAY_MODE = 'SINGLE_IMAGE';

function normalizeHeroImageRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    heroId: Number(row.heroId),
    imageUrl: row.imageUrl || '',
    imageAlt: row.imageAlt || '',
    sortOrder: Number(row.sortOrder || 0),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function normalizeHeroRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title || '',
    subtitle: row.subtitle || '',
    ctaLabel: row.ctaLabel || '',
    ctaUrl: row.ctaUrl || '',
    heroHeightMode: row.heroHeightMode || DEFAULT_HEIGHT_MODE,
    customHeightVh: row.customHeightVh != null ? Number(row.customHeightVh) : null,
    heroDisplayMode: row.heroDisplayMode || DEFAULT_DISPLAY_MODE,
    imageUrl: row.imageUrl || '',
    imageAlt: row.imageAlt || '',
    images: [],
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    updatedBy: row.updatedBy != null ? Number(row.updatedBy) : null,
  };
}

function normalizeFiles(files) {
  if (!files) return [];
  if (Array.isArray(files)) return files.filter(Boolean);
  return [
    ...(Array.isArray(files.image) ? files.image : []),
    ...(Array.isArray(files.images) ? files.images : []),
  ].filter(Boolean);
}

async function selectHeroImages(connection, heroId, { includeInactive = false } = {}) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        hero_id AS heroId,
        image_url AS imageUrl,
        image_alt AS imageAlt,
        sort_order AS sortOrder,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM site_hero_images
      WHERE hero_id = ?
        ${includeInactive ? '' : 'AND is_active = 1'}
      ORDER BY sort_order ASC, id ASC
    `,
    [heroId],
  );

  return rows.map(normalizeHeroImageRow);
}

async function selectLatestHero(connection = pool, { includeInactive = false } = {}) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        title,
        subtitle,
        cta_label AS ctaLabel,
        cta_url AS ctaUrl,
        hero_height_mode AS heroHeightMode,
        custom_height_vh AS customHeightVh,
        hero_display_mode AS heroDisplayMode,
        image_url AS imageUrl,
        image_alt AS imageAlt,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt,
        updated_by AS updatedBy
      FROM site_hero
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY id DESC
      LIMIT 1
    `,
  );

  const hero = normalizeHeroRow(rows[0] || null);
  if (!hero) return null;

  hero.images = await selectHeroImages(connection, hero.id, { includeInactive });

  const firstActiveImage =
    hero.images.find((image) => image.isActive) ||
    hero.images[0] ||
    null;
  if (firstActiveImage) {
    hero.imageUrl = firstActiveImage.imageUrl;
    hero.imageAlt = firstActiveImage.imageAlt || hero.imageAlt;
  }

  return hero;
}

async function ensureHeroRow(connection) {
  const current = await selectLatestHero(connection, { includeInactive: true });
  if (current) return current;

  const [result] = await connection.execute(
    `
      INSERT INTO site_hero (
        title,
        subtitle,
        cta_label,
        cta_url,
        hero_height_mode,
        hero_display_mode,
        image_alt,
        is_active
      ) VALUES ('ESADAR', 'Ropa seleccionada', 'Ver catalogo', '/articles', ?, ?, 'Hero ESADAR', 1)
    `,
    [DEFAULT_HEIGHT_MODE, DEFAULT_DISPLAY_MODE],
  );

  const hero = await selectLatestHero(connection, { includeInactive: true });
  return hero || {
    id: result.insertId,
    title: 'ESADAR',
    subtitle: 'Ropa seleccionada',
    ctaLabel: 'Ver catalogo',
    ctaUrl: '/articles',
    heroHeightMode: DEFAULT_HEIGHT_MODE,
    customHeightVh: null,
    heroDisplayMode: DEFAULT_DISPLAY_MODE,
    imageUrl: '',
    imageAlt: 'Hero ESADAR',
    images: [],
    isActive: true,
  };
}

async function syncLegacyHeroImageFields(connection, heroId) {
  const [rows] = await connection.execute(
    `
      SELECT image_url AS imageUrl, image_alt AS imageAlt
      FROM site_hero_images
      WHERE hero_id = ?
        AND is_active = 1
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
    `,
    [heroId],
  );

  const firstImage = rows[0] || null;
  await connection.execute(
    `
      UPDATE site_hero
      SET
        image_url = ?,
        image_alt = COALESCE(?, image_alt)
      WHERE id = ?
    `,
    [firstImage?.imageUrl || null, firstImage?.imageAlt || null, heroId],
  );
}

async function upsertHeroImageMetadata(connection, heroId, image) {
  if (image.id) {
    await connection.execute(
      `
        UPDATE site_hero_images
        SET
          image_alt = ?,
          sort_order = ?,
          is_active = ?
        WHERE id = ?
          AND hero_id = ?
      `,
      [
        image.imageAlt || null,
        Number(image.sortOrder || 0),
        image.isActive ? 1 : 0,
        Number(image.id),
        heroId,
      ],
    );
    return;
  }

  const imageUrl = normalizePublicAssetPath(image.imageUrl);
  if (!imageUrl) return;

  await connection.execute(
    `
      INSERT INTO site_hero_images (
        hero_id,
        image_url,
        image_alt,
        sort_order,
        is_active
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [
      heroId,
      imageUrl,
      image.imageAlt || null,
      Number(image.sortOrder || 0),
      image.isActive ? 1 : 0,
    ],
  );
}

export async function getPublicSiteHero() {
  return selectLatestHero(pool);
}

export async function getAdminSiteHero() {
  return selectLatestHero(pool, { includeInactive: true });
}

export async function updateAdminSiteHero(input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await ensureHeroRow(connection);
    const nextImageUrl = input.imageUrl === undefined
      ? before.imageUrl || null
      : normalizePublicAssetPath(input.imageUrl);

    await connection.execute(
      `
        UPDATE site_hero
        SET
          title = ?,
          subtitle = ?,
          cta_label = ?,
          cta_url = ?,
          hero_height_mode = ?,
          custom_height_vh = ?,
          hero_display_mode = ?,
          image_url = ?,
          image_alt = ?,
          is_active = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        input.title || null,
        input.subtitle || null,
        input.ctaLabel || null,
        input.ctaUrl || null,
        input.heroHeightMode || DEFAULT_HEIGHT_MODE,
        input.heroHeightMode === 'CUSTOM' ? input.customHeightVh || null : null,
        input.heroDisplayMode || DEFAULT_DISPLAY_MODE,
        nextImageUrl || null,
        input.imageAlt || null,
        input.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        before.id,
      ],
    );

    if (nextImageUrl && !before.images.length) {
      await upsertHeroImageMetadata(connection, before.id, {
        imageUrl: nextImageUrl,
        imageAlt: input.imageAlt || before.imageAlt || null,
        sortOrder: 0,
        isActive: true,
      });
    }

    if (Array.isArray(input.images)) {
      for (const image of input.images) {
        await upsertHeroImageMetadata(connection, before.id, image);
      }
    }

    await syncLegacyHeroImageFields(connection, before.id);

    const after = await selectLatestHero(connection, { includeInactive: true });
    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: 'SITE_HERO_UPDATED',
        entityType: 'site_hero',
        entityId: after?.id || before.id,
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

export async function updateAdminSiteHeroImage(files, input, auditContext) {
  const uploadFiles = normalizeFiles(files);

  return withTransaction(async (connection) => {
    const before = await ensureHeroRow(connection);
    if (!uploadFiles.length) return before;

    const displayMode = input.heroDisplayMode || before.heroDisplayMode || DEFAULT_DISPLAY_MODE;
    const filesToInsert = displayMode === 'SINGLE_IMAGE' ? uploadFiles.slice(0, 1) : uploadFiles;

    if (displayMode === 'SINGLE_IMAGE') {
      await connection.execute(
        'UPDATE site_hero_images SET is_active = 0 WHERE hero_id = ?',
        [before.id],
      );
    }

    const [sortRows] = await connection.execute(
      'SELECT COALESCE(MAX(sort_order), -1) AS maxSortOrder FROM site_hero_images WHERE hero_id = ?',
      [before.id],
    );
    let nextSortOrder = Number(sortRows[0]?.maxSortOrder ?? -1) + 1;

    for (const file of filesToInsert) {
      const imageUrl = buildUploadPublicPathFromDiskPath(file.path);
      await connection.execute(
        `
          INSERT INTO site_hero_images (
            hero_id,
            image_url,
            image_alt,
            sort_order,
            is_active
          ) VALUES (?, ?, ?, ?, 1)
        `,
        [
          before.id,
          imageUrl,
          input.imageAlt || before.imageAlt || null,
          displayMode === 'SINGLE_IMAGE' ? 0 : nextSortOrder,
        ],
      );
      nextSortOrder += 1;
    }

    await connection.execute(
      'UPDATE site_hero SET hero_display_mode = ?, updated_by = ? WHERE id = ?',
      [displayMode, auditContext.actorUserId || null, before.id],
    );
    await syncLegacyHeroImageFields(connection, before.id);

    const after = await selectLatestHero(connection, { includeInactive: true });
    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: 'SITE_HERO_IMAGE_UPDATED',
        entityType: 'site_hero',
        entityId: before.id,
        beforeJson: before,
        afterJson: after,
        metadataJson: { uploadedImages: filesToInsert.length, displayMode },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}
