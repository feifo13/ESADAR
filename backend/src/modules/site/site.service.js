import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { logAudit } from '../audit/audit.service.js';
import { buildUploadPublicPathFromDiskPath, normalizePublicAssetPath } from '../../utils/assets.js';

function normalizeHeroRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title || '',
    subtitle: row.subtitle || '',
    ctaLabel: row.ctaLabel || '',
    ctaUrl: row.ctaUrl || '',
    imageUrl: row.imageUrl || '',
    imageAlt: row.imageAlt || '',
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    updatedBy: row.updatedBy != null ? Number(row.updatedBy) : null,
  };
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
  return normalizeHeroRow(rows[0] || null);
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
        image_alt,
        is_active
      ) VALUES ('ESADAR', 'Ropa seleccionada', 'Ver catalogo', '/articles', 'Hero ESADAR', 1)
    `,
  );

  return {
    id: result.insertId,
    title: 'ESADAR',
    subtitle: 'Ropa seleccionada',
    ctaLabel: 'Ver catalogo',
    ctaUrl: '/articles',
    imageUrl: '',
    imageAlt: 'Hero ESADAR',
    isActive: true,
  };
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
        nextImageUrl || null,
        input.imageAlt || null,
        input.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        before.id,
      ],
    );

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

export async function updateAdminSiteHeroImage(file, input, auditContext) {
  const imageUrl = file ? buildUploadPublicPathFromDiskPath(file.path) : '';
  const current = (await getAdminSiteHero()) || {};
  return updateAdminSiteHero(
    {
      ...current,
      imageUrl,
      imageAlt: input.imageAlt === undefined ? current.imageAlt : input.imageAlt,
      isActive: current.isActive ?? true,
    },
    auditContext,
  );
}
