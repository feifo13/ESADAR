import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  siteHeroUpdateSchema,
  siteTickerUpdateSchema,
} from '../src/modules/site/site.schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('site hero schema accepts display and height modes', () => {
  const parsed = siteHeroUpdateSchema.parse({
    title: 'ESADAR',
    subtitle: 'Ropa seleccionada',
    ctaLabel: 'Ver catálogo',
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


test('site hero schema accepts tablet/laptop height mode', () => {
  const parsed = siteHeroUpdateSchema.parse({
    title: 'ESADAR',
    subtitle: null,
    ctaLabel: null,
    ctaUrl: null,
    heroHeightMode: 'TABLET_LAPTOP',
    customHeightVh: null,
    heroDisplayMode: 'SINGLE_IMAGE',
    imageAlt: 'Hero ESADAR',
    isActive: true,
  });

  assert.equal(parsed.heroHeightMode, 'TABLET_LAPTOP');
});


test('site hero schema accepts tablet/laptop image viewport target', () => {
  const parsed = siteHeroUpdateSchema.parse({
    title: 'ESADAR',
    subtitle: null,
    ctaLabel: null,
    ctaUrl: null,
    heroHeightMode: 'HALF_SCREEN',
    customHeightVh: null,
    heroDisplayMode: 'SINGLE_IMAGE',
    imageAlt: 'Hero ESADAR',
    images: [
      {
        id: 3,
        imageAlt: 'Hero tablet',
        viewportTarget: 'TABLET_LAPTOP',
        sortOrder: 0,
        isActive: true,
      },
    ],
    isActive: true,
  });

  assert.equal(parsed.images[0].viewportTarget, 'TABLET_LAPTOP');
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

test('site ticker schema accepts internal destinations and boolean flags', () => {
  const parsed = siteTickerUpdateSchema.parse({
    isEnabled: 'true',
    text: 'Nuevas prendas disponibles',
    targetUrl: '/articles?featured=true',
    targetSection: 'offers',
    backgroundColor: '#ff6b00',
    isSticky: 'false',
  });

  assert.equal(parsed.isEnabled, true);
  assert.equal(parsed.targetUrl, '/articles?featured=true');
  assert.equal(parsed.targetSection, 'offers');
  assert.equal(parsed.isSticky, false);
});

test('site ticker schema rejects unsafe URLs and invalid colors', () => {
  assert.throws(
    () => siteTickerUpdateSchema.parse({
      isEnabled: true,
      text: 'Ticker',
      targetUrl: 'https://example.com',
      backgroundColor: '#ff6b00',
      isSticky: false,
    }),
    /interna/i,
  );

  assert.throws(
    () => siteTickerUpdateSchema.parse({
      isEnabled: true,
      text: 'Ticker',
      targetUrl: '/articles',
      backgroundColor: 'javascript:alert(1)',
      isSticky: false,
    }),
    /color/i,
  );
});
