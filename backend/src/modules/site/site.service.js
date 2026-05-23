import fs from 'node:fs/promises';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { logAudit } from '../audit/audit.service.js';
import {
  buildUploadPublicPathFromDiskPath,
  isManagedUploadPath,
  normalizePublicAssetPath,
  resolveUploadDiskPath,
} from '../../utils/assets.js';

const DEFAULT_HEIGHT_MODE = 'HALF_SCREEN';
const DEFAULT_DISPLAY_MODE = 'SINGLE_IMAGE';
const DEFAULT_VIEWPORT_TARGET = 'DESKTOP_TABLET';
const VIEWPORT_TARGETS = new Set(['DESKTOP_TABLET', 'MOBILE']);
const HERO_HEIGHT_MODES = new Set(['HALF_SCREEN', 'FULL_SCREEN', 'CUSTOM']);
const HERO_DISPLAY_MODES = new Set(['SINGLE_IMAGE', 'CAROUSEL']);

function normalizeViewportTarget(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return VIEWPORT_TARGETS.has(normalized) ? normalized : DEFAULT_VIEWPORT_TARGET;
}

function normalizeHeroHeightMode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return HERO_HEIGHT_MODES.has(normalized) ? normalized : DEFAULT_HEIGHT_MODE;
}

function normalizeHeroDisplayMode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return HERO_DISPLAY_MODES.has(normalized) ? normalized : DEFAULT_DISPLAY_MODE;
}

function normalizeCustomHeightVh(mode, value) {
  if (mode !== 'CUSTOM') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 70;
  return Math.min(100, Math.max(30, Math.trunc(numeric)));
}

function normalizeHeroImageRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    heroId: Number(row.heroId),
    imageUrl: row.imageUrl || '',
    imageAlt: row.imageAlt || '',
    viewportTarget: normalizeViewportTarget(row.viewportTarget),
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
    heroHeightMode: normalizeHeroHeightMode(row.heroHeightMode),
    customHeightVh: row.customHeightVh != null ? Number(row.customHeightVh) : null,
    heroDisplayMode: normalizeHeroDisplayMode(row.heroDisplayMode),
    imageUrl: row.imageUrl || '',
    imageAlt: row.imageAlt || '',
    desktopImageUrl: '',
    desktopImageAlt: '',
    mobileImageUrl: '',
    mobileImageAlt: '',
    images: [],
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    updatedBy: row.updatedBy != null ? Number(row.updatedBy) : null,
  };
}

function normalizeFiles(files, input = {}) {
  if (!files) return [];

  if (Array.isArray(files)) {
    return files.filter(Boolean).map((file) => ({
      file,
      viewportTarget: normalizeViewportTarget(input.viewportTarget),
    }));
  }

  const fileEntries = [];
  const pushFiles = (fieldName, viewportTarget) => {
    const fieldFiles = Array.isArray(files[fieldName]) ? files[fieldName] : [];
    fieldFiles.filter(Boolean).forEach((file) => {
      fileEntries.push({ file, viewportTarget });
    });
  };

  pushFiles('desktopImage', 'DESKTOP_TABLET');
  pushFiles('desktopImages', 'DESKTOP_TABLET');
  pushFiles('mobileImage', 'MOBILE');
  pushFiles('mobileImages', 'MOBILE');
  pushFiles('image', normalizeViewportTarget(input.viewportTarget));
  pushFiles('images', normalizeViewportTarget(input.viewportTarget));

  return fileEntries;
}

function pickActiveImageForViewport(images, viewportTarget) {
  const target = normalizeViewportTarget(viewportTarget);
  return (
    images.find((image) => image.viewportTarget === target && image.isActive) ||
    images.find((image) => image.viewportTarget === target) ||
    null
  );
}

async function selectHeroImages(connection, heroId, { includeInactive = false } = {}) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        hero_id AS heroId,
        image_url AS imageUrl,
        image_alt AS imageAlt,
        viewport_target AS viewportTarget,
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

  const desktopImage = pickActiveImageForViewport(hero.images, 'DESKTOP_TABLET');
  const mobileImage = pickActiveImageForViewport(hero.images, 'MOBILE');
  const fallbackImage = desktopImage || mobileImage || hero.images.find((image) => image.isActive) || hero.images[0] || null;

  if (fallbackImage) {
    hero.imageUrl = fallbackImage.imageUrl;
    hero.imageAlt = fallbackImage.imageAlt || hero.imageAlt;
  }

  hero.desktopImageUrl = desktopImage?.imageUrl || fallbackImage?.imageUrl || hero.imageUrl || '';
  hero.desktopImageAlt = desktopImage?.imageAlt || hero.imageAlt || '';
  hero.mobileImageUrl = mobileImage?.imageUrl || hero.desktopImageUrl || '';
  hero.mobileImageAlt = mobileImage?.imageAlt || hero.desktopImageAlt || hero.imageAlt || '';

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
      ) VALUES ('ESADAR', 'Ropa seleccionada', 'Ver catálogo', '/articles', ?, ?, 'Hero ESADAR', 1)
    `,
    [DEFAULT_HEIGHT_MODE, DEFAULT_DISPLAY_MODE],
  );

  const hero = await selectLatestHero(connection, { includeInactive: true });
  return hero || {
    id: result.insertId,
    title: 'ESADAR',
    subtitle: 'Ropa seleccionada',
    ctaLabel: 'Ver catálogo',
    ctaUrl: '/articles',
    heroHeightMode: DEFAULT_HEIGHT_MODE,
    customHeightVh: null,
    heroDisplayMode: DEFAULT_DISPLAY_MODE,
    imageUrl: '',
    imageAlt: 'Hero ESADAR',
    desktopImageUrl: '',
    desktopImageAlt: 'Hero ESADAR',
    mobileImageUrl: '',
    mobileImageAlt: 'Hero ESADAR',
    images: [],
    isActive: true,
  };
}

async function ensureSingleActiveHeroImagePerViewport(connection, heroId) {
  for (const viewportTarget of VIEWPORT_TARGETS) {
    const [rows] = await connection.execute(
      `
        SELECT id, is_active AS isActive
        FROM site_hero_images
        WHERE hero_id = ?
          AND viewport_target = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [heroId, viewportTarget],
    );

    if (!rows.length) continue;

    const selected = rows.find((row) => Boolean(row.isActive)) || rows[0];

    await connection.execute(
      `
        UPDATE site_hero_images
        SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END
        WHERE hero_id = ?
          AND viewport_target = ?
      `,
      [selected.id, heroId, viewportTarget],
    );
  }
}

async function deleteManagedHeroImageFile(imageUrl) {
  if (!isManagedUploadPath(imageUrl)) return;
  const diskPath = resolveUploadDiskPath(imageUrl);
  if (!diskPath) return;

  try {
    await fs.unlink(diskPath);
  } catch (_error) {
    // The DB record is the source of truth. Missing files must not break admin cleanup.
  }
}

async function syncLegacyHeroImageFields(connection, heroId) {
  const [rows] = await connection.execute(
    `
      SELECT image_url AS imageUrl, image_alt AS imageAlt
      FROM site_hero_images
      WHERE hero_id = ?
        AND is_active = 1
        AND viewport_target = 'DESKTOP_TABLET'
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
    `,
    [heroId],
  );

  let firstImage = rows[0] || null;

  if (!firstImage) {
    const [fallbackRows] = await connection.execute(
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
    firstImage = fallbackRows[0] || null;
  }

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
  const viewportTarget = normalizeViewportTarget(image.viewportTarget);

  if (image.id) {
    await connection.execute(
      `
        UPDATE site_hero_images
        SET
          image_alt = ?,
          viewport_target = ?,
          sort_order = ?,
          is_active = ?
        WHERE id = ?
          AND hero_id = ?
      `,
      [
        image.imageAlt || null,
        viewportTarget,
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
        viewport_target,
        sort_order,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      heroId,
      imageUrl,
      image.imageAlt || null,
      viewportTarget,
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
    const heroHeightMode = normalizeHeroHeightMode(input.heroHeightMode);
    const customHeightVh = normalizeCustomHeightVh(heroHeightMode, input.customHeightVh);
    const heroDisplayMode = normalizeHeroDisplayMode(input.heroDisplayMode);

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
        heroHeightMode,
        customHeightVh,
        heroDisplayMode,
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
        viewportTarget: DEFAULT_VIEWPORT_TARGET,
        sortOrder: 0,
        isActive: true,
      });
    }

    if (Array.isArray(input.images)) {
      const selectedByViewport = new Set();
      for (const image of input.images) {
        const viewportTarget = normalizeViewportTarget(image.viewportTarget);
        const shouldBeActive = heroDisplayMode === 'CAROUSEL'
          ? Boolean(image.isActive)
          : Boolean(image.isActive) && !selectedByViewport.has(viewportTarget);
        await upsertHeroImageMetadata(connection, before.id, {
          ...image,
          viewportTarget,
          isActive: shouldBeActive,
        });
        if (shouldBeActive) selectedByViewport.add(viewportTarget);
      }
    }

    if (heroDisplayMode === 'SINGLE_IMAGE') {
      await ensureSingleActiveHeroImagePerViewport(connection, before.id);
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
  const uploadEntries = normalizeFiles(files, input);

  return withTransaction(async (connection) => {
    const before = await ensureHeroRow(connection);
    if (!uploadEntries.length) return before;

    const [sortRows] = await connection.execute(
      'SELECT COALESCE(MAX(sort_order), -1) AS maxSortOrder FROM site_hero_images WHERE hero_id = ?',
      [before.id],
    );
    let nextSortOrder = Number(sortRows[0]?.maxSortOrder ?? -1) + 1;
    const activeByViewport = new Set(
      before.images
        .filter((image) => image.isActive)
        .map((image) => normalizeViewportTarget(image.viewportTarget)),
    );
    const selectedInBatch = new Set();

    for (const entry of uploadEntries) {
      const imageUrl = buildUploadPublicPathFromDiskPath(entry.file.path);
      const viewportTarget = normalizeViewportTarget(entry.viewportTarget);
      const shouldSelectUpload = before.heroDisplayMode === 'CAROUSEL'
        || (!activeByViewport.has(viewportTarget) && !selectedInBatch.has(viewportTarget));

      await connection.execute(
        `
          INSERT INTO site_hero_images (
            hero_id,
            image_url,
            image_alt,
            viewport_target,
            sort_order,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          before.id,
          imageUrl,
          input.imageAlt || before.imageAlt || null,
          viewportTarget,
          nextSortOrder,
          shouldSelectUpload ? 1 : 0,
        ],
      );

      if (shouldSelectUpload) selectedInBatch.add(viewportTarget);
      nextSortOrder += 1;
    }

    await connection.execute(
      'UPDATE site_hero SET updated_by = ? WHERE id = ?',
      [auditContext.actorUserId || null, before.id],
    );
    if (before.heroDisplayMode === 'SINGLE_IMAGE') {
      await ensureSingleActiveHeroImagePerViewport(connection, before.id);
    }
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
        metadataJson: { uploadedImages: uploadEntries.length },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

export async function deleteAdminSiteHeroImage(imageId, auditContext) {
  if (!Number.isInteger(imageId) || imageId <= 0) {
    throw new Error('Invalid hero image id');
  }

  let deletedImageUrl = '';

  const after = await withTransaction(async (connection) => {
    const before = await ensureHeroRow(connection);
    const [rows] = await connection.execute(
      'SELECT id, image_url AS imageUrl, viewport_target AS viewportTarget FROM site_hero_images WHERE id = ? AND hero_id = ? LIMIT 1',
      [imageId, before.id],
    );

    const image = rows[0] || null;
    if (!image) return before;

    deletedImageUrl = image.imageUrl || '';
    await connection.execute('DELETE FROM site_hero_images WHERE id = ? AND hero_id = ?', [imageId, before.id]);
    if (before.heroDisplayMode === 'SINGLE_IMAGE') {
      await ensureSingleActiveHeroImagePerViewport(connection, before.id);
    }
    await syncLegacyHeroImageFields(connection, before.id);

    const nextHero = await selectLatestHero(connection, { includeInactive: true });
    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: 'SITE_HERO_IMAGE_DELETED',
        entityType: 'site_hero_image',
        entityId: imageId,
        beforeJson: image,
        afterJson: nextHero,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return nextHero;
  });

  await deleteManagedHeroImageFile(deletedImageUrl);
  return after;
}
