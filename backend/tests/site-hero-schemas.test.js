import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteHeroUpdateSchema } from '../src/modules/site/site.schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('site hero schema accepts display and height modes', () => {
  const parsed = siteHeroUpdateSchema.parse({
    title: 'ESADAR',
    subtitle: 'Ropa seleccionada',
    ctaLabel: 'Ver catalogo',
    ctaUrl: '/articles',
    heroHeightMode: 'CUSTOM',
    customHeightVh: '70',
    heroDisplayMode: 'CAROUSEL',
    imageAlt: 'Hero ESADAR',
    images: [
      { id: 2, imageAlt: 'Primera', sortOrder: '1', isActive: 'true' },
    ],
    isActive: true,
  });

  assert.equal(parsed.heroHeightMode, 'CUSTOM');
  assert.equal(parsed.customHeightVh, 70);
  assert.equal(parsed.heroDisplayMode, 'CAROUSEL');
  assert.equal(parsed.images[0].sortOrder, 1);
});

test('site hero schema validates custom height range and display values', () => {
  const basePayload = {
    title: null,
    subtitle: null,
    ctaLabel: null,
    ctaUrl: null,
    imageAlt: null,
    isActive: true,
  };

  assert.throws(
    () => siteHeroUpdateSchema.parse({
      ...basePayload,
      heroHeightMode: 'CUSTOM',
      customHeightVh: 20,
      heroDisplayMode: 'SINGLE_IMAGE',
    }),
    /Too small|greater than or equal/i,
  );

  assert.throws(
    () => siteHeroUpdateSchema.parse({
      ...basePayload,
      heroHeightMode: 'HALF_SCREEN',
      customHeightVh: null,
      heroDisplayMode: 'GRID',
    }),
    /Invalid option|Invalid enum/i,
  );
});

test('site hero service returns ordered active images for public hero payloads', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/modules/site/site.service.js'),
    'utf8',
  );

  assert.match(source, /FROM site_hero_images/);
  assert.match(source, /AND is_active = 1/);
  assert.match(source, /ORDER BY sort_order ASC, id ASC/);
  assert.match(source, /hero\.images = await selectHeroImages/);
});
